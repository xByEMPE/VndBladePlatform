-- Copia a public.user_profiles el nuevo correo cuando auth.users.email cambia (al confirmar el cambio).
-- SECURITY DEFINER: no depende de los permisos de columna de authenticated.
-- Compatible con private.guard_user_profile_update(): sin sesión (GoTrue) auth.uid() es NULL y pasa;
-- con sesión propia, email y updated_at son campos permitidos para cualquier usuario.
CREATE OR REPLACE FUNCTION private.sync_user_profile_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.user_profiles
    SET email = NEW.email,
        updated_at = pg_catalog.now()
    WHERE id = NEW.id
      AND email IS DISTINCT FROM NEW.email;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_user_profile_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_user_profile_email();
