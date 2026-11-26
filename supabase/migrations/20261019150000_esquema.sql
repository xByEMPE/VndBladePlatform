


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."access_role_enum" AS ENUM (
    'client',
    'technician',
    'admin',
    'service_ai'
);


ALTER TYPE "public"."access_role_enum" OWNER TO "postgres";


CREATE TYPE "public"."blade_position_enum" AS ENUM (
    'A',
    'B',
    'C'
);


ALTER TYPE "public"."blade_position_enum" OWNER TO "postgres";


CREATE TYPE "public"."capture_section_enum" AS ENUM (
    'LE',
    'TE',
    'SS',
    'PS',
    'Internal',
    'Reference',
    'Root',
    'Tip'
);


ALTER TYPE "public"."capture_section_enum" OWNER TO "postgres";


CREATE TYPE "public"."finding_severity_enum" AS ENUM (
    '1',
    '2',
    '3',
    '4',
    '5'
);


ALTER TYPE "public"."finding_severity_enum" OWNER TO "postgres";


CREATE TYPE "public"."finding_type_enum" AS ENUM (
    'damage',
    'anomaly',
    'maintenance',
    'feature'
);


ALTER TYPE "public"."finding_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."sequence_direction_enum" AS ENUM (
    'RootToTip',
    'TipToRoot',
    'Unknown'
);


ALTER TYPE "public"."sequence_direction_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_project_write_permission"("p_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_access 
        WHERE project_id = p_id 
        AND user_id = auth.uid() 
        AND role IN ('technician', 'admin', 'service_ai')
    );
END;
$$;


ALTER FUNCTION "public"."check_project_write_permission"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_role"() RETURNS "public"."access_role_enum"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_role access_role_enum;
BEGIN
  SELECT role INTO current_role
  FROM public.user_profiles
  WHERE id = auth.uid();
  
  RETURN current_role;
EXCEPTION WHEN OTHERS THEN
  RETURN 'client'::access_role_enum;
END;
$$;


