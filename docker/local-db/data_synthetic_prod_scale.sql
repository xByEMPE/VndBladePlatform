-- Datos SINTÉTICOS a escala de producción para el ensayo (base `prodlike`): 7 proyectos, 378 turbinas, 1 134 palas,
-- ~77 000 capturas, ~19 700 hallazgos, 5 admin y 10 client. Correos @example.com (excepto el Master Dev). Solo local.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', e, '', now(), '{}', '{}', now(), now()
FROM unnest(ARRAY['enrique.hernandez@bo.vindgroup.com.mx','admin2@example.com','admin3@example.com','admin4@example.com','admin5@example.com',
  'cli1@example.com','cli2@example.com','cli3@example.com','cli4@example.com','cli5@example.com','cli6@example.com','cli7@example.com','cli8@example.com','cli9@example.com','cli10@example.com']) AS e;
-- (on_auth_user_created creó los perfiles como client)
UPDATE public.user_profiles SET role = 'admin' WHERE email IN ('enrique.hernandez@bo.vindgroup.com.mx','admin2@example.com','admin3@example.com','admin4@example.com','admin5@example.com');

INSERT INTO public.projects (id, name, client, wind_farm, turbine_count, created_by)
SELECT gen_random_uuid(), 'PROY-' || g, 'CLIENTE', 'PARQUE-' || g, 0, (SELECT id FROM public.user_profiles WHERE email='admin2@example.com')
FROM generate_series(1, 7) g;

-- turbinas por proyecto: 100, 80, 60, 50, 40, 30, 18  (= 378)
INSERT INTO public.turbines (project_id, turbine_name, status)
SELECT p.id, 'WTG-' || lpad(n::text, 3, '0'), 'Aprobado'
FROM (SELECT id, row_number() OVER (ORDER BY name) rn FROM public.projects) p
JOIN LATERAL generate_series(1, (ARRAY[100,80,60,50,40,30,18])[p.rn]) n ON true;

INSERT INTO public.blades (turbine_id, position, serial_number)
SELECT t.id, pos::public.blade_position_enum, 'S-' || substr(t.id::text, 1, 6) || pos
FROM public.turbines t CROSS JOIN unnest(ARRAY['A','B','C']) pos;

INSERT INTO public.captures (blade_id, storage_path, section, gps_lat, gps_lon, measured_at)
SELECT b.id, 'img/' || b.id || '/' || n || '.jpg', (ARRAY['LE','TE','SS','PS','Root','Tip'])[1 + (n % 6)],
       16.56 + random() * 0.02, -94.73 + random() * 0.02, now()
FROM public.blades b JOIN LATERAL generate_series(1, 68) n ON true;

INSERT INTO public.findings (capture_id, type, severity)
SELECT c.id, 'damage', (1 + floor(random() * 5))::int::text::public.finding_severity_enum
FROM public.captures c WHERE random() < 0.256;

-- acceso: cada cliente ve 2 proyectos
INSERT INTO public.project_access (project_id, user_id, role)
SELECT p.id, u.id, 'client'
FROM (SELECT id, row_number() OVER (ORDER BY name) rn FROM public.projects) p
JOIN (SELECT id, row_number() OVER (ORDER BY email) rn FROM public.user_profiles WHERE role = 'client') u
  ON (u.rn % 7) + 1 = p.rn OR ((u.rn + 3) % 7) + 1 = p.rn
ON CONFLICT DO NOTHING;

ANALYZE;
