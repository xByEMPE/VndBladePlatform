-- BORRADOR (no aplicado): "Technical team" (projects.staff_list) vinculado a usuarios por user_id.
--
-- Alcance: SOLO la sección 4 (staff_list). Los campos de "Responsible parties" (park_manager_*, technical_lead_*,
-- review_personnel_*) NO se tocan: siguen como texto manual.
--
-- Modelo: cada persona de staff_list conserva su forma actual
--   { id, fullName, role, email, client_id, wind_farm_id }
-- y gana `user_id` (uuid de public.user_profiles). `email` y `fullName` pasan a ser COPIAS que la base mantiene
-- sincronizadas con el perfil (así el código que ya lee staff_list sigue funcionando sin cambios).
--
-- Decisiones aprobadas:
--   * Modo estricto: una entrada NUEVA o EDITADA debe traer user_id. Las históricas sin user_id que no se tocan
--     siguen legibles y pasan sin cambios.
--   * Seleccionables: personal activo (admin, technician, dev) mediante list_selectable_staff().
--   * Acceso: quien está en staff_list recibe fila en project_access; si sale del equipo se le retira, salvo que
--     siga justificado por otra vía (creador del proyecto o uno de los 3 correos de "Responsible parties").
--
-- Piezas:
--   0) user_profiles.job_title + RPC list_selectable_staff()
--   1) Índice GIN sobre staff_list
--   2) private.normalize_project_staff() + trigger BEFORE: valida, aplica modo estricto, copia email/nombre/rol
--   3) private.sync_staff_list_user() + trigger AFTER UPDATE OF email, full_name ON user_profiles
--   4) private.sync_staff_project_access() + trigger AFTER INSERT/UPDATE OF staff_list ON projects
--   5) Relleno único: vincula lo existente por correo
--
-- Seguridad: funciones de trigger SECURITY DEFINER con search_path fijo y REVOKE a PUBLIC/anon/authenticated.

-- ============================== 0) Puesto en el perfil + lista de personas elegibles ==============================
-- Puesto "de planta" (p. ej. TECNICO DE MANTENIMIENTO). Autocompleta el rol al agregar a alguien; el rol dentro de
-- staff_list sigue siendo editable por proyecto (p. ej. PILOTO RPAS).
-- Solo lo cambia un dev: la guarda user_profiles_guard_update bloquea a los demás cualquier columna que no sea
-- full_name/email/avatar_url/updated_at, y esta propuesta NO da GRANT UPDATE de la columna a authenticated.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS job_title text;

-- Dependencia: private.sync_staff_project_access() lee projects.created_by. En la base de pruebas ya existe
-- (uuid, default auth.uid()), pero ninguna migración del repo la crea; se declara aquí para que una base nueva funcione.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- El RLS de user_profiles solo deja ver todos los perfiles a admin/dev; un técnico que edite un proyecto no vería a
-- los demás. La RPC devuelve SOLO lo necesario (sin rol ni módulos) y solo a personal activo.
CREATE OR REPLACE FUNCTION public.list_selectable_staff()
 RETURNS TABLE (id uuid, full_name text, email text, job_title text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT up.id, up.full_name, up.email, up.job_title
  FROM public.user_profiles AS up
  WHERE (SELECT private.is_staff())
    AND coalesce(up.is_active, true)
    AND up.role::text IN ('admin', 'technician', 'dev')
  ORDER BY up.full_name NULLS LAST, up.email;
$function$;

REVOKE ALL ON FUNCTION public.list_selectable_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_selectable_staff() TO authenticated;

-- ============================== 1) Índice ==============================
CREATE INDEX IF NOT EXISTS projects_staff_list_gin_idx
  ON public.projects USING gin (staff_list jsonb_path_ops);

-- ============================== 2) Validar y normalizar al escribir ==============================
CREATE OR REPLACE FUNCTION private.normalize_project_staff()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_new jsonb;
BEGIN
  IF NEW.staff_list IS NULL OR jsonb_typeof(NEW.staff_list) <> 'array' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.staff_list) AS t(e)
    WHERE jsonb_typeof(e) = 'object' AND e ? 'user_id' AND (e ->> 'user_id') !~* v_uuid_re
  ) THEN
    RAISE EXCEPTION 'staff_list: user_id invalido' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.staff_list) AS t(e)
    WHERE jsonb_typeof(e) = 'object' AND e ? 'user_id'
      AND NOT EXISTS (SELECT 1 FROM public.user_profiles AS up WHERE up.id = (e ->> 'user_id')::uuid)
  ) THEN
    RAISE EXCEPTION 'staff_list: el usuario no existe' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.staff_list) AS t(e)
    WHERE jsonb_typeof(e) = 'object' AND e ? 'user_id'
    GROUP BY lower(e ->> 'user_id')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'staff_list: usuario repetido en el mismo proyecto' USING ERRCODE = '22023';
  END IF;

  -- Modo estricto: una entrada sin user_id solo se admite si ya estaba tal cual en el valor anterior (histórica).
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.staff_list) AS t(e)
    WHERE NOT (jsonb_typeof(e) = 'object' AND e ? 'user_id')
      AND (TG_OP = 'INSERT'
           OR OLD.staff_list IS NULL
           OR jsonb_typeof(OLD.staff_list) <> 'array'
           OR NOT (OLD.staff_list @> jsonb_build_array(e)))
  ) THEN
    RAISE EXCEPTION 'staff_list: toda persona nueva o editada debe elegirse de los usuarios registrados (user_id)'
      USING ERRCODE = '22023';
  END IF;

  -- Copias de correo, nombre y rol desde el perfil; sin user_id, la entrada no cambia.
  SELECT coalesce(
           jsonb_agg(
             CASE
               WHEN jsonb_typeof(t.e) = 'object' AND t.e ? 'user_id' THEN
                 t.e || jsonb_build_object(
                   'email', up.email,
                   'fullName', coalesce(nullif(btrim(up.full_name), ''), nullif(t.e ->> 'fullName', ''), up.email),
                   -- el rol del proyecto se respeta; si viene vacío se autocompleta con el puesto del perfil
                   'role', coalesce(nullif(btrim(t.e ->> 'role'), ''), nullif(btrim(up.job_title), ''), '')
                 )
               ELSE t.e
             END
             ORDER BY t.ord
           ),
           '[]'::jsonb
         )
  INTO v_new
  FROM jsonb_array_elements(NEW.staff_list) WITH ORDINALITY AS t(e, ord)
  LEFT JOIN public.user_profiles AS up
    ON jsonb_typeof(t.e) = 'object' AND t.e ? 'user_id' AND up.id = (t.e ->> 'user_id')::uuid;

  NEW.staff_list := v_new;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.normalize_project_staff() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS projects_normalize_staff ON public.projects;
