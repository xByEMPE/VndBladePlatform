-- Fase 1 de auditoría: eventos de autenticación en audit_logs.
--   LOGIN            = nueva fila en auth.sessions (IP y navegador del login)
--   LOGOUT           = fila borrada de auth.sessions (cierre manual, expiración o limpieza)
--   PASSWORD_CHANGE  = cambió encrypted_password (solo el evento; NUNCA el hash)
-- No se copian tokens ni claves. Los intentos fallidos NO se guardan aquí (ruido y falsificables);
-- para eso están los logs de Auth del panel de Supabase.
CREATE OR REPLACE FUNCTION private.audit_auth_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id    uuid;
  v_role       text;
  v_email      text;
  v_action     text;
  v_record_id  text;
  v_old        jsonb;
  v_new        jsonb;
  v_meta       jsonb;
BEGIN
  IF TG_TABLE_NAME = 'sessions' THEN
    v_user_id   := coalesce(NEW.user_id, OLD.user_id);
    v_record_id := coalesce(NEW.id, OLD.id)::text;
    IF TG_OP = 'INSERT' THEN
      v_action := 'LOGIN';
      v_new  := jsonb_build_object('aal', NEW.aal, 'session_created_at', NEW.created_at);
      v_meta := jsonb_build_object('ip', host(NEW.ip), 'user_agent', NEW.user_agent, 'session_id', NEW.id);
    ELSE
      v_action := 'LOGOUT';
      v_old  := jsonb_build_object('aal', OLD.aal, 'session_created_at', OLD.created_at);
      v_meta := jsonb_build_object('ip', host(OLD.ip), 'user_agent', OLD.user_agent, 'session_id', OLD.id);
    END IF;
  ELSE
    IF NEW.encrypted_password IS NOT DISTINCT FROM OLD.encrypted_password THEN
      RETURN NEW;
    END IF;
    v_user_id   := NEW.id;
    v_record_id := NEW.id::text;
    v_action    := 'PASSWORD_CHANGE';
    -- IP/navegador aproximados: los de la sesión más reciente del usuario.
    SELECT jsonb_build_object('ip', host(s.ip), 'user_agent', s.user_agent, 'session_id', s.id)
    INTO v_meta
    FROM auth.sessions s
    WHERE s.user_id = NEW.id
    ORDER BY coalesce(s.refreshed_at, s.updated_at, s.created_at) DESC
    LIMIT 1;
  END IF;

  SELECT up.role::text, up.email INTO v_role, v_email
  FROM public.user_profiles AS up WHERE up.id = v_user_id;

  INSERT INTO public.audit_logs (user_id, user_role, action, table_name, record_id, old_data, new_data, metadata)
  VALUES (
    v_user_id,
    v_role,
    v_action,
    'auth.' || TG_TABLE_NAME,
    v_record_id,
    v_old,
    v_new,
    jsonb_strip_nulls(coalesce(v_meta, '{}'::jsonb) || jsonb_build_object('actor_email', v_email, 'txid', txid_current()))
  );

  RETURN coalesce(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION private.audit_auth_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_auth_session_insert ON auth.sessions;
CREATE TRIGGER audit_auth_session_insert
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION private.audit_auth_event();

DROP TRIGGER IF EXISTS audit_auth_session_delete ON auth.sessions;
CREATE TRIGGER audit_auth_session_delete
  AFTER DELETE ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION private.audit_auth_event();

DROP TRIGGER IF EXISTS audit_auth_password_change ON auth.users;
CREATE TRIGGER audit_auth_password_change
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.audit_auth_event();
