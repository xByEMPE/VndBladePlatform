-- Datos ficticios SOLO para la base local: usuarios por rol y un proyecto. Idempotente.
-- Correos @example.com (excepto el Master Dev, cuyo correo es una constante del propio esquema).
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '7ac0e2d1-d20c-4301-ba6c-46099a5255ab', 'authenticated', 'authenticated', 'enrique.hernandez@bo.vindgroup.com.mx', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '7e722485-1cdd-47e6-b17d-400d93f3cb3d', 'authenticated', 'authenticated', 'admin.local@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20b49c06-89d3-41ce-b028-42b16fc960e3', 'authenticated', 'authenticated', 'client.local@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
VALUES
  ('7ac0e2d1-d20c-4301-ba6c-46099a5255ab', 'enrique.hernandez@bo.vindgroup.com.mx', 'Enrique Hernández', 'dev', true),
  ('7e722485-1cdd-47e6-b17d-400d93f3cb3d', 'admin.local@example.com', 'Admin Local', 'admin', true),
  ('20b49c06-89d3-41ce-b028-42b16fc960e3', 'client.local@example.com', NULL, 'client', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projects (id, name, client, wind_farm)
VALUES ('16546d73-b045-4f2b-b22c-a0200de377ac', 'DEMO', 'VESTAS', 'TRES MESAS I')
ON CONFLICT (id) DO NOTHING;
