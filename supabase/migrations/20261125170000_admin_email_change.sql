-- Cambio de correo asistido por un `dev` (Edge Function `admin-change-user-email`).
--
-- Piezas:
--   1) private.protect_master_email  + trigger BEFORE UPDATE OF email ON auth.users
--        Nadie (ni un dev, ni el propio Master, ni el SQL Editor) puede cambiar el correo del Master Dev,
--        ni tomar su correo para otra cuenta.
--   2) public.admin_email_change_precheck(p_target, p_new_email, p_reason)
--        Se invoca con el JWT del dev que pidió el cambio. Valida TODO en la base: dev activo, usuario existe,
--        no es el Master, correo válido/nuevo/libre, motivo, límite por hora. Devuelve cuántos proyectos
--        mencionan el correo anterior (para avisar en la interfaz).
--   3) public.admin_email_change_audit(...)
--        Escribe en audit_logs qué dev ejecutó el cambio. SOLO la puede ejecutar service_role (la Edge
--        Function); verifica de nuevo que el actor sea un dev activo. service_role no tiene permisos
--        directos sobre audit_logs: esta función es la única vía.
--
-- Seguridad: SECURITY DEFINER con search_path fijo; REVOKE a PUBLIC/anon en todo; el Master Dev se identifica
-- por la misma constante que usan update_user_role y guard_user_profile_update.

-- ============================== 1) Protección del Master Dev en Auth ==============================
CREATE OR REPLACE FUNCTION private.protect_master_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  master_email constant text := 'enrique.hernandez@bo.vindgroup.com.mx';
BEGIN
  IF NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;

  IF lower(coalesce(OLD.email, '')) = master_email THEN
    RAISE EXCEPTION 'El correo del Master Dev esta protegido y no puede cambiarse'
      USING ERRCODE = '42501';
  END IF;

  IF lower(coalesce(NEW.email, '')) = master_email THEN
    RAISE EXCEPTION 'Ese correo esta reservado para el Master Dev'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.protect_master_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_master_email ON auth.users;
CREATE TRIGGER protect_master_email
  BEFORE UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_master_email();

-- ============================== 2) Validación previa (con el JWT del dev) ==============================
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
  v_recent   int;
  v_projects int;
BEGIN
  -- Solo un dev ACTIVO (la misma regla que update_user_role)
  IF v_actor IS NULL OR NOT (SELECT private.is_dev()) THEN
    RAISE EXCEPTION 'Access denied: only active dev users can change emails'
      USING ERRCODE = '42501';
  END IF;

  -- Esta vía es para cuentas AJENAS: el propio correo se cambia desde /profile (con confirmación)
  IF p_target = v_actor THEN
    RAISE EXCEPTION 'Para cambiar tu propio correo usa tu perfil' USING ERRCODE = '42501';
  END IF;

  SELECT u.email INTO v_old FROM auth.users AS u WHERE u.id = p_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Nadie cambia el correo del Master Dev (ni él mismo desde esta vía)
  IF lower(coalesce(v_old, '')) = master_email THEN
    RAISE EXCEPTION 'El correo del Master Dev esta protegido y no puede cambiarse'
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

  -- Límite por dev y hora (cuenta los cambios YA ejecutados)
  SELECT count(*) INTO v_recent
  FROM public.audit_logs AS l
  WHERE l.user_id = v_actor
    AND l.action = 'EMAIL_CHANGE'
    AND l.created_at > now() - interval '1 hour';
  IF v_recent >= max_per_hour THEN
    RAISE EXCEPTION 'Limite de cambios de correo por hora alcanzado' USING ERRCODE = '53400';
  END IF;

  -- Proyectos que mencionan el correo anterior como texto (no se actualizan solos)
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

REVOKE ALL ON FUNCTION public.admin_email_change_precheck(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_email_change_precheck(uuid, text, text) TO authenticated;

-- ============================== 3) Auditoría del cambio (solo service_role) ==============================
CREATE OR REPLACE FUNCTION public.admin_email_change_audit(
  p_actor      uuid,
  p_event      text,
  p_target     uuid,
  p_old_email  text,
  p_new_email  text,
  p_reason     text,
  p_request_id uuid,
  p_meta       jsonb DEFAULT '{}'::jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_role  text;
  v_email text;
BEGIN
  IF p_event NOT IN ('EMAIL_CHANGE_REQUESTED', 'EMAIL_CHANGE', 'EMAIL_CHANGE_FAILED') THEN
    RAISE EXCEPTION 'Evento de auditoria no valido: %', p_event USING ERRCODE = '22023';
  END IF;

  -- Defensa en profundidad: el actor debe ser un dev activo
  SELECT up.role::text, up.email INTO v_role, v_email
  FROM public.user_profiles AS up
  WHERE up.id = p_actor AND up.role::text = 'dev' AND coalesce(up.is_active, true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El actor no es un dev activo' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_logs (user_id, user_role, action, table_name, record_id, old_data, new_data, metadata)
  VALUES (
    p_actor,
    v_role,
    p_event,
    'auth.users',
    p_target::text,
    jsonb_build_object('email', p_old_email),
    jsonb_build_object('email', p_new_email),
    jsonb_strip_nulls(
      coalesce(p_meta, '{}'::jsonb)
      || jsonb_build_object(
           'actor_email', v_email,
           'target_email', p_old_email,
           'reason', left(btrim(coalesce(p_reason, '')), 300),
           'request_id', p_request_id,
           'txid', txid_current()
         )
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_email_change_audit(uuid, text, uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_email_change_audit(uuid, text, uuid, text, text, text, uuid, jsonb) TO service_role;