ALTER FUNCTION "public"."get_current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_progress"("p_project_id" "uuid") RETURNS TABLE("turbine_id" "uuid", "completed_sections" integer, "total_images" integer, "blade_sections" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH raw_flags AS (
        SELECT
            b.turbine_id AS t_id,
            ('Blade ' || b.position) AS b_name, 
            c.section AS c_sec,
            c.id AS cap_id,
            -- Es START si tiene la etiqueta explícita (_S) O si es el PRIMER archivo alfabéticamente (ej. 0001)
            (c.storage_path ILIKE '%_START.JPG' OR c.storage_path ILIKE '%_S.JPG' OR 
             ROW_NUMBER() OVER(PARTITION BY b.turbine_id, b.position, c.section ORDER BY c.storage_path ASC) = 1) AS is_start,
             
            -- Es END si tiene la etiqueta explícita (_E) O si es el ÚLTIMO archivo alfabéticamente (ej. 0016)
            (c.storage_path ILIKE '%_END.JPG' OR c.storage_path ILIKE '%_E.JPG' OR 
             ROW_NUMBER() OVER(PARTITION BY b.turbine_id, b.position, c.section ORDER BY c.storage_path DESC) = 1) AS is_end
             
        FROM turbines t
        JOIN blades b ON t.id = b.turbine_id
        JOIN captures c ON b.id = c.blade_id
        WHERE t.project_id = p_project_id
    ),
    section_status AS (
        SELECT
            rf.t_id,
            rf.b_name,
            rf.c_sec,
            BOOL_OR(rf.is_start) AS has_start,
            BOOL_OR(rf.is_end) AS has_end,
            COUNT(rf.cap_id) AS image_count
        FROM raw_flags rf
        GROUP BY rf.t_id, rf.b_name, rf.c_sec
    ),
    valid_sections AS (
        -- Mantenemos tu regla estricta: Debe tener un inicio y un fin
        SELECT * FROM section_status WHERE has_start AND has_end
    ),
    blade_agg AS (
        SELECT
            vs.t_id,
            vs.b_name,
            jsonb_agg(vs.c_sec) AS sections_array
        FROM valid_sections vs
        GROUP BY vs.t_id, vs.b_name
    ),
    turbine_agg AS (
        SELECT
            vs2.t_id,
            COUNT(vs2.c_sec) AS comp_sections,
            SUM(vs2.image_count) AS tot_images,
            jsonb_object_agg(ba.b_name, ba.sections_array) AS b_sections
        FROM valid_sections vs2
        JOIN blade_agg ba ON vs2.t_id = ba.t_id AND vs2.b_name = ba.b_name
        GROUP BY vs2.t_id
    )
    SELECT
        t.id,
        COALESCE(ta.comp_sections, 0)::INT,
        COALESCE(ta.tot_images, 0)::INT,
        COALESCE(ta.b_sections, '{}'::JSONB)
    FROM turbines t
    LEFT JOIN turbine_agg ta ON t.id = ta.t_id
    WHERE t.project_id = p_project_id;
END;
$$;


ALTER FUNCTION "public"."get_project_progress"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_role access_role_enum;
BEGIN
  -- Determinar rol de forma segura
  BEGIN
    new_role := (NEW.raw_user_meta_data->>'role')::access_role_enum;
  EXCEPTION WHEN OTHERS THEN
    new_role := 'client'::access_role_enum;
  END;
  -- Si es nulo, usar default
  IF new_role IS NULL THEN
    new_role := 'client'::access_role_enum;
  END IF;
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'full_name',
    new_role
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Evitar bloquear la creación del usuario si falla el perfil, pero loguear error
  RAISE WARNING 'Error creando user_profile para %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_project_relations"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_project_id uuid;
begin
  v_project_id := new.id;

  -- 1) Sincroniza vínculo proyecto -> parque según catálogos (company + wind_farm)
  delete from public.project_farms
  where project_id = v_project_id;

  insert into public.project_farms (project_id, farm_id)
  select v_project_id, wf.id
  from public.companies c
  join public.wind_farms wf
    on wf.company_id = c.id
  where lower(trim(c.name)) = lower(trim(coalesce(new.client, '')))
    and lower(trim(wf.name)) = lower(trim(coalesce(new.wind_farm, '')))
  on conflict (project_id, farm_id) do nothing;

  -- 2) Sincroniza accesos por correos asignados en el proyecto
  insert into public.project_access (project_id, user_id)
  select v_project_id, up.id
  from public.user_profiles up
  where lower(trim(up.email)) = lower(trim(coalesce(new.park_manager_email, '')))
  on conflict (project_id, user_id) do nothing;

  insert into public.project_access (project_id, user_id)
  select v_project_id, up.id
  from public.user_profiles up
  where lower(trim(up.email)) = lower(trim(coalesce(new.technical_lead_email, '')))
  on conflict (project_id, user_id) do nothing;

  insert into public.project_access (project_id, user_id)
  select v_project_id, up.id
  from public.user_profiles up
  where lower(trim(up.email)) = lower(trim(coalesce(new.review_personnel_email, '')))
  on conflict (project_id, user_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_project_relations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."access_role_enum") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Verificar que quien llama es admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Only admins can update roles';
  END IF;
  UPDATE public.user_profiles
  SET role = new_role, updated_at = NOW()
  WHERE id = target_user_id;
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."access_role_enum") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app-releases" (
    "version_code" bigint NOT NULL,
    "version_name" "text" NOT NULL,
    "apk_url" "text",
    "release_notes" "text"
);


ALTER TABLE "public"."app-releases" OWNER TO "postgres";


COMMENT ON TABLE "public"."app-releases" IS 'app updates for vndfly.apk';



ALTER TABLE "public"."app-releases" ALTER COLUMN "version_code" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."app-releases_version_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."blades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turbine_id" "uuid" NOT NULL,
    "position" "public"."blade_position_enum" NOT NULL,
    "serial_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."captures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blade_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "measured_at" timestamp with time zone,
    "section" "text" NOT NULL,
    "gps_lat" double precision,
    "gps_lon" double precision,
    "gps_alt" double precision,
    "gimbal_pitch" double precision,
    "gimbal_roll" double precision,
    "gimbal_yaw" double precision,
    "lrf_dist_m" double precision,
    "sequence_dir" "text" DEFAULT 'Unknown'::"public"."sequence_direction_enum",
    "calculated_height_m" double precision,
    "mm_per_px" double precision,
    "telemetry" "jsonb" DEFAULT '{}'::"jsonb",
    "raw_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."captures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."findings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "capture_id" "uuid" NOT NULL,
    "type" "public"."finding_type_enum" DEFAULT 'damage'::"public"."finding_type_enum",
    "severity" "public"."finding_severity_enum",
    "confidence" double precision,
    "region" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "attributes" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "findings_confidence_check" CHECK ((("confidence" >= (0)::double precision) AND ("confidence" <= (1)::double precision)))
);


