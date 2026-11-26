-- Capa de PRODUCCIÓN (yhmhpxwnxcbpouyoxarr) que vive solo en la base, reconstruida de lo medido en el inventario de solo lectura
-- del 2026-11-25: funciones private.*, políticas RLS optimizadas por conjuntos, permisos y triggers.
-- Se aplica sobre el esquema del repo (20261019150000 + 20261024120000) para ensayar la cadena de migraciones nuevas
-- en un estado equivalente al de producción. SOLO base local.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Columna que producción tiene y el esquema del repo no (la usan projects_insert/projects_select)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- ----- Funciones private.* -----
CREATE OR REPLACE FUNCTION private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select exists (
    select 1 from public.user_profiles up
    where up.id = (select auth.uid()) and up.role = 'admin' and coalesce(up.is_active, true)
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select exists (
    select 1 from public.user_profiles up
    where up.id = (select auth.uid()) and up.role in ('admin','technician') and coalesce(up.is_active, true)
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_read_project(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select private.is_admin() or exists (
    select 1
    from public.project_access pa
    join public.user_profiles up on up.id = pa.user_id
    where pa.project_id = p and pa.user_id = (select auth.uid()) and coalesce(up.is_active, true)
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_write_project(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select private.is_admin() or exists (
    select 1
    from public.project_access pa
    join public.user_profiles up on up.id = pa.user_id
    where pa.project_id = p and pa.user_id = (select auth.uid())
      and up.role in ('technician','service_ai') and coalesce(up.is_active, true)
  );
$function$;

CREATE OR REPLACE FUNCTION private.project_id_of_blade(b uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select t.project_id from public.blades bl join public.turbines t on t.id = bl.turbine_id where bl.id = b
$function$;

CREATE OR REPLACE FUNCTION private.project_id_of_capture(c uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select t.project_id
  from public.captures cp
  join public.blades bl on bl.id = cp.blade_id
  join public.turbines t on t.id = bl.turbine_id
  where cp.id = c
$function$;

CREATE OR REPLACE FUNCTION private.project_id_of_turbine(t uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$ select project_id from public.turbines where id = t $function$;

CREATE OR REPLACE FUNCTION private.can_read_image(obj text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select private.is_admin()
    or exists (select 1 from public.captures c
               where c.storage_path = obj
                 and private.can_read_project(private.project_id_of_blade(c.blade_id)))
    or exists (select 1 from public.turbines t
               where t.id_image_path = obj and private.can_read_project(t.project_id));
$function$;

CREATE OR REPLACE FUNCTION private.readable_project_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select p.id from public.projects p where private.is_admin()
  union
  select pa.project_id
  from public.project_access pa
  join public.user_profiles up on up.id = pa.user_id
  where pa.user_id = (select auth.uid()) and coalesce(up.is_active, true)
$function$;

CREATE OR REPLACE FUNCTION private.writable_project_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select p.id from public.projects p where private.is_admin()
  union
  select pa.project_id
  from public.project_access pa
  join public.user_profiles up on up.id = pa.user_id
  where pa.user_id = (select auth.uid())
    and up.role in ('technician','service_ai') and coalesce(up.is_active, true)
$function$;

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p WHERE p.pronamespace = 'private'::regnamespace LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END $$;

-- ----- Funciones public (versión de producción) -----
CREATE OR REPLACE FUNCTION public.get_current_user_role() RETURNS access_role_enum LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  current_role access_role_enum;
BEGIN
  SELECT role INTO current_role FROM public.user_profiles WHERE id = auth.uid();
  RETURN current_role;
EXCEPTION WHEN OTHERS THEN
  RETURN 'client'::access_role_enum;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_project_write_permission(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_access
        WHERE project_id = p_id AND user_id = auth.uid() AND role IN ('technician', 'admin', 'service_ai')
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'client'::access_role_enum);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creando user_profile para %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid, new_role access_role_enum) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only admins can update roles';
  END IF;
  UPDATE public.user_profiles SET role = new_role, updated_at = NOW() WHERE id = target_user_id;
  RETURN TRUE;
END;
$function$;

-- ----- Triggers de producción fuera del repo -----
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_sync_project_relations ON public.projects;
CREATE TRIGGER trg_sync_project_relations AFTER INSERT OR UPDATE OF client, wind_farm, park_manager_email, technical_lead_email, review_personnel_email
  ON public.projects FOR EACH ROW EXECUTE FUNCTION public.sync_project_relations();

-- ----- RLS activo en las 15 tablas -----
ALTER TABLE public."app-releases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turbines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wind_farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wind_turbines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."wtgmFile" ENABLE ROW LEVEL SECURITY;

-- ----- Permisos de tabla (producción: authenticated con lo mínimo; anon solo lee app-releases) -----
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON TABLE public."app-releases" TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."app-releases" TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.blades TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.captures TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.companies TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.findings TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.instruments TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.pilots TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.project_access TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.project_farms TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.projects TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.turbines TO authenticated;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.wind_farms TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.wind_turbines TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."wtgmFile" TO authenticated;

-- ----- Políticas de producción (volcado de pg_policies) -----
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY releases_admin_write ON public."app-releases" AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY releases_select ON public."app-releases" AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY blades_delete ON public.blades AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM turbines t WHERE t.id = blades.turbine_id AND t.project_id IN (SELECT private.writable_project_ids())));
CREATE POLICY blades_insert ON public.blades AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM turbines t WHERE t.id = blades.turbine_id AND t.project_id IN (SELECT private.writable_project_ids())));
CREATE POLICY blades_select ON public.blades AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM turbines t WHERE t.id = blades.turbine_id AND t.project_id IN (SELECT private.readable_project_ids())));
CREATE POLICY blades_update ON public.blades AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM turbines t WHERE t.id = blades.turbine_id AND t.project_id IN (SELECT private.writable_project_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM turbines t WHERE t.id = blades.turbine_id AND t.project_id IN (SELECT private.writable_project_ids())));

CREATE POLICY captures_delete ON public.captures AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM blades b JOIN turbines t ON t.id = b.turbine_id WHERE b.id = captures.blade_id AND t.project_id IN (SELECT private.writable_project_ids())));
CREATE POLICY captures_insert ON public.captures AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM blades b JOIN turbines t ON t.id = b.turbine_id WHERE b.id = captures.blade_id AND t.project_id IN (SELECT private.writable_project_ids())));
CREATE POLICY captures_select ON public.captures AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM blades b JOIN turbines t ON t.id = b.turbine_id WHERE b.id = captures.blade_id AND t.project_id IN (SELECT private.readable_project_ids())));
CREATE POLICY captures_update ON public.captures AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM blades b JOIN turbines t ON t.id = b.turbine_id WHERE b.id = captures.blade_id AND t.project_id IN (SELECT private.writable_project_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM blades b JOIN turbines t ON t.id = b.turbine_id WHERE b.id = captures.blade_id AND t.project_id IN (SELECT private.writable_project_ids())));

