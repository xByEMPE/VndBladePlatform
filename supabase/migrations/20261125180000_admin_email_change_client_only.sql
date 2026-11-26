-- El cambio de correo asistido por un dev solo aplica a cuentas con rol `client`.
--
-- Por qué: technician, admin y dev gestionan su correo desde /profile. Esta vía asistida existe para los
-- clientes, que no pueden editarlo.
--
-- Qué cambia: SOLO admin_email_change_precheck (misma firma: CREATE OR REPLACE, sin DROP). Se agrega la
-- comprobación del rol del objetivo. Todo lo demás queda igual (dev activo, no uno mismo, no el Master,
-- motivo, correo válido/nuevo/libre, límite por hora, aviso de proyectos).
--
-- Se aplica la regla en la BASE (no solo en la interfaz): aunque alguien llame a la Edge Function a mano, la
-- base rechaza a objetivos que no sean client (la función responde 403 con el mensaje).
--
-- Orden de las comprobaciones: dev activo -> no es uno mismo -> existe -> no es el Master (mensaje propio) ->
-- ES client -> motivo -> formato -> igual -> reservado -> en uso -> límite.

CREATE OR REPLACE FUNCTION public.admin_email_change_precheck(
  p_target uuid,
  p_new_email text,
  p_reason text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  master_email constant text := 'enrique.hernandez@bo.vindgroup.com.mx';
  max_per_hour constant int := 10;
  v_actor    uuid := auth.uid();
  v_new      text := lower(btrim(coalesce(p_new_email, '')));
  v_old      text;
  v_role     text;
  v_recent   int;
  v_projects int;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_dev()) THEN
    RAISE EXCEPTION 'Access denied: only active dev users can change emails'
      USING ERRCODE = '42501';
  END IF;

  IF p_target = v_actor THEN
    RAISE EXCEPTION 'Para cambiar tu propio correo usa tu perfil' USING ERRCODE = '42501';
  END IF;

  SELECT u.email INTO v_old FROM auth.users AS u WHERE u.id = p_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF lower(coalesce(v_old, '')) = master_email THEN
    RAISE EXCEPTION 'El correo del Master Dev esta protegido y no puede cambiarse'
      USING ERRCODE = '42501';
  END IF;

  -- NUEVO: solo cuentas client (technician, admin y dev usan /profile)
  SELECT up.role::text INTO v_role FROM public.user_profiles AS up WHERE up.id = p_target;
  IF v_role IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION 'Solo se puede cambiar el correo de cuentas client por esta via'
      USING ERRCODE = '42501';
  END IF;

  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'El motivo es obligatorio (minimo 5 caracteres)' USING ERRCODE = '22023';
  END IF;

  IF length(v_new) > 254 OR v_new !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Correo nuevo invalido' USING ERRCODE = '22023';
  END IF;

  IF v_new = lower(coalesce(v_old, '')) THEN
    RAISE EXCEPTION 'El correo nuevo es igual al actual' USING ERRCODE = '22023';
  END IF;

  IF v_new = master_email THEN
    RAISE EXCEPTION 'Ese correo esta reservado para el Master Dev' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users AS u WHERE lower(u.email) = v_new) THEN
    RAISE EXCEPTION 'Ese correo ya esta en uso por otra cuenta' USING ERRCODE = '23505';
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.audit_logs AS l
  WHERE l.user_id = v_actor
    AND l.action = 'EMAIL_CHANGE'
    AND l.created_at > now() - interval '1 hour';
  IF v_recent >= max_per_hour THEN
    RAISE EXCEPTION 'Limite de cambios de correo por hora alcanzado' USING ERRCODE = '53400';
  END IF;

  SELECT count(*) INTO v_projects
  FROM public.projects AS p
  WHERE lower(p.park_manager_email) = lower(v_old)
     OR lower(p.technical_lead_email) = lower(v_old)
     OR lower(p.review_personnel_email) = lower(v_old)
     OR p.staff_list::text ILIKE '%' || replace(replace(replace(v_old, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN jsonb_build_object(
    'ok', true,
    'target_id', p_target,
    'old_email', v_old,
    'new_email', v_new,
    'projects_with_old_email', v_projects
  );
END;
$function$;

-- Los permisos ya están definidos por la migración 20261125170000 y CREATE OR REPLACE los conserva
-- (EXECUTE solo para authenticated; la función exige dev activo).
