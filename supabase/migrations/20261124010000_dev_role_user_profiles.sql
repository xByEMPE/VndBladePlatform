-- Reconstruida desde la base de pruebas (tddtfhmkjlpbcqtahcgf): soporte del rol 'dev' en user_profiles.
-- Idempotente: se puede ejecutar sobre una base que ya tiene estos objetos sin cambiar su estado final.
--
-- Contenido:
--   1) esquema private y helpers de rol (is_dev, is_admin, is_staff)
--   2) user_profiles.allowed_modules
--   3) update_user_role: se elimina la sobrecarga con enum del esquema base (la versión vigente recibe text;
--      las migraciones 20261124110000 y 20261124120000 la crean/redefinen). Sin esto quedarían las dos y
--      PostgREST no sabría cuál usar.
--   4) RLS, políticas y permisos de user_profiles
--   5) trigger user_profiles_guard_update (primera versión de su función; 20261124130000 y 20261125190000 la
--      redefinen)

-- ============================== 1) private + helpers ==============================
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles AS up
    WHERE up.id = (SELECT auth.uid())
      AND up.role::text IN ('admin', 'dev')
      AND coalesce(up.is_active, true)
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_dev()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles AS up
    WHERE up.id = (SELECT auth.uid())
      AND up.role::text = 'dev'
      AND coalesce(up.is_active, true)
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles AS up
    WHERE up.id = (SELECT auth.uid())
      AND up.role::text IN ('admin', 'technician', 'dev')
      AND coalesce(up.is_active, true)
  );
$function$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_dev() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_dev() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated;

-- ============================== 2) allowed_modules ==============================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS allowed_modules jsonb NOT NULL
  DEFAULT '["progress", "reports-portal", "projects", "capture", "wtg-generator"]'::jsonb;

-- ============================== 3) update_user_role: sin la sobrecarga con enum ==============================
DROP FUNCTION IF EXISTS public.update_user_role(uuid, public.access_role_enum);

-- ============================== 4) RLS, políticas y permisos de user_profiles ==============================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS profiles_select ON public.user_profiles;
DROP POLICY IF EXISTS profiles_update ON public.user_profiles;

CREATE POLICY profiles_select ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT private.is_admin())
    OR (SELECT private.is_dev())
  );

CREATE POLICY profiles_update ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT private.is_admin())
    OR (SELECT private.is_dev())
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR (SELECT private.is_admin())
    OR (SELECT private.is_dev())
  );

-- Permisos: lectura completa y escritura solo por columnas (el esquema base daba ALL a anon/authenticated).
-- 20261124100000 amplía el UPDATE a updated_at, is_active y allowed_modules.
REVOKE ALL ON TABLE public.user_profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.user_profiles TO authenticated;

-- ============================== 5) Guarda de campos protegidos (primera versión) ==============================
CREATE OR REPLACE FUNCTION private.guard_user_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
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

DROP TRIGGER IF EXISTS user_profiles_guard_update ON public.user_profiles;
CREATE TRIGGER user_profiles_guard_update
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_user_profile_update();
