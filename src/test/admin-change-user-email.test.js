// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createHandler } from '../../supabase/functions/admin-change-user-email/handler.js';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const ORIGIN = 'https://app.example.com';

const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  SUPABASE_ANON_KEY: 'anon',
  ALLOWED_ORIGINS: `${ORIGIN}, https://otro.example.com`,
};

// Clientes simulados: registran cada llamada en orden y se pueden configurar por prueba.
const setup = (overrides = {}) => {
  const calls = [];
  const state = {
    getUser: { data: { user: { id: ACTOR } }, error: null },
    precheck: {
      data: { ok: true, old_email: 'viejo@x.com', new_email: 'nuevo@x.com', projects_with_old_email: 2 },
      error: null,
    },
    audit: () => ({ error: null }),
    update: { error: null },
    ...overrides,
  };
  const createClient = (url, key, options = {}) => {
    if (key === 'service') {
      return {
        auth: {
          getUser: async (token) => {
            calls.push(['getUser', token]);
            return state.getUser;
          },
          admin: {
            updateUserById: async (id, attrs) => {
              calls.push(['updateUserById', id, attrs]);
              return state.update;
            },
          },
        },
        rpc: async (name, args) => {
          calls.push(['service.rpc', name, args]);
          return state.audit(args);
        },
      };
    }
    return {
      rpc: async (name, args) => {
        calls.push(['user.rpc', name, args, options.global?.headers?.Authorization]);
        return state.precheck;
      },
    };
  };
  const log = { error: vi.fn() };
  const handler = createHandler({ env: ENV, createClient, randomUUID: () => REQUEST_ID, log });
  return { handler, calls, log };
};

