-- ============================================
-- MIGRACION: Sistema de Medicion EXIF
-- ============================================
-- Fecha: 2025-12-12
-- Descripcion: Agrega soporte para medicion basada en datos EXIF
-- 
-- INSTRUCCIONES:
-- 1. Abre el SQL Editor en Supabase Dashboard
-- 2. Copia y pega este script completo
-- 3. Ejecuta el script
-- ============================================

BEGIN;

-- ============================================
-- 1. MODIFICACIONES EN inspection_files
-- ============================================

-- Datos EXIF completos
ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS exif_data JSONB DEFAULT '{}'::jsonb;

-- Escala y medicion
ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS scale_mm_per_px NUMERIC(10, 6);

ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS measurement_confidence TEXT 
CHECK (measurement_confidence IN ('high', 'medium', 'low') OR measurement_confidence IS NULL);

ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS distance_to_target NUMERIC(10, 3);

-- Dimensiones de imagen
ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS image_width INTEGER;

ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS image_height INTEGER;

-- Posicion calculada
ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS calculated_position_meters NUMERIC(10, 3);

ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS image_coverage_m NUMERIC(10, 3);

ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS calculated_increment_m NUMERIC(10, 3);

ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS position_calculated_from_exif BOOLEAN DEFAULT false;

ALTER TABLE inspection_files 
ADD COLUMN IF NOT EXISTS exif_timestamp TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 2. INDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_inspection_files_exif_data 
ON inspection_files USING GIN (exif_data);

CREATE INDEX IF NOT EXISTS idx_inspection_files_measurement_confidence 
ON inspection_files (measurement_confidence);

CREATE INDEX IF NOT EXISTS idx_inspection_files_exif_timestamp 
ON inspection_files (exif_timestamp);

-- ============================================
-- 3. COMENTARIOS DE COLUMNAS
-- ============================================

COMMENT ON COLUMN inspection_files.exif_data IS 'Datos EXIF completos extraidos de la imagen (JSON)';
COMMENT ON COLUMN inspection_files.scale_mm_per_px IS 'Escala real calculada en milimetros por pixel basada en EXIF';
COMMENT ON COLUMN inspection_files.measurement_confidence IS 'Nivel de confianza de la medicion: high (LRF), medium (Relative Altitude), low (Focus Distance o estimado)';
COMMENT ON COLUMN inspection_files.distance_to_target IS 'Distancia al objetivo en metros calculada desde EXIF';
COMMENT ON COLUMN inspection_files.image_width IS 'Ancho de la imagen en pixeles (desde EXIF o imagen)';
COMMENT ON COLUMN inspection_files.image_height IS 'Alto de la imagen en pixeles (desde EXIF o imagen)';
COMMENT ON COLUMN inspection_files.calculated_position_meters IS 'Posicion longitudinal calculada desde EXIF y secuencia de imagenes';
COMMENT ON COLUMN inspection_files.image_coverage_m IS 'Cobertura real de la imagen en metros (altura fisica)';
COMMENT ON COLUMN inspection_files.calculated_increment_m IS 'Incremento calculado desde esta imagen a la siguiente';
COMMENT ON COLUMN inspection_files.position_calculated_from_exif IS 'Indica si position_meters fue calculado desde EXIF o proviene de otra fuente';
COMMENT ON COLUMN inspection_files.exif_timestamp IS 'Timestamp de captura desde EXIF (DateTimeOriginal o CreateDate)';

-- ============================================
-- 4. MODIFICACIONES EN damages (Opcional)
-- ============================================

ALTER TABLE damages 
ADD COLUMN IF NOT EXISTS measurement_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE damages 
ADD COLUMN IF NOT EXISTS measured_with_exif_ruler BOOLEAN DEFAULT false;

COMMENT ON COLUMN damages.measurement_data IS 'Datos de medicion interactiva: width_mm, height_mm, area_mm2, area_cm2, area_m2, scale_mm_per_px, confidence';
COMMENT ON COLUMN damages.measured_with_exif_ruler IS 'Indica si las medidas fueron tomadas usando el sistema de reglas basado en EXIF';

COMMIT;

-- ============================================
-- VERIFICACION POST-MIGRACION
-- ============================================
-- Ejecuta estas consultas para verificar que las columnas fueron creadas:

-- Verificar columnas en inspection_files
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'inspection_files'
AND column_name IN (
  'exif_data', 
  'scale_mm_per_px', 
  'measurement_confidence',
  'distance_to_target',
  'image_width',
  'image_height',
  'calculated_position_meters',
  'image_coverage_m',
  'calculated_increment_m',
  'position_calculated_from_exif',
  'exif_timestamp'
)
ORDER BY column_name;

-- Verificar indices
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'inspection_files'
AND (indexname LIKE '%exif%' OR indexname LIKE '%measurement%');









