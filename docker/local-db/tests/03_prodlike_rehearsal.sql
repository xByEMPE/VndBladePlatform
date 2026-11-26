-- Ensayo en `prodlike` (esquema + capa de producción + cadena nueva + datos sintéticos a escala de producción).
-- Todo se revierte. Uso: docker exec -i avances-local-db psql -U postgres -d prodlike -f - < docker/local-db/tests/03_prodlike_rehearsal.sql
DO $outer$
DECLARE
  r text := '';
  ADM uuid; ADMe text; ENR uuid; ENRe text := 'enrique.hernandez@bo.vindgroup.com.mx';
  CLI uuid; CLIe text; CLI0 uuid; CLI0e text;
  P_BIG uuid; P_OWN uuid; n int; n2 int; t0 timestamptz; ms numeric; v_ok boolean; v_msg text;

BEGIN
  SELECT id, email INTO ADM, ADMe FROM public.user_profiles WHERE email = 'admin2@example.com';
  SELECT id INTO ENR FROM public.user_profiles WHERE email = ENRe;
  SELECT id INTO P_BIG FROM public.projects WHERE name = 'PROY-1';   -- 100 turbinas
  -- un cliente con acceso a PROY-1 y otro SIN acceso
  SELECT u.id, u.email INTO CLI, CLIe FROM public.user_profiles u JOIN public.project_access pa ON pa.user_id = u.id AND pa.project_id = P_BIG WHERE u.role = 'client' LIMIT 1;
  SELECT u.id, u.email INTO CLI0, CLI0e FROM public.user_profiles u WHERE u.role = 'client' AND NOT EXISTS (SELECT 1 FROM public.project_access pa WHERE pa.user_id = u.id AND pa.project_id = P_BIG) LIMIT 1;

  r := r || E'=== A) Lecturas con RLS de producción + cadena nueva ===\n';
  -- helper local como bloque: ejecuta una consulta de conteo como un usuario
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ADM, 'email', ADMe, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.projects; SELECT count(*) INTO n2 FROM public.turbines;
  r := r || format(E'admin ve %s proyectos / %s turbinas (esperado 7 / 378)\n', n, n2);
  t0 := clock_timestamp();
  SELECT count(*) INTO n FROM public.get_project_map_data(P_BIG);
  ms := extract(epoch FROM clock_timestamp() - t0) * 1000;
  r := r || format(E'MAPA como admin, proyecto de 100 turbinas (~%s capturas): %s filas en %s ms\n', (SELECT count(*) FROM public.captures c JOIN public.blades b ON b.id=c.blade_id JOIN public.turbines t ON t.id=b.turbine_id WHERE t.project_id=P_BIG), n, round(ms));
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', CLI, 'email', CLIe, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.projects; SELECT count(*) INTO n2 FROM public.turbines;
  r := r || format(E'client con acceso ve %s proyectos / %s turbinas (esperado 2 / mayor que 0 y menor que 378)\n', n, n2);
  t0 := clock_timestamp();
  SELECT count(*) INTO n FROM public.get_project_map_data(P_BIG);
  ms := extract(epoch FROM clock_timestamp() - t0) * 1000;
  r := r || format(E'MAPA como client con acceso: %s filas en %s ms\n', n, round(ms));
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', CLI0, 'email', CLI0e, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.get_project_map_data(P_BIG);
  r := r || format(E'MAPA como client SIN acceso: %s filas (esperado 0)\n', n);
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM count(*) FROM public.get_project_map_data(P_BIG); r := r || E'FALLO: anon ejecutó el mapa\n';
  EXCEPTION WHEN insufficient_privilege THEN r := r || E'anon: permission denied en el mapa (esperado)\n'; END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);

  r := r || E'=== B) Promoción de Enrique a dev y reglas nuevas ===\n';
  UPDATE public.user_profiles SET role = 'dev' WHERE id = ENR;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ENR, 'email', ENRe, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.audit_logs;
  r := r || format(E'dev (Enrique) lee audit_logs: %s filas (esperado > 0)\n', n);
  SELECT count(*) INTO n FROM public.projects; SELECT count(*) INTO n2 FROM public.turbines;
  r := r || format(E'dev ve %s proyectos / %s turbinas (esperado 7 / 378: is_admin incluye dev)\n', n, n2);
  SELECT count(*) INTO n FROM public.list_selectable_staff();
  r := r || format(E'dev ve %s personas elegibles (esperado 5: 4 admin + el dev)\n', n);
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', ADM, 'email', ADMe, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.audit_logs;
  r := r || format(E'admin lee audit_logs: %s filas (esperado 0: solo dev)\n', n);
  BEGIN PERFORM public.update_user_role(CLI0, 'technician'); r := r || E'admin cambia client->technician: OK\n';
  EXCEPTION WHEN OTHERS THEN r := r || format(E'FALLO admin client->technician: %s\n', SQLERRM); END;
  BEGIN PERFORM public.update_user_role(ENR, 'client'); r := r || E'FALLO: admin degradó al Master\n';
  EXCEPTION WHEN OTHERS THEN r := r || format(E'admin sobre el Master: bloqueado (%s)\n', left(SQLERRM, 60)); END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);

  r := r || E'=== C) Auditoría fuera de captures y findings ===\n';
  r := r || format(E'triggers de auditoría: %s (esperado 13); en captures/findings: %s (esperado 0)\n',
    (SELECT count(*) FROM pg_trigger WHERE tgname = 'audit_capture_row_changes'),
    (SELECT count(*) FROM pg_trigger WHERE tgname = 'audit_capture_row_changes' AND tgrelid IN ('public.captures'::regclass, 'public.findings'::regclass)));
  n := (SELECT count(*) FROM public.audit_logs);
  UPDATE public.captures SET gps_alt = 1 WHERE id IN (SELECT id FROM public.captures LIMIT 5000);
  r := r || format(E'UPDATE de 5000 capturas: filas nuevas en audit_logs = %s (esperado 0)\n', (SELECT count(*) FROM public.audit_logs) - n);

  RAISE EXCEPTION E'ROLLBACK_OK\n%', r;
END
$outer$;
