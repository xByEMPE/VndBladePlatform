-- Solo el Master Dev activa/desactiva cuentas `dev`; nadie desactiva su propia cuenta dev.
--
-- Qué cambia: SOLO private.guard_user_profile_update() (misma firma: CREATE OR REPLACE; el trigger
-- user_profiles_guard_update ya existe y no se toca). Se conservan las dos reglas actuales:
--   (1) solo el propio Master puede modificar la fila del Master desde una sesión autenticada
--   (2) un no-dev solo puede cambiar full_name, email, avatar_url y updated_at
-- y se agrega:
--   (N) si cambia is_active de una cuenta cuyo rol es 'dev' (desactivar O reactivar), debe hacerlo el Master Dev
--       y nunca sobre su propia cuenta. Mensajes distintos para cada caso.
--
-- La regla aplica a sesiones autenticadas (auth.uid() no nulo). SQL Editor / Dashboard / servicio (uid nulo)
-- quedan libres, igual que las reglas existentes. Los cambios de OTROS campos de una cuenta dev (p. ej. su nombre)
-- no se afectan. Desactivar o reactivar cuentas que NO son dev sigue como hoy.
--
-- Nota: el rol de la cuenta se lee de OLD.role; `role` no es una columna editable por authenticated (solo se
-- cambia con update_user_role), así que no se puede evadir cambiando rol y estado a la vez.

CREATE OR REPLACE FUNCTION private.guard_user_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  master_email     constant text := 'enrique.hernandez@bo.vindgroup.com.mx';
  v_uid            uuid := (SELECT auth.uid());
  caller_is_master boolean := (lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'enrique.hernandez@bo.vindgroup.com.mx');
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

  -- (2) Un no-dev solo puede cambiar campos no protegidos.
  IF v_uid IS NOT NULL
     AND NOT (SELECT private.is_dev())
     AND (
       (to_jsonb(NEW) - ARRAY['full_name', 'email', 'avatar_url', 'updated_at']::text[])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['full_name', 'email', 'avatar_url', 'updated_at']::text[])
     )
  THEN
    RAISE EXCEPTION 'Only active dev users may change protected profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
