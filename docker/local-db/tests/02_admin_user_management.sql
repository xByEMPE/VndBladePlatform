-- Pruebas del rol admin gestionando usuarios (requiere aplicada 20261125220000). Todo se revierte.
-- Uso: docker exec -i avances-local-db psql -U postgres -d postgres -f - < docker/local-db/tests/02_admin_user_management.sql
BEGIN;

-- Usuarios extra (como postgres, sin sesión: el guard no aplica)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000','a2a2a2a2-0000-0000-0000-000000000001','authenticated','authenticated','admin2@example.com','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','d2d2d2d2-0000-0000-0000-000000000001','authenticated','authenticated','dev2@example.com','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','7e7e7e7e-0000-0000-0000-000000000001','authenticated','authenticated','tec1@example.com','',now(),'{}','{}',now(),now())
ON CONFLICT DO NOTHING;
INSERT INTO public.user_profiles (id, email, full_name, role, is_active) VALUES
  ('a2a2a2a2-0000-0000-0000-000000000001','admin2@example.com','Admin Dos','admin',true),
  ('d2d2d2d2-0000-0000-0000-000000000001','dev2@example.com','Dev Dos','dev',true),
  ('7e7e7e7e-0000-0000-0000-000000000001','tec1@example.com','Tec Uno','technician',true)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
UPDATE public.user_profiles SET role='admin', is_active=true WHERE id='7e722485-1cdd-47e6-b17d-400d93f3cb3d';
UPDATE public.user_profiles SET role='client', is_active=true WHERE id='20b49c06-89d3-41ce-b028-42b16fc960e3';

CREATE FUNCTION pg_temp.t(p_label text, p_sql text, p_sub uuid, p_email text, p_expect_ok boolean) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE v_msg text; v_ok boolean := true;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'email', p_email, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN v_ok := false; v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN format('%s %s%s', CASE WHEN v_ok = p_expect_ok THEN 'OK   ' ELSE 'FALLO' END, p_label, CASE WHEN v_ok THEN '' ELSE ' -> ' || v_msg END);
END $f$;

DO $outer$
DECLARE
  A1 uuid := '7e722485-1cdd-47e6-b17d-400d93f3cb3d'; A1e text := 'admin.local@example.com';
  A2 uuid := 'a2a2a2a2-0000-0000-0000-000000000001';
  D2 uuid := 'd2d2d2d2-0000-0000-0000-000000000001'; D2e text := 'dev2@example.com';
  M  uuid := '7ac0e2d1-d20c-4301-ba6c-46099a5255ab'; Me text := 'enrique.hernandez@bo.vindgroup.com.mx';
  T  uuid := '7e7e7e7e-0000-0000-0000-000000000001'; Te text := 'tec1@example.com';
  C  uuid := '20b49c06-89d3-41ce-b028-42b16fc960e3';
  r text := ''; n int;