CREATE TRIGGER projects_normalize_staff
  BEFORE INSERT OR UPDATE OF staff_list ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION private.normalize_project_staff();

-- ============================== 3) Propagar cambios de correo/nombre ==============================
CREATE OR REPLACE FUNCTION private.sync_staff_list_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email OR NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    -- Re-asignar staff_list a sí misma dispara projects_normalize_staff, que refresca las copias.
    UPDATE public.projects AS p
    SET staff_list = p.staff_list
    WHERE p.staff_list @> jsonb_build_array(jsonb_build_object('user_id', NEW.id::text));
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_staff_list_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_profiles_sync_staff_list ON public.user_profiles;
CREATE TRIGGER user_profiles_sync_staff_list
  AFTER UPDATE OF email, full_name ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_staff_list_user();

-- ============================== 4) Acceso al proyecto (project_access) ==============================
-- Alta: toda persona vinculada recibe fila con su rol de perfil (no pisa una existente).
-- Baja: quien estaba en el valor anterior y ya no está pierde la fila, salvo que siga justificado por otra vía:
--   creador del proyecto o uno de los 3 correos de "Responsible parties" (los que ya concede sync_project_relations).
CREATE OR REPLACE FUNCTION private.sync_staff_project_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_new jsonb := CASE WHEN jsonb_typeof(NEW.staff_list) = 'array' THEN NEW.staff_list ELSE '[]'::jsonb END;
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' AND jsonb_typeof(OLD.staff_list) = 'array' THEN OLD.staff_list ELSE '[]'::jsonb END;
BEGIN
  INSERT INTO public.project_access (project_id, user_id, role)
  SELECT NEW.id, up.id, coalesce(up.role, 'client')
  FROM jsonb_array_elements(v_new) AS t(e)
  JOIN public.user_profiles AS up ON up.id = (t.e ->> 'user_id')::uuid
  WHERE jsonb_typeof(t.e) = 'object' AND t.e ? 'user_id'
  ON CONFLICT (project_id, user_id) DO NOTHING;

  DELETE FROM public.project_access AS pa
  USING public.user_profiles AS up
  WHERE pa.project_id = NEW.id
    AND up.id = pa.user_id
    AND pa.user_id IN (
      SELECT (o.e ->> 'user_id')::uuid
      FROM jsonb_array_elements(v_old) AS o(e)
      WHERE jsonb_typeof(o.e) = 'object' AND o.e ? 'user_id'
    )
    AND pa.user_id NOT IN (
      SELECT (n.e ->> 'user_id')::uuid
      FROM jsonb_array_elements(v_new) AS n(e)
      WHERE jsonb_typeof(n.e) = 'object' AND n.e ? 'user_id'
    )
    AND pa.user_id IS DISTINCT FROM NEW.created_by
    AND lower(btrim(coalesce(up.email, ''))) NOT IN (
      lower(btrim(coalesce(NEW.park_manager_email, ''))),
      lower(btrim(coalesce(NEW.technical_lead_email, ''))),
      lower(btrim(coalesce(NEW.review_personnel_email, '')))
    );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_staff_project_access() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS projects_sync_staff_access ON public.projects;
CREATE TRIGGER projects_sync_staff_access
  AFTER INSERT OR UPDATE OF staff_list ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_staff_project_access();

-- ============================== 5) Relleno único: vincular lo existente por correo ==============================
-- Entradas sin user_id cuyo correo coincide (sin distinguir mayúsculas) con un perfil: se les agrega user_id;
-- el trigger (2) refresca de paso correo, nombre y rol, y el (4) les da acceso. Las que no coinciden quedan como están.
UPDATE public.projects AS p
SET staff_list = (
  SELECT jsonb_agg(
           CASE
             WHEN jsonb_typeof(t.e) = 'object' AND NOT (t.e ? 'user_id') AND up.id IS NOT NULL
               THEN t.e || jsonb_build_object('user_id', up.id::text)
             ELSE t.e
           END
           ORDER BY t.ord
         )
  FROM jsonb_array_elements(p.staff_list) WITH ORDINALITY AS t(e, ord)
  LEFT JOIN public.user_profiles AS up
    ON jsonb_typeof(t.e) = 'object' AND lower(btrim(t.e ->> 'email')) = lower(btrim(up.email))
)
WHERE jsonb_typeof(p.staff_list) = 'array'
  AND jsonb_array_length(p.staff_list) > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p.staff_list) AS t2(e)
    JOIN public.user_profiles AS up2 ON lower(btrim(t2.e ->> 'email')) = lower(btrim(up2.email))
    WHERE jsonb_typeof(t2.e) = 'object' AND NOT (t2.e ? 'user_id')
  );
