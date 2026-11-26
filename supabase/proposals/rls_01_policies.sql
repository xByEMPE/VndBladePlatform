-- PROPUESTA (no aplicada) · RLS paso 1: funciones y políticas.
-- Es seguro ejecutarlo mientras las tablas sigan SIN RLS: no cambia el comportamiento actual de la app.
-- El paso 2 (rls_02_enable.sql) es el que activa RLS tabla por tabla.
--
-- Modelo de acceso:
--   admin               -> acceso total (rol global en user_profiles.role)
--   technician/service_ai -> ven y escriben solo en proyectos asignados (project_access)
--   client              -> solo lectura de proyectos asignados (project_access)

-- 1) Funciones auxiliares ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.user_profiles WHERE id = auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role IN ('admin', 'technician', 'service_ai') FROM public.user_profiles WHERE id = auth.uid()), false)
$$;

-- Antes: solo miraba project_access, por lo que un admin sin fila ahí no podía escribir.
CREATE OR REPLACE FUNCTION public.check_project_write_permission(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.project_access
    WHERE project_id = p_id AND user_id = auth.uid()
      AND role IN ('technician', 'admin', 'service_ai')
  )
$$;

REVOKE ALL ON FUNCTION public.is_admin(), public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.is_staff() TO authenticated;

-- 2) Lectura: se agrega el bypass de admin a las políticas existentes ----------------------
DROP POLICY IF EXISTS "View projects with access" ON public.projects;
CREATE POLICY "View projects with access" ON public.projects FOR SELECT USING (
  (SELECT public.is_admin()) OR EXISTS (
    SELECT 1 FROM public.project_access pa WHERE pa.project_id = projects.id AND pa.user_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "View turbines with access" ON public.turbines;
CREATE POLICY "View turbines with access" ON public.turbines FOR SELECT USING (
  (SELECT public.is_admin()) OR EXISTS (
    SELECT 1 FROM public.project_access pa WHERE pa.project_id = turbines.project_id AND pa.user_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "View blades with access" ON public.blades;
CREATE POLICY "View blades with access" ON public.blades FOR SELECT USING (
  (SELECT public.is_admin()) OR EXISTS (
    SELECT 1 FROM public.turbines t JOIN public.project_access pa ON pa.project_id = t.project_id
    WHERE t.id = blades.turbine_id AND pa.user_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "View captures with access" ON public.captures;
CREATE POLICY "View captures with access" ON public.captures FOR SELECT USING (
  (SELECT public.is_admin()) OR EXISTS (
    SELECT 1 FROM public.blades b
    JOIN public.turbines t ON t.id = b.turbine_id
    JOIN public.project_access pa ON pa.project_id = t.project_id
    WHERE b.id = captures.blade_id AND pa.user_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "View findings with access" ON public.findings;
CREATE POLICY "View findings with access" ON public.findings FOR SELECT USING (
  (SELECT public.is_admin()) OR EXISTS (
    SELECT 1 FROM public.captures c
    JOIN public.blades b ON b.id = c.blade_id
    JOIN public.turbines t ON t.id = b.turbine_id
    JOIN public.project_access pa ON pa.project_id = t.project_id
    WHERE c.id = findings.capture_id AND pa.user_id = (SELECT auth.uid()))
);

-- Las políticas "Editors can modify ..." ya usan check_project_write_permission, que ahora incluye a admin.

-- 3) Crear proyectos: solo admin (antes cualquier usuario autenticado, incluidos clientes) ----
DROP POLICY IF EXISTS "Authenticated can create projects" ON public.projects;
CREATE POLICY "Admins can create projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

-- 4) user_profiles / project_access: faltaban políticas para administración ----------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "View profiles" ON public.user_profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Update profiles" ON public.user_profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- Con la política anterior un usuario podía cambiar su propio "role" a admin.
-- El cambio de rol sigue disponible vía update_user_role() (SECURITY DEFINER).
REVOKE UPDATE ON public.user_profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, is_active) ON public.user_profiles TO authenticated;

DROP POLICY IF EXISTS "Users can see their own access" ON public.project_access;
CREATE POLICY "View project access" ON public.project_access FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY "Admins manage project access" ON public.project_access FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- 5) Catálogos: admin gestiona; el resto sigue viendo según acceso ---------------------------
CREATE POLICY "Admins manage companies" ON public.companies FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "View companies by project access" ON public.companies FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.wind_farms wf
          JOIN public.project_farms pf ON pf.farm_id = wf.id
          JOIN public.project_access pa ON pa.project_id = pf.project_id
          WHERE wf.company_id = companies.id AND pa.user_id = (SELECT auth.uid())));

CREATE POLICY "Admins manage wind farms" ON public.wind_farms FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admins manage wind turbines" ON public.wind_turbines FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admins manage project farms" ON public.project_farms FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "View project farms by access" ON public.project_farms FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_access pa
          WHERE pa.project_id = project_farms.project_id AND pa.user_id = (SELECT auth.uid())));

CREATE POLICY "Admins manage pilots" ON public.pilots FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Staff read instruments" ON public.instruments FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));
CREATE POLICY "Admins manage instruments" ON public.instruments FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- La app de vuelo consulta las versiones sin sesión: lectura pública, escritura solo admin.
CREATE POLICY "Public read app releases" ON public."app-releases" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage app releases" ON public."app-releases" FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- 6) Storage ---------------------------------------------------------------------------------
-- La política "permitir acceso S3 ..." da SELECT público a TODOS los buckets, incluido el privado wtgmFile.
ALTER POLICY "permitir acceso S3 1ffg0oo_0" ON storage.objects USING (bucket_id <> 'wtgmFile');

-- El bucket "images" no tiene políticas de escritura: las subidas desde la web con sesión fallan.
CREATE POLICY "images staff insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND (SELECT public.is_staff()));
CREATE POLICY "images staff update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'images' AND (SELECT public.is_staff()))
  WITH CHECK (bucket_id = 'images' AND (SELECT public.is_staff()));
CREATE POLICY "images admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND (SELECT public.is_admin()));

CREATE POLICY "admin manage release buckets" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('app-releases', 'pc_releases', 'certificates') AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id IN ('app-releases', 'pc_releases', 'certificates') AND (SELECT public.is_admin()));