ALTER TABLE "public"."findings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."instruments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT 'Milióhmetro'::"text" NOT NULL,
    "serial_number" "text" NOT NULL,
    "calibration_date" "date" NOT NULL,
    "certificate_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."instruments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pilots" (
    "name" "text" NOT NULL,
    "license" character varying NOT NULL,
    "flight_hours" double precision,
    "email" "text"
);


ALTER TABLE "public"."pilots" OWNER TO "postgres";


COMMENT ON TABLE "public"."pilots" IS 'personal con licencias de pilotos RPAS';



COMMENT ON COLUMN "public"."pilots"."flight_hours" IS 'Horas de vuelo del piloto';



CREATE TABLE IF NOT EXISTS "public"."project_access" (
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."access_role_enum" DEFAULT 'client'::"public"."access_role_enum" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_farms" (
    "project_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_farms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "client" "text",
    "wind_farm" "text",
    "status" "text" DEFAULT 'Planeación'::"text",
    "turbine_count" integer DEFAULT 0,
    "park_manager" "text",
    "technical_lead" "text",
    "contractor" "text",
    "review_personnel" "text",
    "review_personnel_email" "text",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "staff_list" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "park_manager_email" "text",
    "technical_lead_email" "text",
    "turbine_model" "text",
    "lps_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "project_type" "text" DEFAULT 'DRONE'::"text"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."turbines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "turbine_name" "text" NOT NULL,
    "status" "text" DEFAULT 'Pendiente'::"text",
    "model" "text",
    "blade_length" double precision,
    "coordinates" "jsonb" DEFAULT '{}'::"jsonb",
    "inspection_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "lps_data" "jsonb" DEFAULT '{}'::"jsonb",
    "id_image_path" "text",
    "stitched" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."turbines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "role" "public"."access_role_enum" DEFAULT 'client'::"public"."access_role_enum",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wind_farms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."wind_farms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wind_turbines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."wind_turbines" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app-releases"
    ADD CONSTRAINT "app-releases_pkey" PRIMARY KEY ("version_code");



ALTER TABLE ONLY "public"."blades"
    ADD CONSTRAINT "blades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blades"
    ADD CONSTRAINT "blades_turbine_position_key" UNIQUE ("turbine_id", "position");



ALTER TABLE ONLY "public"."captures"
    ADD CONSTRAINT "captures_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."captures"
    ADD CONSTRAINT "captures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."findings"
    ADD CONSTRAINT "findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instruments"
    ADD CONSTRAINT "instruments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instruments"
    ADD CONSTRAINT "instruments_serial_number_key" UNIQUE ("serial_number");



ALTER TABLE ONLY "public"."pilots"
    ADD CONSTRAINT "pilots_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."pilots"
    ADD CONSTRAINT "pilots_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."project_access"
    ADD CONSTRAINT "project_access_pkey" PRIMARY KEY ("project_id", "user_id");



ALTER TABLE ONLY "public"."project_farms"
    ADD CONSTRAINT "project_farms_pkey" PRIMARY KEY ("project_id", "farm_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turbines"
    ADD CONSTRAINT "turbines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turbines"
    ADD CONSTRAINT "turbines_project_name_key" UNIQUE ("project_id", "turbine_name");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wind_farms"
    ADD CONSTRAINT "wind_farms_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."wind_farms"
    ADD CONSTRAINT "wind_farms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wind_turbines"
    ADD CONSTRAINT "wind_turbines_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_blades_turbine_id" ON "public"."blades" USING "btree" ("turbine_id");



CREATE INDEX "idx_captures_ai_processed_null" ON "public"."captures" USING "btree" ("id") WHERE (("raw_metadata" -> 'ai_processed'::"text") IS NULL);



CREATE INDEX "idx_captures_blade_id" ON "public"."captures" USING "btree" ("blade_id");



CREATE INDEX "idx_captures_measured_at" ON "public"."captures" USING "btree" ("measured_at");



CREATE INDEX "idx_captures_section" ON "public"."captures" USING "btree" ("section");



CREATE INDEX "idx_captures_telemetry" ON "public"."captures" USING "gin" ("telemetry");



CREATE INDEX "idx_findings_attributes" ON "public"."findings" USING "gin" ("attributes");



CREATE INDEX "idx_findings_capture_id" ON "public"."findings" USING "btree" ("capture_id");



CREATE INDEX "idx_findings_region" ON "public"."findings" USING "gin" ("region");



CREATE INDEX "idx_project_access_user_project" ON "public"."project_access" USING "btree" ("user_id", "project_id");



CREATE INDEX "idx_project_farms_farm_id" ON "public"."project_farms" USING "btree" ("farm_id");



CREATE INDEX "idx_project_farms_project_id" ON "public"."project_farms" USING "btree" ("project_id");



CREATE INDEX "idx_turbines_geo" ON "public"."turbines" USING "gin" ("coordinates");



CREATE INDEX "idx_turbines_project_id" ON "public"."turbines" USING "btree" ("project_id");



CREATE OR REPLACE TRIGGER "trg_sync_project_relations" AFTER INSERT OR UPDATE OF "client", "wind_farm", "park_manager_email", "technical_lead_email", "review_personnel_email" ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."sync_project_relations"();



CREATE OR REPLACE TRIGGER "update_captures_modtime" BEFORE UPDATE ON "public"."captures" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_findings_modtime" BEFORE UPDATE ON "public"."findings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_modtime" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."blades"
    ADD CONSTRAINT "blades_turbine_id_fkey" FOREIGN KEY ("turbine_id") REFERENCES "public"."turbines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."captures"
    ADD CONSTRAINT "captures_blade_id_fkey" FOREIGN KEY ("blade_id") REFERENCES "public"."blades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."findings"
    ADD CONSTRAINT "findings_capture_id_fkey" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_access"
    ADD CONSTRAINT "project_access_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_access"
    ADD CONSTRAINT "project_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_farms"
    ADD CONSTRAINT "project_farms_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."wind_farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_farms"
    ADD CONSTRAINT "project_farms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turbines"
    ADD CONSTRAINT "turbines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wind_farms"
    ADD CONSTRAINT "wind_farms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wind_turbines"
    ADD CONSTRAINT "wind_turbines_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."wind_farms"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated can create projects" ON "public"."projects" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Editors can delete projects" ON "public"."projects" FOR DELETE USING ("public"."check_project_write_permission"("id"));



CREATE POLICY "Editors can modify blades" ON "public"."blades" USING ((EXISTS ( SELECT 1
   FROM "public"."turbines" "t"
  WHERE (("t"."id" = "blades"."turbine_id") AND "public"."check_project_write_permission"("t"."project_id")))));



CREATE POLICY "Editors can modify captures" ON "public"."captures" USING ((EXISTS ( SELECT 1
   FROM ("public"."blades" "b"
     JOIN "public"."turbines" "t" ON (("b"."turbine_id" = "t"."id")))
  WHERE (("b"."id" = "captures"."blade_id") AND "public"."check_project_write_permission"("t"."project_id")))));



CREATE POLICY "Editors can modify turbines" ON "public"."turbines" USING ("public"."check_project_write_permission"("project_id"));



CREATE POLICY "Editors can update projects" ON "public"."projects" FOR UPDATE USING ("public"."check_project_write_permission"("id"));



CREATE POLICY "Editors/AI can modify findings" ON "public"."findings" USING ((EXISTS ( SELECT 1
   FROM (("public"."captures" "c"
     JOIN "public"."blades" "b" ON (("c"."blade_id" = "b"."id")))
     JOIN "public"."turbines" "t" ON (("b"."turbine_id" = "t"."id")))
  WHERE (("c"."id" = "findings"."capture_id") AND "public"."check_project_write_permission"("t"."project_id")))));



CREATE POLICY "Users can see their own access" ON "public"."project_access" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "View blades with access" ON "public"."blades" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."turbines" "t"
     JOIN "public"."project_access" "pa" ON (("t"."project_id" = "pa"."project_id")))
  WHERE (("t"."id" = "blades"."turbine_id") AND ("pa"."user_id" = "auth"."uid"())))));



