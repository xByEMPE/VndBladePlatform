-- PROPUESTA (no aplicada) · RLS paso 2: activar RLS por etapas.
-- Ejecuta UNA etapa a la vez, prueba la app con un admin, un técnico y un cliente, y sigue con la siguiente.
-- Cada etapa trae su marcha atrás (ALTER TABLE ... DISABLE ROW LEVEL SECURITY) por si algo falla.
-- Requiere haber ejecutado antes rls_01_policies.sql.

-- Etapa A · catálogos y tablas auxiliares (bajo riesgo)
ALTER TABLE public.companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wind_farms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wind_turbines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."app-releases" ENABLE ROW LEVEL SECURITY;
-- Atrás: ALTER TABLE public.<tabla> DISABLE ROW LEVEL SECURITY;

-- Etapa B · usuarios y accesos (prueba: login, página Admin, asignar personal en Proyectos)
-- ALTER TABLE public.user_profiles  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.project_access ENABLE ROW LEVEL SECURITY;

-- Etapa C · datos de inspección (prueba: dashboard, progreso, portal y visor de reportes como cliente;
--           subida de imágenes y edición de daños como técnico)
-- ALTER TABLE public.projects  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.turbines  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.blades    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.captures  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.findings  ENABLE ROW LEVEL SECURITY;
