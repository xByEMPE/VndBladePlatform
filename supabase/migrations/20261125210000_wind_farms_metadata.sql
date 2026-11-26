-- Modelo(s) y número esperado de aerogeneradores por parque, en wind_farms.metadata.
--
-- Solo lo que la app usa para autocompletar el formulario de proyecto al elegir el parque:
--   { "turbine_models": ["V117/3300"], "expected_turbines": 19 }
-- Se descartan estado, ciudad y altura de buje (la app no los usa). `expected_turbines` es el total del Excel y solo se usa
-- si el parque aún no tiene filas en wind_turbines; el conteo real de wind_turbines tiene prioridad.
-- Casos: EURUS = Eurus I + II (167); PER IV y PER V comparten el modelo de "Reynosa (PER)" y NO llevan total (el real
-- vive en wind_turbines); Granja Sedena -> SEDENA; Coahuila -> EOLICA DE COAHUILA; Oaxaca I -> OAXACA 1.
-- Seguridad: no cambia permisos ni políticas; el trigger de auditoría de wind_farms registra el cambio.

ALTER TABLE public.wind_farms
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.wind_farms DROP CONSTRAINT IF EXISTS wind_farms_metadata_is_object;
ALTER TABLE public.wind_farms
  ADD CONSTRAINT wind_farms_metadata_is_object CHECK (jsonb_typeof(metadata) = 'object');

COMMENT ON COLUMN public.wind_farms.metadata IS
  'Datos para autocompletar proyectos: turbine_models (text[]), expected_turbines (int, solo referencia).';

