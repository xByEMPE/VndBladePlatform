// Lógica de la Edge Function `admin-change-user-email`: un `dev` activo cambia el correo de OTRA cuenta
// sin depender de la confirmación en el correo viejo.
//
// Sin dependencias de Deno (los clientes llegan inyectados) para poder probarla con vitest.
//
// Reglas (todas se aplican en la BASE DE DATOS; esta función solo orquesta):
//   - solo un dev ACTIVO, nunca sobre el Master Dev ni sobre uno mismo -> public.admin_email_change_precheck
//   - quién ejecutó el cambio queda en audit_logs -> public.admin_email_change_audit (solo service_role)
//   - el trigger private.protect_master_email vuelve a proteger al Master en auth.users
//
// Orden: JWT -> validar cuerpo -> precheck (con el JWT del dev) -> [dry_run termina aquí]
//        -> auditar REQUESTED -> Admin API updateUserById -> auditar EMAIL_CHANGE | EMAIL_CHANGE_FAILED

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// SQLSTATE que lanza la base -> estado HTTP
const STATUS_BY_SQLSTATE = {
  '42501': 403, // sin permiso: no es dev activo, objetivo protegido (Master) o es uno mismo
  P0002: 404, // usuario no encontrado
  '22023': 422, // dato inválido (correo, motivo...)
  '23505': 409, // correo ya en uso
  '53400': 429, // límite de cambios por hora
};

const oneLine = (s, max = 300) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, max);

/**
 * @param {{
 *   env: Record<string, string|undefined>,
 *   createClient: (url: string, key: string, options?: object) => any,
 *   randomUUID?: () => string,
 *   log?: { error: (...a: any[]) => void },
 * }} deps
 */
export const createHandler = ({ env, createClient, randomUUID = () => crypto.randomUUID(), log = console }) => {
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const cors = (req) => {
    const headers = {
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    };
    const origin = req.headers.get('Origin') ?? '';
    if (allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    return headers;
  };

  const json = (req, body, status) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: cors(req) });
    if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

    const url = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = env.SUPABASE_ANON_KEY;
    if (!url || !serviceKey || !anonKey) {
      log.error('[admin-change-user-email] faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY');
      return json(req, { error: 'Internal error' }, 500);
    }

    // 1) Identidad: el actor sale del JWT validado por el servidor, NUNCA del cuerpo de la petición
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(req, { error: 'Unauthorized' }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    const actor = userData?.user;
    if (authError || !actor) return json(req, { error: 'Unauthorized' }, 401);

    // 2) Cuerpo
    let body;
    try {
      body = await req.json();
    } catch {
      return json(req, { error: 'Cuerpo JSON invalido', code: 'invalid_request' }, 422);
    }
    const targetId = String(body?.target_user_id ?? '');
    const newEmail = String(body?.new_email ?? '').trim();
    const reason = String(body?.reason ?? '').trim();
    const dryRun = body?.dry_run === true;
    if (!UUID_RE.test(targetId)) return json(req, { error: 'target_user_id invalido', code: 'invalid_request' }, 422);
    if (newEmail.length > 254 || !EMAIL_RE.test(newEmail)) {
      return json(req, { error: 'Correo nuevo invalido', code: 'invalid_request' }, 422);
    }
    if (reason.length < 5 || reason.length > 300) {
      return json(req, { error: 'El motivo debe tener entre 5 y 300 caracteres', code: 'invalid_request' }, 422);
    }

    // 3) Validación en la base, con el JWT del dev (así is_dev()/auth.uid() son los suyos)
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: pre, error: preError } = await asUser.rpc('admin_email_change_precheck', {
      p_target: targetId,
      p_new_email: newEmail,
      p_reason: reason,
    });
    if (preError) {
      const status = STATUS_BY_SQLSTATE[preError.code] ?? 500;
      if (status === 500) log.error('[admin-change-user-email] precheck:', preError);
      return json(req, { error: status === 500 ? 'Internal error' : preError.message, code: preError.code }, status);
    }

    const info = {
      old_email: pre.old_email,
      new_email: pre.new_email, // normalizado (minúsculas, sin espacios) por la base
      projects_with_old_email: pre.projects_with_old_email ?? 0,
    };

    // Simulación: solo valida y avisa; no cambia nada ni audita
    if (dryRun) return json(req, { ok: true, dry_run: true, ...info }, 200);

    // 4) Auditoría ANTES de actuar: sin rastro no hay cambio
    const requestId = randomUUID();
    const meta = {
      ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || undefined,
      user_agent: oneLine(req.headers.get('user-agent'), 200) || undefined,
      source: 'admin-change-user-email',
    };
    const audit = (event, extra = {}) =>
      admin.rpc('admin_email_change_audit', {
        p_actor: actor.id,
        p_event: event,
        p_target: targetId,
        p_old_email: info.old_email,
        p_new_email: info.new_email,
        p_reason: reason,
        p_request_id: requestId,
        p_meta: { ...meta, ...extra },
      });

    const { error: reqAuditError } = await audit('EMAIL_CHANGE_REQUESTED');
    if (reqAuditError) {
      log.error('[admin-change-user-email] no se pudo auditar la solicitud:', reqAuditError);
      return json(req, { error: 'No se pudo registrar la auditoria; no se hizo ningun cambio', request_id: requestId }, 500);
    }

    // 5) Cambio con la Admin API (actualiza auth.users; el trigger sincroniza user_profiles)
    const { error: updateError } = await admin.auth.admin.updateUserById(targetId, {
      email: info.new_email,
      email_confirm: true,
    });

    if (updateError) {
      const { error: failAuditError } = await audit('EMAIL_CHANGE_FAILED', { error: oneLine(updateError.message) });
      if (failAuditError) log.error('[admin-change-user-email] no se pudo auditar el fallo:', failAuditError);
      const duplicate = /already|registered|exists|duplicate|taken/i.test(updateError.message ?? '');
      return json(
        req,
        {
          error: duplicate ? 'Ese correo ya esta en uso por otra cuenta' : 'No se pudo cambiar el correo',
          request_id: requestId,
        },
        duplicate ? 409 : 502,
      );
    }

    // 6) Éxito: se registra quién lo hizo
    const { error: doneAuditError } = await audit('EMAIL_CHANGE');
    if (doneAuditError) {
      // El cambio ya ocurrió y la solicitud sí quedó auditada; se avisa en lugar de fingir un fallo
      log.error('[admin-change-user-email] cambio hecho pero no se pudo auditar el resultado:', doneAuditError);
    }

    return json(
      req,
      { ok: true, request_id: requestId, ...info, ...(doneAuditError ? { audit_recorded: false } : {}) },
      200,
    );
  };
};