BEGIN
  r := r || E'--- ADMIN (admin.local) ---\n';
  r := r || pg_temp.t('A1 cambia client -> technician', format('SELECT public.update_user_role(%L, ''technician'')', C), A1, A1e, true) || E'\n';
  r := r || pg_temp.t('A1 cambia a OTRO admin -> client', format('SELECT public.update_user_role(%L, ''client'')', A2), A1, A1e, true) || E'\n';
  r := r || pg_temp.t('A1 asigna dev (esperado: bloqueado)', format('SELECT public.update_user_role(%L, ''dev'')', T), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 cambia el rol de una cuenta dev (bloqueado)', format('SELECT public.update_user_role(%L, ''admin'')', D2), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 cambia el rol del Master (bloqueado)', format('SELECT public.update_user_role(%L, ''admin'')', M), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 cambia su propio rol (bloqueado)', format('SELECT public.update_user_role(%L, ''client'')', A1), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 desactiva a un technician (is_active directo)', format('UPDATE public.user_profiles SET is_active=false, updated_at=now() WHERE id=%L', T), A1, A1e, true) || E'\n';
  r := r || pg_temp.t('A1 reactiva al technician', format('UPDATE public.user_profiles SET is_active=true, updated_at=now() WHERE id=%L', T), A1, A1e, true) || E'\n';
  r := r || pg_temp.t('A1 desactiva una cuenta dev (bloqueado)', format('UPDATE public.user_profiles SET is_active=false WHERE id=%L', D2), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 desactiva al Master (bloqueado)', format('UPDATE public.user_profiles SET is_active=false WHERE id=%L', M), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 desactiva su propia cuenta (bloqueado)', format('UPDATE public.user_profiles SET is_active=false WHERE id=%L', A1), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 cambia role por UPDATE directo (bloqueado)', format('UPDATE public.user_profiles SET role=''admin'' WHERE id=%L', T), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 cambia allowed_modules directo (bloqueado)', format('UPDATE public.user_profiles SET allowed_modules=''[]'' WHERE id=%L', T), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 cambia su propio nombre', format('UPDATE public.user_profiles SET full_name=''Admin Local'' WHERE id=%L', A1), A1, A1e, true) || E'\n';
  r := r || pg_temp.t('A1 precheck de correo sobre un client', format('SELECT public.admin_email_change_precheck(%L, ''nuevo.cliente@example.com'', ''cambio de buzon'')', C), A1, A1e, false) || E'\n'; -- C ya es technician arriba
  UPDATE public.user_profiles SET role='client' WHERE id = C;
  r := r || pg_temp.t('A1 precheck de correo sobre un client (ahora client)', format('SELECT public.admin_email_change_precheck(%L, ''nuevo.cliente@example.com'', ''cambio de buzon'')', C), A1, A1e, true) || E'\n';
  r := r || pg_temp.t('A1 precheck sobre technician (bloqueado)', format('SELECT public.admin_email_change_precheck(%L, ''x1@example.com'', ''cambio de buzon'')', T), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 precheck sobre dev (bloqueado)', format('SELECT public.admin_email_change_precheck(%L, ''x2@example.com'', ''cambio de buzon'')', D2), A1, A1e, false) || E'\n';
  r := r || pg_temp.t('A1 precheck sobre el Master (bloqueado)', format('SELECT public.admin_email_change_precheck(%L, ''x3@example.com'', ''cambio de buzon'')', M), A1, A1e, false) || E'\n';

  r := r || E'--- TECHNICIAN ---\n';
  r := r || pg_temp.t('T llama update_user_role (bloqueado)', format('SELECT public.update_user_role(%L, ''client'')', C), T, Te, false) || E'\n';
  r := r || pg_temp.t('T se desactiva a si mismo (bloqueado)', format('UPDATE public.user_profiles SET is_active=false WHERE id=%L', T), T, Te, false) || E'\n';
  -- el RLS oculta la fila: no hay error, pero tampoco se actualiza nada (la división falla si hubo 0 filas)
  r := r || pg_temp.t('T desactiva a otro (0 filas afectadas por RLS)', format('WITH u AS (UPDATE public.user_profiles SET is_active=false WHERE id=%L RETURNING 1) SELECT 1/(SELECT count(*) FROM u)', C), T, Te, false) || E'\n';
  r := r || pg_temp.t('T precheck de correo (bloqueado)', format('SELECT public.admin_email_change_precheck(%L, ''y@example.com'', ''cambio de buzon'')', C), T, Te, false) || E'\n';
  r := r || pg_temp.t('T cambia su nombre', format('UPDATE public.user_profiles SET full_name=''Tec'' WHERE id=%L', T), T, Te, true) || E'\n';

  r := r || E'--- DEV no Master (regresión: todo como antes) ---\n';
  r := r || pg_temp.t('D2 cambia admin -> client', format('SELECT public.update_user_role(%L, ''client'')', A1), D2, D2e, true) || E'\n';
  UPDATE public.user_profiles SET role='admin' WHERE id = A1;
  r := r || pg_temp.t('D2 asigna dev (bloqueado)', format('SELECT public.update_user_role(%L, ''dev'')', T), D2, D2e, false) || E'\n';
  r := r || pg_temp.t('D2 cambia su propio rol (bloqueado)', format('SELECT public.update_user_role(%L, ''admin'')', D2), D2, D2e, false) || E'\n';
  r := r || pg_temp.t('D2 desactiva una cuenta dev (bloqueado)', format('UPDATE public.user_profiles SET is_active=false WHERE id=%L', M), D2, D2e, false) || E'\n';
  r := r || pg_temp.t('D2 desactiva a un admin', format('UPDATE public.user_profiles SET is_active=false WHERE id=%L', A2), D2, D2e, true) || E'\n';
  r := r || pg_temp.t('D2 cambia allowed_modules (dev puede)', format('UPDATE public.user_profiles SET allowed_modules=''["progress"]'' WHERE id=%L', T), D2, D2e, true) || E'\n';
  r := r || pg_temp.t('D2 precheck de correo sobre client', format('SELECT public.admin_email_change_precheck(%L, ''z@example.com'', ''cambio de buzon'')', C), D2, D2e, true) || E'\n';

  r := r || E'--- MASTER ---\n';
  r := r || pg_temp.t('M cambia dev -> admin', format('SELECT public.update_user_role(%L, ''admin'')', D2), M, Me, true) || E'\n';
  r := r || pg_temp.t('M asigna dev', format('SELECT public.update_user_role(%L, ''dev'')', D2), M, Me, true) || E'\n';

  SELECT count(*) INTO n FROM public.audit_logs WHERE user_role = 'admin' AND table_name = 'public.user_profiles';
  r := r || format(E'--- auditoria: filas de user_profiles hechas por un admin: %s (esperado >= 3)\n', n);
  RAISE NOTICE E'\n%', r;
END
$outer$;
ROLLBACK;