const req = (body, { method = 'POST', token = 'jwt-del-dev', headers = {} } = {}) =>
  new Request('https://proj.supabase.co/functions/v1/admin-change-user-email', {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-forwarded-for': '203.0.113.9, 10.0.0.1',
      'user-agent': 'UA-Test/1.0',
      ...headers,
    },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

const valid = { target_user_id: TARGET, new_email: 'Nuevo@X.com ', reason: 'ya no tiene acceso a su correo' };
const names = (calls) => calls.map((c) => (c[0] === 'service.rpc' ? `${c[1]}:${c[2].p_event}` : c[0] === 'user.rpc' ? `user:${c[1]}` : c[0]));

describe('admin-change-user-email: acceso y validación del cuerpo', () => {
  it('OPTIONS responde el preflight solo a orígenes permitidos', async () => {
    const { handler, calls } = setup();
    const ok = await handler(req(null, { method: 'OPTIONS', headers: { Origin: ORIGIN } }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const bad = await handler(req(null, { method: 'OPTIONS', headers: { Origin: 'https://malo.example.com' } }));
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(calls).toEqual([]); // el preflight no consulta nada
  });

  it('solo acepta POST', async () => {
    const { handler } = setup();
    expect((await handler(req(null, { method: 'GET' }))).status).toBe(405);
  });

  it('sin token -> 401, y no toca la base', async () => {
    const { handler, calls } = setup();
    const res = await handler(req(valid, { token: '' }));
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('token inválido -> 401 sin llegar al precheck', async () => {
    const { handler, calls } = setup({ getUser: { data: { user: null }, error: { message: 'bad jwt' } } });
    expect((await handler(req(valid))).status).toBe(401);
    expect(names(calls)).toEqual(['getUser']);
  });

  it.each([
    ['target_user_id inválido', { ...valid, target_user_id: 'no-es-uuid' }],
    ['correo sin arroba', { ...valid, new_email: 'sinarroba' }],
    ['correo demasiado largo', { ...valid, new_email: `${'a'.repeat(250)}@x.com` }],
    ['motivo corto', { ...valid, reason: 'xx' }],
    ['motivo ausente', { target_user_id: TARGET, new_email: 'a@b.co' }],
  ])('%s -> 422 sin tocar la base', async (_name, body) => {
    const { handler, calls } = setup();
    const res = await handler(req(body));
    expect(res.status).toBe(422);
    expect(names(calls)).toEqual(['getUser']); // ni precheck, ni auditoría, ni cambio
  });

  it('cuerpo que no es JSON -> 422', async () => {
    const { handler } = setup();
    expect((await handler(req('{no json'))).status).toBe(422);
  });

  it('faltan variables de entorno -> 500 sin filtrar detalles', async () => {
    const handler = createHandler({ env: { SUPABASE_URL: 'x' }, createClient: () => ({}), log: { error: vi.fn() } });
    const res = await handler(req(valid));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal error' });
  });
});

describe('admin-change-user-email: reglas de la base (precheck) -> códigos HTTP', () => {
  it.each([
    ['42501', 403, 'no es dev / Master / uno mismo'],
    ['P0002', 404, 'usuario inexistente'],
    ['22023', 422, 'dato inválido'],
    ['23505', 409, 'correo en uso'],
    ['53400', 429, 'límite por hora'],
  ])('SQLSTATE %s -> %s (%s) y NO audita ni cambia nada', async (code, status) => {
    const { handler, calls } = setup({ precheck: { data: null, error: { code, message: 'mensaje de la base' } } });
    const res = await handler(req(valid));
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe('mensaje de la base');
    expect(names(calls)).toEqual(['getUser', 'user:admin_email_change_precheck']);
  });

  it('un error inesperado de la base es 500 y no filtra su mensaje', async () => {
    const { handler, log } = setup({ precheck: { data: null, error: { code: 'XX000', message: 'detalle interno' } } });
    const res = await handler(req(valid));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal error' });
    expect(log.error).toHaveBeenCalled();
  });

  it('el precheck se ejecuta con el JWT del dev (no con la service key)', async () => {
    const { handler, calls } = setup();
    await handler(req(valid, { token: 'jwt-del-dev' }));
    const pre = calls.find((c) => c[0] === 'user.rpc');
    expect(pre[3]).toBe('Bearer jwt-del-dev');
    expect(pre[2]).toEqual({ p_target: TARGET, p_new_email: 'Nuevo@X.com', p_reason: 'ya no tiene acceso a su correo' });
  });
});

describe('admin-change-user-email: simulación (dry_run)', () => {
  it('valida y devuelve el aviso de proyectos, sin auditar ni cambiar el correo', async () => {
    const { handler, calls } = setup();
    const res = await handler(req({ ...valid, dry_run: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      dry_run: true,
      old_email: 'viejo@x.com',
      new_email: 'nuevo@x.com',
      projects_with_old_email: 2,
    });
    expect(names(calls)).toEqual(['getUser', 'user:admin_email_change_precheck']);
    expect(calls.some((c) => c[0] === 'updateUserById')).toBe(false);
  });
});

describe('admin-change-user-email: cambio real y auditoría del dev', () => {
  it('orden: precheck -> REQUESTED -> updateUserById -> EMAIL_CHANGE', async () => {
    const { handler, calls } = setup();
    const res = await handler(req(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      request_id: REQUEST_ID,
      old_email: 'viejo@x.com',
      new_email: 'nuevo@x.com',
      projects_with_old_email: 2,
    });
    expect(names(calls)).toEqual([
      'getUser',
      'user:admin_email_change_precheck',
      'admin_email_change_audit:EMAIL_CHANGE_REQUESTED',
      'updateUserById',
      'admin_email_change_audit:EMAIL_CHANGE',
    ]);
  });

  it('usa el correo NORMALIZADO por la base y lo marca confirmado', async () => {
    const { handler, calls } = setup();
    await handler(req(valid)); // el cliente mandó "Nuevo@X.com "
    const upd = calls.find((c) => c[0] === 'updateUserById');
    expect(upd[1]).toBe(TARGET);
    expect(upd[2]).toEqual({ email: 'nuevo@x.com', email_confirm: true });
  });

  it('el actor auditado es el del JWT, aunque el cuerpo intente suplantar a otro', async () => {
    const { handler, calls } = setup();
    await handler(req({ ...valid, actor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', p_actor: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }));
    const audits = calls.filter((c) => c[0] === 'service.rpc').map((c) => c[2]);
    expect(audits).toHaveLength(2);
    for (const a of audits) {
      expect(a.p_actor).toBe(ACTOR);
      expect(a.p_target).toBe(TARGET);
      expect(a.p_old_email).toBe('viejo@x.com');
      expect(a.p_new_email).toBe('nuevo@x.com');
      expect(a.p_reason).toBe('ya no tiene acceso a su correo');
      expect(a.p_request_id).toBe(REQUEST_ID);
      expect(a.p_meta).toMatchObject({ ip: '203.0.113.9', user_agent: 'UA-Test/1.0', source: 'admin-change-user-email' });
    }
  });

  it('si no se puede auditar la solicitud, NO se cambia el correo (sin rastro no hay cambio)', async () => {
    const { handler, calls, log } = setup({
      audit: (a) => (a.p_event === 'EMAIL_CHANGE_REQUESTED' ? { error: { message: 'boom' } } : { error: null }),
    });
    const res = await handler(req(valid));
    expect(res.status).toBe(500);
    expect(calls.some((c) => c[0] === 'updateUserById')).toBe(false);
    expect(log.error).toHaveBeenCalled();
  });

  it('si la Admin API falla: audita EMAIL_CHANGE_FAILED, responde 502 y no audita EMAIL_CHANGE', async () => {
    const { handler, calls } = setup({ update: { error: { message: 'upstream down' } } });
    const res = await handler(req(valid));
    expect(res.status).toBe(502);
    expect((await res.json()).request_id).toBe(REQUEST_ID);
    expect(names(calls).slice(-2)).toEqual(['updateUserById', 'admin_email_change_audit:EMAIL_CHANGE_FAILED']);
    expect(names(calls)).not.toContain('admin_email_change_audit:EMAIL_CHANGE');
    const failed = calls.filter((c) => c[0] === 'service.rpc').at(-1)[2];
    expect(failed.p_meta.error).toBe('upstream down');
  });

  it('si el correo ya está registrado en Auth: 409', async () => {
    const { handler } = setup({ update: { error: { message: 'A user with this email address has already been registered' } } });
    expect((await handler(req(valid))).status).toBe(409);
  });

  it('si el cambio ya ocurrió pero falla la auditoría final: responde 200 y avisa audit_recorded=false', async () => {
    const { handler, log } = setup({
      audit: (a) => (a.p_event === 'EMAIL_CHANGE' ? { error: { message: 'boom' } } : { error: null }),
    });
    const res = await handler(req(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, audit_recorded: false });
    expect(log.error).toHaveBeenCalled();
  });

  it('las respuestas llevan CORS solo para orígenes permitidos', async () => {
    const { handler } = setup();
    const res = await handler(req(valid, { headers: { Origin: ORIGIN } }));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const other = await handler(req(valid, { headers: { Origin: 'https://malo.example.com' } }));
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