-- Relleno (idempotente): fusiona con lo que ya tenga cada parque.
UPDATE public.wind_farms AS f
SET metadata = f.metadata || v.meta
FROM (VALUES
  ('TRES MESAS I', '{"turbine_models": ["V117/3300"], "expected_turbines": 19}'::jsonb),
  ('TRES MESAS II', '{"turbine_models": ["V117/3300"], "expected_turbines": 26}'::jsonb),
  ('EURUS', '{"turbine_models": ["AW-1500/70"], "expected_turbines": 167}'::jsonb),
  ('OAXACA II', '{"turbine_models": ["AW-1500/70"], "expected_turbines": 68}'::jsonb),
  ('OAXACA III', '{"turbine_models": ["AW-1500/70"], "expected_turbines": 68}'::jsonb),
  ('OAXACA IV', '{"turbine_models": ["AW-1500/70"], "expected_turbines": 68}'::jsonb),
  ('EL CORTIJO', '{"turbine_models": ["AW-3000/125"], "expected_turbines": 61}'::jsonb),
  ('SANTA CRUZ', '{"turbine_models": ["AW-3000/132"], "expected_turbines": 42}'::jsonb),
  ('SAN CARLOS', '{"turbine_models": ["AW-3465/132"], "expected_turbines": 60}'::jsonb),
  ('MESA MORENOS', '{"turbine_models": ["AW-3000/148"], "expected_turbines": 22}'::jsonb),
  ('LA VENTA II', '{"turbine_models": ["G52/850"], "expected_turbines": 98}'::jsonb),
  ('OAXACA 1', '{"turbine_models": ["V80/2000"], "expected_turbines": 51}'::jsonb),
  ('LA VENTA III', '{"turbine_models": ["G52/850"], "expected_turbines": 121}'::jsonb),
  ('EL PORVENIR', '{"turbine_models": ["V100/2000"], "expected_turbines": 30}'::jsonb),
  ('EL MEZQUITE', '{"turbine_models": ["GE 2.5-116"], "expected_turbines": 100}'::jsonb),
  ('LA MATA - LA VENTOSA', '{"turbine_models": ["Liberty C89"], "expected_turbines": 27}'::jsonb),
  ('BII STINU', '{"turbine_models": ["G80/2000"], "expected_turbines": 82}'::jsonb),
  ('SANTO DOMINGO', '{"turbine_models": ["G80/2000"], "expected_turbines": 80}'::jsonb),
  ('EOLICA DE COAHUILA', '{"turbine_models": ["G114/2100"], "expected_turbines": 95}'::jsonb),
  ('LOS CANONES', '{"turbine_models": ["N155/4.5"], "expected_turbines": 20}'::jsonb),
  ('SAN PEDRO', '{"turbine_models": ["V110/2000"], "expected_turbines": 15}'::jsonb),
  ('COROMUEL', '{"turbine_models": ["GE 2.8-127"], "expected_turbines": 20}'::jsonb),
  ('PALO ALTO', '{"turbine_models": ["AW-3000/125"], "expected_turbines": 43}'::jsonb),
  ('DOLORES', '{"turbine_models": ["AW-3000/132"], "expected_turbines": 83}'::jsonb),
  ('SURESTE I PHASE II', '{"turbine_models": ["ECO 100"], "expected_turbines": 34}'::jsonb),
  ('VIENTOS DEL ALTIPLANO', '{"turbine_models": ["G114/2000"], "expected_turbines": 50}'::jsonb),
  ('AMISTAD I', '{"turbine_models": ["G132/3300"], "expected_turbines": 57}'::jsonb),
  ('ZOPILOAPAN', '{"turbine_models": ["G80/2000", "G87/2000"], "expected_turbines": 35}'::jsonb),
  ('DOMINICA I', '{"turbine_models": ["G90/2000"], "expected_turbines": 50}'::jsonb),
  ('DOMINICA II', '{"turbine_models": ["G90/2000"], "expected_turbines": 50}'::jsonb),
  ('SALITRILLOS', '{"turbine_models": ["V136/3450"], "expected_turbines": 30}'::jsonb),
  ('EOLICA DEL SUR', '{"turbine_models": ["V90/3000"], "expected_turbines": 132}'::jsonb),
  ('TRES MESAS IV', '{"turbine_models": ["V150/4000"], "expected_turbines": 24}'::jsonb),
  ('TRES MESAS III', '{"turbine_models": ["V117/3450"], "expected_turbines": 15}'::jsonb),
  ('PENINSULA', '{"turbine_models": ["EN 2.5 MV 110"], "expected_turbines": 36}'::jsonb),
  ('VENTIKA I', '{"turbine_models": ["AW-3000/116"], "expected_turbines": 42}'::jsonb),
  ('VENTIKA II', '{"turbine_models": ["AW-3000/116"], "expected_turbines": 42}'::jsonb),
  ('FUERZA EOLICA SAN MATIAS', '{"turbine_models": ["GE 3.8-130"], "expected_turbines": 8}'::jsonb),
  ('TIZIMIN', '{"turbine_models": ["G114/2100"], "expected_turbines": 36}'::jsonb),
  ('BII NEE STIPA II FASE III EL RETIRO', '{"turbine_models": ["G80/2000"], "expected_turbines": 37}'::jsonb),
  ('VICENTE GUERRERO', '{"turbine_models": ["V136/3450"], "expected_turbines": 33}'::jsonb),
  ('SAN JACINTO', '{"turbine_models": ["G80/2000"], "expected_turbines": 10}'::jsonb),
  ('SANTA CATARINA', '{"turbine_models": ["GE 2.75-103"], "expected_turbines": 8}'::jsonb),
  ('LOS ALTOS', '{"turbine_models": ["V136/3450", "V100/2000"], "expected_turbines": 56}'::jsonb),
  ('ARRIAGA', '{"turbine_models": ["V90/2000"], "expected_turbines": 16}'::jsonb),
  ('SANTIAGO EOLO', '{"turbine_models": ["G114/2100"], "expected_turbines": 50}'::jsonb),
  ('PIER IV', '{"turbine_models": ["G126/2625"], "expected_turbines": 84}'::jsonb),
  ('LA VENTOSA I', '{"turbine_models": ["G52/850"], "expected_turbines": 36}'::jsonb),
  ('LA VENTOSA II', '{"turbine_models": ["G52/850"], "expected_turbines": 58}'::jsonb),
  ('BII NEE STIPA', '{"turbine_models": ["G52/850"], "expected_turbines": 31}'::jsonb),
  ('LA VENTOSA PEM', '{"turbine_models": ["G52/850"], "expected_turbines": 105}'::jsonb),
  ('LA VENTOSA III', '{"turbine_models": ["G80/2000"], "expected_turbines": 11}'::jsonb),
  ('DOS ARBOLITOS', '{"turbine_models": ["G90/2000"], "expected_turbines": 35}'::jsonb),
  ('STIPA NAYAA', '{"turbine_models": ["G90/2000"], "expected_turbines": 37}'::jsonb),
  ('PIER II', '{"turbine_models": ["G97/2000"], "expected_turbines": 33}'::jsonb),
  ('SIERRA JUAREZ', '{"turbine_models": ["V112/3300"], "expected_turbines": 47}'::jsonb),
  ('SIERRA JUAREZ II', '{"turbine_models": ["V150/4000"], "expected_turbines": 26}'::jsonb),
  ('FENICIAS', '{"turbine_models": ["V136/3450"], "expected_turbines": 44}'::jsonb),
  ('CIUDAD VICTORIA', '{"turbine_models": ["V112/3300"], "expected_turbines": 15}'::jsonb),
  ('LA MESA II', '{"turbine_models": ["V112/3300"], "expected_turbines": 15}'::jsonb),
  ('LA BUFA', '{"turbine_models": ["G114/2000"], "expected_turbines": 65}'::jsonb),
  ('BII HIOXIO', '{"turbine_models": ["G90/2000"], "expected_turbines": 117}'::jsonb),
  ('FUERZA EOLICA DEL ISTMO I', '{"turbine_models": ["Liberty C93"], "expected_turbines": 20}'::jsonb),
  ('FUERZA EOLICA DEL ISTMO II', '{"turbine_models": ["Liberty C93"], "expected_turbines": 12}'::jsonb),
  ('PIEDRA LARGA I', '{"turbine_models": ["G80/2000"], "expected_turbines": 45}'::jsonb),
  ('PIEDRA LARGA II', '{"turbine_models": ["G80/2000"], "expected_turbines": 69}'::jsonb),
  ('SEDENA', '{"turbine_models": ["V90/3000"], "expected_turbines": 5}'::jsonb),
  ('DELARO', '{"turbine_models": ["SG 4.5-145"], "expected_turbines": 27}'::jsonb),
  ('LA RUMOROSA I', '{"turbine_models": ["G87/2000"], "expected_turbines": 5}'::jsonb),
  ('EOLICA GOLFO 1', '{"turbine_models": ["EN 2.5 MV 110"], "expected_turbines": 28}'::jsonb),
  ('LA MESA I', '{"turbine_models": ["V136/3450"], "expected_turbines": 10}'::jsonb),
  ('INGENIO', '{"turbine_models": ["AW-1500/77"], "expected_turbines": 33}'::jsonb),
  ('PER IV', '{"turbine_models": ["V136/3450"]}'::jsonb),
  ('PER V', '{"turbine_models": ["V136/3450"]}'::jsonb)
) AS v(name, meta)
WHERE f.name = v.name;