CREATE POLICY companies_admin_write ON public.companies AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY companies_select ON public.companies AS PERMISSIVE FOR SELECT TO authenticated USING (private.is_staff());

CREATE POLICY findings_delete ON public.findings AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM captures c JOIN blades b ON b.id = c.blade_id JOIN turbines t ON t.id = b.turbine_id WHERE c.id = findings.capture_id AND t.project_id IN (SELECT private.writable_project_ids())));
CREATE POLICY findings_insert ON public.findings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM captures c JOIN blades b ON b.id = c.blade_id JOIN turbines t ON t.id = b.turbine_id WHERE c.id = findings.capture_id AND t.project_id IN (SELECT private.writable_project_ids())));
CREATE POLICY findings_select ON public.findings AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM captures c JOIN blades b ON b.id = c.blade_id JOIN turbines t ON t.id = b.turbine_id WHERE c.id = findings.capture_id AND t.project_id IN (SELECT private.readable_project_ids())));
CREATE POLICY findings_update ON public.findings AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM captures c JOIN blades b ON b.id = c.blade_id JOIN turbines t ON t.id = b.turbine_id WHERE c.id = findings.capture_id AND t.project_id IN (SELECT private.writable_project_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM captures c JOIN blades b ON b.id = c.blade_id JOIN turbines t ON t.id = b.turbine_id WHERE c.id = findings.capture_id AND t.project_id IN (SELECT private.writable_project_ids())));

