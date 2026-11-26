-- 06_private_buckets.sql  —  PROPUESTA, NO APLICADA
-- Pone el bucket "images" en privado. El frontend ya firma las URLs (src/lib/storageUrls.js).
--
-- ANTES DE EJECUTAR (en este orden):
--   1. Desplegar el frontend con URLs firmadas y comprobar que carga bien con el bucket aún público.
--   2. Haber aplicado rls_01_policies.sql (define is_admin() / is_staff() y las políticas de escritura).
--   3. Confirmar que el pipeline de IA (Python) y la app Android (vndfly) NO leen "images" por URL pública:
--      si lo hacen, deben pasar a createSignedUrl o usar la service_role key. Si no, dejarán de ver imágenes.
--   4. Consultar el estado real de las políticas (el repo no refleja la base viva):
--        SELECT policyname, cmd, roles, qual FROM pg_policies
--        WHERE schemaname = 'storage' AND tablename = 'objects';
--
-- IMPORTANTE: tras ejecutar, las rutas /storage/v1/object/public/images/... dejan de funcionar para todos.
-- Los enlaces antiguos guardados (reportes PDF ya exportados, correos, etc.) dejarán de abrir.

BEGIN;

-- 1) Lectura de "images": solo usuarios con sesión.
--    Condición simple (bucket_id) para que firmar 300 rutas en lote no sea lento.
DROP POLICY IF EXISTS "images authenticated read" ON storage.objects;
CREATE POLICY "images authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'images');

-- 2) La política pública heredada ("permitir acceso S3 ...") daba SELECT anónimo a todos los buckets.
--    Se excluyen los privados. app-releases / pc_releases se mantienen públicos (la app de vuelo no usa sesión).
ALTER POLICY "permitir acceso S3 1ffg0oo_0" ON storage.objects
  USING (bucket_id NOT IN ('wtgmFile', 'images', 'certificates'));

-- 3) Bucket privado.
UPDATE storage.buckets SET public = false WHERE id = 'images';

-- 4) "certificates": solo admin (ya cubierto por la política "admin manage release buckets" de rls_01).
--    ¡Antes de esto, confirmar que ninguna parte de la app lee certificates por URL pública!
-- UPDATE storage.buckets SET public = false WHERE id = 'certificates';

COMMIT;

-- ---------------------------------------------------------------------------------------------
-- OPCIONAL (más estricto): que un cliente solo lea imágenes de sus proyectos.
-- Hoy cualquier usuario autenticado, incluido un cliente, podría firmar rutas de OTRO cliente si las conoce.
-- Requiere saber cómo se relaciona la ruta (proyecto/parque/turbina/...) con project_users/projects;
-- validar el esquema real antes y probar el rendimiento con un lote de 300 rutas.
--
-- DROP POLICY "images authenticated read" ON storage.objects;
-- CREATE POLICY "images staff read" ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'images' AND (SELECT public.is_staff()));
-- CREATE POLICY "images client read" ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'images' AND EXISTS (
--     SELECT 1 FROM public.project_users pu JOIN public.projects p ON p.id = pu.project_id
--     WHERE pu.user_id = (SELECT auth.uid()) AND storage.objects.name LIKE p.name || '/%'));
-- (Ajustar la columna de unión según el esquema real; indexar project_users(user_id).)

-- ---------------------------------------------------------------------------------------------
-- ROLLBACK (si algo deja de verse):
-- UPDATE storage.buckets SET public = true WHERE id = 'images';
-- ALTER POLICY "permitir acceso S3 1ffg0oo_0" ON storage.objects USING (bucket_id <> 'wtgmFile');
