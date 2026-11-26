-- Pruebas de staff_list / list_selectable_staff / project_access con roles reales. Todo se revierte (RAISE al final).
-- Uso: docker exec -i avances-local-db psql -U postgres -d postgres -f - < docker/local-db/tests/01_staff_list.sql
DO $outer$
DECLARE
  v_res text := '';
  v_tech uuid := '20b49c06-89d3-41ce-b028-42b16fc960e3';   -- cuenta client que se promueve a technician dentro de la prueba
  v_admin uuid := '7e722485-1cdd-47e6-b17d-400d93f3cb3d';
  v_proj uuid := '16546d73-b045-4f2b-b22c-a0200de377ac';
  v_n int; v_j jsonb; v_b boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.projects SET staff_list = '[]'::jsonb, park_manager_email = NULL, technical_lead_email = NULL, review_personnel_email = NULL, created_by = NULL WHERE id = v_proj;
  DELETE FROM public.project_access WHERE project_id = v_proj AND user_id = v_tech;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_tech, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.list_selectable_staff();
  v_res := v_res || format(E'T0 client ve %s personas (esperado 0)\n', v_n);
  RESET ROLE;
  v_res := v_res || format(E'T0b anon ejecuta la RPC: %s (esperado false)\n', has_function_privilege('anon','public.list_selectable_staff()','EXECUTE'));
  v_res := v_res || format(E'T0c authenticated ejecuta normalize/sync/access: %s/%s/%s (esperado false/false/false)\n',
    has_function_privilege('authenticated','private.normalize_project_staff()','EXECUTE'),
    has_function_privilege('authenticated','private.sync_staff_list_user()','EXECUTE'),
    has_function_privilege('authenticated','private.sync_staff_project_access()','EXECUTE'));

  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.user_profiles SET role = 'technician', job_title = 'TECNICO DE MANTENIMIENTO', full_name = 'Tecnico Prueba' WHERE id = v_tech;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.list_selectable_staff();
  v_res := v_res || format(E'T1 admin ve %s personas (esperado 3: admin, dev, technician)\n', v_n);
  UPDATE public.projects SET staff_list = jsonb_build_array(jsonb_build_object('id', 1, 'user_id', v_tech::text, 'email', 'falso@x.com', 'fullName', '', 'role', '')) WHERE id = v_proj;
  RESET ROLE;
  SELECT staff_list -> 0 INTO v_j FROM public.projects WHERE id = v_proj;
  v_res := v_res || format(E'T2 normalizada: %s\n', v_j);
  SELECT EXISTS(SELECT 1 FROM public.project_access WHERE project_id = v_proj AND user_id = v_tech) INTO v_b;
  v_res := v_res || format(E'T2 project_access creado: %s (esperado true)\n', v_b);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.projects SET staff_list = '[{"user_id":"no-es-uuid"}]'::jsonb WHERE id = v_proj;
    v_res := v_res || E'T3a FALLO\n';
  EXCEPTION WHEN SQLSTATE '22023' THEN v_res := v_res || format(E'T3a ok: %s\n', SQLERRM); END;
  BEGIN
    UPDATE public.projects SET staff_list = jsonb_build_array(jsonb_build_object('user_id', gen_random_uuid()::text)) WHERE id = v_proj;
    v_res := v_res || E'T3b FALLO\n';
  EXCEPTION WHEN SQLSTATE '22023' THEN v_res := v_res || format(E'T3b ok: %s\n', SQLERRM); END;
  BEGIN
    UPDATE public.projects SET staff_list = jsonb_build_array(jsonb_build_object('user_id', v_tech::text), jsonb_build_object('user_id', upper(v_tech::text))) WHERE id = v_proj;
    v_res := v_res || E'T3c FALLO\n';
  EXCEPTION WHEN SQLSTATE '22023' THEN v_res := v_res || format(E'T3c ok: %s\n', SQLERRM); END;
  BEGIN
    UPDATE public.projects SET staff_list = staff_list || jsonb_build_array(jsonb_build_object('fullName','Otro sin cuenta','email','x@y.com','role','R')) WHERE id = v_proj;
    v_res := v_res || E'T3d FALLO\n';
  EXCEPTION WHEN SQLSTATE '22023' THEN v_res := v_res || format(E'T3d ok: %s\n', SQLERRM); END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', '', true);
  ALTER TABLE public.projects DISABLE TRIGGER projects_normalize_staff;
  UPDATE public.projects SET staff_list = jsonb_build_array(jsonb_build_object('id', 9, 'fullName', 'Historico', 'email', 'ENRIQUE.hernandez@bo.vindgroup.com.mx', 'role', 'PILOTO')) WHERE id = v_proj;
  ALTER TABLE public.projects ENABLE TRIGGER projects_normalize_staff;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.projects SET staff_list = staff_list || jsonb_build_array(jsonb_build_object('user_id', v_tech::text, 'role', 'PILOTO RPAS')) WHERE id = v_proj;
  SELECT staff_list INTO v_j FROM public.projects WHERE id = v_proj;
  v_res := v_res || format(E'T4a historica intacta + vinculada: %s\n', v_j);
  BEGIN
    UPDATE public.projects SET staff_list = jsonb_set(staff_list, '{0,role}', '"EDITADO"') WHERE id = v_proj;
    v_res := v_res || E'T4b FALLO\n';
  EXCEPTION WHEN SQLSTATE '22023' THEN v_res := v_res || format(E'T4b ok (editar la historica exige vincularla): %s\n', SQLERRM); END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.projects AS p
  SET staff_list = (
    SELECT jsonb_agg(CASE WHEN jsonb_typeof(t.e) = 'object' AND NOT (t.e ? 'user_id') AND up.id IS NOT NULL
                 THEN t.e || jsonb_build_object('user_id', up.id::text) ELSE t.e END ORDER BY t.ord)
    FROM jsonb_array_elements(p.staff_list) WITH ORDINALITY AS t(e, ord)
    LEFT JOIN public.user_profiles AS up ON jsonb_typeof(t.e) = 'object' AND lower(btrim(t.e ->> 'email')) = lower(btrim(up.email)))
  WHERE p.id = v_proj;
  SELECT staff_list INTO v_j FROM public.projects WHERE id = v_proj;
  v_res := v_res || format(E'T5 tras relleno: %s\n', v_j);

  UPDATE public.user_profiles SET email = 'nuevo.tecnico@example.com', full_name = 'Tecnico Nuevo' WHERE id = v_tech;
  SELECT e INTO v_j FROM public.projects, jsonb_array_elements(staff_list) e WHERE id = v_proj AND e ->> 'user_id' = v_tech::text;
  v_res := v_res || format(E'T6 propagado: %s\n', v_j);

  UPDATE public.projects SET park_manager_email = 'nuevo.tecnico@example.com' WHERE id = v_proj;
  UPDATE public.projects SET staff_list = (SELECT jsonb_agg(e) FROM jsonb_array_elements(staff_list) e WHERE e ->> 'user_id' IS DISTINCT FROM v_tech::text) WHERE id = v_proj;
  SELECT EXISTS(SELECT 1 FROM public.project_access WHERE project_id = v_proj AND user_id = v_tech) INTO v_b;
  v_res := v_res || format(E'T7a acceso conservado por park_manager_email: %s (esperado true)\n', v_b);
  ALTER TABLE public.projects DISABLE TRIGGER projects_sync_staff_access;
  UPDATE public.projects SET park_manager_email = NULL, staff_list = staff_list || jsonb_build_array(jsonb_build_object('user_id', v_tech::text)) WHERE id = v_proj;
  ALTER TABLE public.projects ENABLE TRIGGER projects_sync_staff_access;
  UPDATE public.projects SET staff_list = (SELECT jsonb_agg(e) FROM jsonb_array_elements(staff_list) e WHERE e ->> 'user_id' IS DISTINCT FROM v_tech::text) WHERE id = v_proj;
  SELECT EXISTS(SELECT 1 FROM public.project_access WHERE project_id = v_proj AND user_id = v_tech) INTO v_b;
  v_res := v_res || format(E'T7b acceso retirado sin otra justificacion: %s (esperado true)\n', NOT v_b);

  RAISE EXCEPTION E'ROLLBACK_OK\n%', v_res;
END
$outer$;