CREATE POLICY instruments_admin_write ON public.instruments AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY instruments_select ON public.instruments AS PERMISSIVE FOR SELECT TO authenticated USING (private.is_staff());
CREATE POLICY pilots_admin_write ON public.pilots AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY pilots_select ON public.pilots AS PERMISSIVE FOR SELECT TO authenticated
  USING (lower(email) = lower((SELECT auth.jwt() ->> 'email')) OR private.is_staff());

CREATE POLICY access_admin_delete ON public.project_access AS PERMISSIVE FOR DELETE TO authenticated USING (private.is_admin());
CREATE POLICY access_admin_insert ON public.project_access AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY access_admin_update ON public.project_access AS PERMISSIVE FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY access_select ON public.project_access AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR private.is_admin());

CREATE POLICY pfarms_admin_write ON public.project_farms AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY pfarms_select ON public.project_farms AS PERMISSIVE FOR SELECT TO authenticated USING (private.can_read_project(project_id));

CREATE POLICY projects_delete ON public.projects AS PERMISSIVE FOR DELETE TO authenticated USING (private.is_admin());
CREATE POLICY projects_insert ON public.projects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.is_staff() AND (created_by = (SELECT auth.uid()) OR private.is_admin()));
CREATE POLICY projects_select ON public.projects AS PERMISSIVE FOR SELECT TO authenticated
  USING (id IN (SELECT private.readable_project_ids()) OR created_by = (SELECT auth.uid()));
CREATE POLICY projects_update ON public.projects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (id IN (SELECT private.writable_project_ids())) WITH CHECK (id IN (SELECT private.writable_project_ids()));

CREATE POLICY turbines_delete ON public.turbines AS PERMISSIVE FOR DELETE TO authenticated USING (project_id IN (SELECT private.writable_project_ids()));
CREATE POLICY turbines_insert ON public.turbines AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (project_id IN (SELECT private.writable_project_ids()));
CREATE POLICY turbines_select ON public.turbines AS PERMISSIVE FOR SELECT TO authenticated USING (project_id IN (SELECT private.readable_project_ids()));
CREATE POLICY turbines_update ON public.turbines AS PERMISSIVE FOR UPDATE TO authenticated
  USING (project_id IN (SELECT private.writable_project_ids())) WITH CHECK (project_id IN (SELECT private.writable_project_ids()));

CREATE POLICY profiles_select ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (id = (SELECT auth.uid()) OR private.is_admin());
CREATE POLICY profiles_update ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR private.is_admin()) WITH CHECK (id = (SELECT auth.uid()) OR private.is_admin());

CREATE POLICY farms_admin_write ON public.wind_farms AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY farms_select ON public.wind_farms AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.is_staff() OR EXISTS (SELECT 1 FROM project_farms pf WHERE pf.farm_id = wind_farms.id AND private.can_read_project(pf.project_id)));
CREATE POLICY wturb_admin_write ON public.wind_turbines AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY wturb_select ON public.wind_turbines AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.is_staff() OR EXISTS (SELECT 1 FROM project_farms pf WHERE pf.farm_id = wind_turbines.farm_id AND private.can_read_project(pf.project_id)));

CREATE POLICY "wtgmFile admin all" ON public."wtgmFile" AS PERMISSIVE FOR ALL TO authenticated
  USING (get_current_user_role() = 'admin'::access_role_enum) WITH CHECK (get_current_user_role() = 'admin'::access_role_enum);
CREATE POLICY "wtgmFile read authenticated" ON public."wtgmFile" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
