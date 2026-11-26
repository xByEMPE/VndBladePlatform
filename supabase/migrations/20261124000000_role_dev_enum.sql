-- Reconstruida desde la base de pruebas (tddtfhmkjlpbcqtahcgf): el rol 'dev'.
--
-- ALTER TYPE ... ADD VALUE no puede compartir transacción con código que use el valor nuevo, por eso va
-- SOLO en este archivo. Es idempotente: si el valor ya existe (como en la base de pruebas) no hace nada.
-- Orden resultante del enum: client, technician, admin, service_ai, dev.
ALTER TYPE public.access_role_enum ADD VALUE IF NOT EXISTS 'dev';