CREATE POLICY "View captures with access" ON "public"."captures" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."blades" "b"
     JOIN "public"."turbines" "t" ON (("b"."turbine_id" = "t"."id")))
     JOIN "public"."project_access" "pa" ON (("t"."project_id" = "pa"."project_id")))
  WHERE (("b"."id" = "captures"."blade_id") AND ("pa"."user_id" = "auth"."uid"())))));



CREATE POLICY "View findings with access" ON "public"."findings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((("public"."captures" "c"
     JOIN "public"."blades" "b" ON (("c"."blade_id" = "b"."id")))
     JOIN "public"."turbines" "t" ON (("b"."turbine_id" = "t"."id")))
     JOIN "public"."project_access" "pa" ON (("t"."project_id" = "pa"."project_id")))
  WHERE (("c"."id" = "findings"."capture_id") AND ("pa"."user_id" = "auth"."uid"())))));



CREATE POLICY "View projects with access" ON "public"."projects" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."project_access"
  WHERE (("project_access"."project_id" = "projects"."id") AND ("project_access"."user_id" = "auth"."uid"())))));



CREATE POLICY "View turbines by project access" ON "public"."wind_turbines" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."project_farms" "pf"
     JOIN "public"."project_access" "pa" ON (("pa"."project_id" = "pf"."project_id")))
  WHERE (("pf"."farm_id" = "wind_turbines"."farm_id") AND ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "View turbines with access" ON "public"."turbines" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."project_access"
  WHERE (("project_access"."project_id" = "turbines"."project_id") AND ("project_access"."user_id" = "auth"."uid"())))));



