-- El rol `admin` gestiona usuarios como un dev que NO es el Master Dev.
--
-- Qué puede hacer un admin (igual que un dev no Master), con estas excepciones decididas:
--   - cambiar el rol de client, technician y OTROS admin (nunca asignar `dev`, nunca su propio rol, nunca la fila del Master)
--   - activar/desactivar cuentas que NO son dev (nunca la propia)
--   - cambiar el correo de cuentas client por la vía asistida (Edge Function), con motivo y auditoría
--   - NO toca ninguna cuenta `dev` (ni rol, ni estado, ni correo). Auditoría y Registros sigue solo para dev.
--
-- Piezas (todas CREATE OR REPLACE con la misma firma; no se tocan triggers, políticas ni permisos de tabla):
--   1) public.update_user_role: la puede llamar un admin o dev activo (o el Master); agrega las reglas de arriba.
--      Se agrega también en la base "nadie cambia su propio rol" (hoy solo lo exigía la interfaz).
--   2) private.guard_user_profile_update: el cambio de is_active lo puede hacer un admin sobre cuentas no dev y ajenas.
--      Los cambios que hacen las funciones SECURITY DEFINER (update_user_role) corren como el dueño de la función
--      (current_user distinto de authenticated): sus reglas viven en la propia función. Las escrituras directas por la
--      API (rol authenticated) siguen limitadas: un no-dev solo toca full_name, email, avatar_url, updated_at e, siendo
--      admin, is_active.
--   3) public.admin_email_change_precheck y public.admin_email_change_audit: aceptan un admin o dev activo como actor.
--      La Edge Function no cambia: toda la regla vive en la base.

-- ============================== 1) update_user_role ==============================
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid, new_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  master_email constant text := 'enrique.hernandez@bo.vindgroup.com.mx';
  caller_email text := lower(coalesce((SELECT auth.jwt() ->> 'email'), ''));
  caller_is_master boolean := (lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'enrique.hernandez@bo.vindgroup.com.mx');
  caller_is_dev boolean := (SELECT private.is_dev());
  target_email text;
  target_role text;
BEGIN
  -- El Master Dev puede operar aunque se haya cambiado temporalmente a otro rol; el resto: admin o dev activos
  IF NOT caller_is_master AND NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only active admin or dev users can update roles'
      USING ERRCODE = '42501';
  END IF;

  IF new_role IS NULL
     OR new_role NOT IN ('dev', 'admin', 'technician', 'client')
  THEN
    RAISE EXCEPTION 'Invalid role: %', new_role
      USING ERRCODE = '22023';
  END IF;

  -- Solo el Master Dev puede asignar 'dev'
  IF new_role = 'dev' AND NOT caller_is_master THEN
    RAISE EXCEPTION 'Solo % puede asignar el rol dev', master_email
      USING ERRCODE = '42501';
  END IF;

  SELECT lower(email), role::text INTO target_email, target_role
  FROM public.user_profiles
  WHERE id = target_user_id;

  -- La fila del Master Dev solo la puede modificar él mismo
  IF target_email = master_email AND NOT caller_is_master THEN
    RAISE EXCEPTION 'El rol de % esta protegido', master_email
      USING ERRCODE = '42501';
  END IF;

  -- Nadie (salvo el Master) cambia su propio rol
  IF NOT caller_is_master AND target_user_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol'
      USING ERRCODE = '42501';
  END IF;

  -- Un admin (que no es dev) no toca cuentas dev
  IF NOT caller_is_master AND NOT caller_is_dev AND target_role = 'dev' THEN
    RAISE EXCEPTION 'Solo un dev puede cambiar el rol de una cuenta dev'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_profiles
  SET role = new_role::public.access_role_enum,
      updated_at = pg_catalog.now()
  WHERE id = target_user_id;

  RETURN FOUND;
END;
$function$;

-- ============================== 2) guard_user_profile_update ==============================
CREATE OR REPLACE FUNCTION private.guard_user_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  master_email     constant text := 'enrique.hernandez@bo.vindgroup.com.mx';
  v_uid            uuid := (SELECT auth.uid());
  caller_is_master boolean := (lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'enrique.hernandez@bo.vindgroup.com.mx');
  -- Escritura directa por la API (PostgREST). Dentro de una función SECURITY DEFINER current_user es su dueño.
  v_api            boolean := (current_user IN ('authenticated', 'anon'));
BEGIN
  -- (1) Protección del Master Dev: solo él puede modificar su propia fila desde una sesión autenticada.
  IF v_uid IS NOT NULL
     AND lower(coalesce(OLD.email, '')) = master_email
     AND NOT caller_is_master
  THEN
    RAISE EXCEPTION 'No tienes permisos para modificar el perfil del Master Dev'
      USING ERRCODE = '42501';
  END IF;

  -- (N) Activar/desactivar cuentas dev: solo el Master Dev, y nunca la propia.
  IF v_uid IS NOT NULL
     AND OLD.is_active IS DISTINCT FROM NEW.is_active
     AND OLD.role::text = 'dev'
  THEN
    IF OLD.id = v_uid THEN
      RAISE EXCEPTION 'Nadie puede desactivar su propia cuenta dev'
        USING ERRCODE = '42501';
    END IF;
    IF NOT caller_is_master THEN
      RAISE EXCEPTION 'Solo el Master Dev puede activar o desactivar cuentas dev'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- (2) Escritura directa de un no-dev: solo campos no protegidos, más is_active si es admin (sobre cuentas ajenas).
  IF v_uid IS NOT NULL
     AND v_api
     AND NOT (SELECT private.is_dev())
  THEN
    IF (to_jsonb(NEW) - ARRAY['full_name', 'email', 'avatar_url', 'updated_at', 'is_active']::text[])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['full_name', 'email', 'avatar_url', 'updated_at', 'is_active']::text[])
    THEN
      RAISE EXCEPTION 'Only active dev users may change protected profile fields'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      IF NOT (SELECT private.is_admin()) THEN
        RAISE EXCEPTION 'Only active admin or dev users may activate or deactivate accounts'
          USING ERRCODE = '42501';
      END IF;
      IF OLD.id = v_uid THEN
        RAISE EXCEPTION 'Nadie puede desactivar su propia cuenta'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================== 3) Cambio de correo asistido ==============================
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
  -- Admin o dev ACTIVO
  IF v_actor IS NULL OR NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only active admin or dev users can change emails'
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

  -- Solo cuentas client (technician, admin y dev tienen su correo administrado aparte)
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

  -- Defensa en profundidad: el actor debe ser un admin o dev activo
  SELECT up.role::text, up.email INTO v_role, v_email
  FROM public.user_profiles AS up
  WHERE up.id = p_actor AND up.role::text IN ('admin', 'dev') AND coalesce(up.is_active, true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El actor no es un admin o dev activo' USING ERRCODE = '42501';
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
