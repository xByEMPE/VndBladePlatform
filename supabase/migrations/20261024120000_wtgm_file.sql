-- Generador WTG: calibraciones guardadas (.wtgm) y sus 2 fotos.
-- Tabla "wtgmFile" + bucket privado "wtgmFile". Acceso solo para usuarios con rol admin.

-- 1) Tabla -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."wtgmFile" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Datos de la turbina
  wind_farm         text,
  manufacturer      text,
  wtg_model         text,
  tower_height_m    numeric,
  rotor_diameter_m  numeric,
  blade_length_m    numeric,
  blade_length_ref  text,
  axis_source       text,
  turbine_code      text,
  power_rating      text,
  missing_fields    text[] NOT NULL DEFAULT '{}',

  -- Las 2 fotos (objetos del bucket "wtgmFile")
  photo1_path       text,
  photo1_name       text,
  photo1_width      integer,
  photo1_height     integer,
  photo2_path       text,
  photo2_name       text,
  photo2_width      integer,
  photo2_height     integer,

  -- Marcaciones y resultado
  keypoints         jsonb,
  geometry          jsonb,
  uncertainty       jsonb,
  wtgm              jsonb,
  method            text,
  sigma_px          numeric
);

CREATE INDEX IF NOT EXISTS wtgm_file_created_at_idx ON public."wtgmFile" (created_at DESC);

DROP TRIGGER IF EXISTS update_wtgm_file_modtime ON public."wtgmFile";
CREATE TRIGGER update_wtgm_file_modtime
  BEFORE UPDATE ON public."wtgmFile"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) RLS de la tabla: solo admin ---------------------------------------------------------
ALTER TABLE public."wtgmFile" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wtgmFile admin all" ON public."wtgmFile";
CREATE POLICY "wtgmFile admin all" ON public."wtgmFile"
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- 3) Bucket privado ----------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('wtgmFile', 'wtgmFile', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 4) RLS del bucket: solo admin puede leer, subir, reemplazar y borrar ---------------------
DROP POLICY IF EXISTS "wtgmFile admin select" ON storage.objects;
CREATE POLICY "wtgmFile admin select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'wtgmFile' AND public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "wtgmFile admin insert" ON storage.objects;
CREATE POLICY "wtgmFile admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wtgmFile' AND public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "wtgmFile admin update" ON storage.objects;
CREATE POLICY "wtgmFile admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'wtgmFile' AND public.get_current_user_role() = 'admin')
  WITH CHECK (bucket_id = 'wtgmFile' AND public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "wtgmFile admin delete" ON storage.objects;
CREATE POLICY "wtgmFile admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'wtgmFile' AND public.get_current_user_role() = 'admin');