CREATE POLICY "View wind farms by project access" ON "public"."wind_farms" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."project_farms" "pf"
     JOIN "public"."project_access" "pa" ON (("pa"."project_id" = "pf"."project_id")))
  WHERE (("pf"."farm_id" = "wind_farms"."id") AND ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "pilots_select_own_email" ON "public"."pilots" FOR SELECT TO "authenticated" USING (("lower"("email") = "lower"(("auth"."jwt"() ->> 'email'::"text"))));



ALTER TABLE "public"."project_farms" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_project_write_permission"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_project_write_permission"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_project_write_permission"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_progress"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_progress"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_progress"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_project_relations"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_project_relations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_project_relations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."access_role_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."access_role_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."access_role_enum") TO "service_role";



GRANT ALL ON TABLE "public"."app-releases" TO "anon";
GRANT ALL ON TABLE "public"."app-releases" TO "authenticated";
GRANT ALL ON TABLE "public"."app-releases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."app-releases_version_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."app-releases_version_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."app-releases_version_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."blades" TO "anon";
GRANT ALL ON TABLE "public"."blades" TO "authenticated";
GRANT ALL ON TABLE "public"."blades" TO "service_role";



GRANT ALL ON TABLE "public"."captures" TO "anon";
GRANT ALL ON TABLE "public"."captures" TO "authenticated";
GRANT ALL ON TABLE "public"."captures" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."findings" TO "anon";
GRANT ALL ON TABLE "public"."findings" TO "authenticated";
GRANT ALL ON TABLE "public"."findings" TO "service_role";



GRANT ALL ON TABLE "public"."instruments" TO "anon";
GRANT ALL ON TABLE "public"."instruments" TO "authenticated";
GRANT ALL ON TABLE "public"."instruments" TO "service_role";



GRANT ALL ON TABLE "public"."pilots" TO "anon";
GRANT ALL ON TABLE "public"."pilots" TO "authenticated";
GRANT ALL ON TABLE "public"."pilots" TO "service_role";



GRANT ALL ON TABLE "public"."project_access" TO "anon";
GRANT ALL ON TABLE "public"."project_access" TO "authenticated";
GRANT ALL ON TABLE "public"."project_access" TO "service_role";



GRANT ALL ON TABLE "public"."project_farms" TO "anon";
GRANT ALL ON TABLE "public"."project_farms" TO "authenticated";
GRANT ALL ON TABLE "public"."project_farms" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."turbines" TO "anon";
GRANT ALL ON TABLE "public"."turbines" TO "authenticated";
GRANT ALL ON TABLE "public"."turbines" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."wind_farms" TO "anon";
GRANT ALL ON TABLE "public"."wind_farms" TO "authenticated";
GRANT ALL ON TABLE "public"."wind_farms" TO "service_role";



GRANT ALL ON TABLE "public"."wind_turbines" TO "anon";
GRANT ALL ON TABLE "public"."wind_turbines" TO "authenticated";
GRANT ALL ON TABLE "public"."wind_turbines" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







