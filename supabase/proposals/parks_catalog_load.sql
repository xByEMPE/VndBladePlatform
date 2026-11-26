-- Carga de catálogo de parques (BORRADOR, no aplicado en pruebas). Fuente: Parques eolicos.xlsx.
-- Solo nombre del parque y empresa/tecnólogo; estado, ciudad, altura de buje, modelo y número de turbinas NO se guardan
-- (decisión: la app no los usa; el total real vive en wind_turbines).
-- Decisiones: EURUS queda como uno solo; PER IV y PER V como están; Granja Sedena = SEDENA (ya existe); Oaxaca I y
-- Tizimín conservan el conteo real de wind_turbines; Pier IV y Amistad I se insertan como nuevos; Gamesa y Siemens-Gamesa
-- -> SIEMENS ENERGY. Idempotente (ON CONFLICT DO NOTHING por nombre).

INSERT INTO public.companies (name) VALUES
  ('ACCIONA'),
  ('ALSTOM POWER'),
  ('CLIPPER'),
  ('ENVISION'),
  ('GE ENERGY'),
  ('NORDEX'),
  ('SIEMENS ENERGY'),
  ('VESTAS')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.wind_farms (company_id, name)
SELECT c.id, v.farm FROM (VALUES
  ('ACCIONA', 'SAN CARLOS'),
  ('ACCIONA', 'MESA MORENOS'),
  ('SIEMENS ENERGY', 'LA VENTA II'),
  ('SIEMENS ENERGY', 'LA VENTA III'),
  ('GE ENERGY', 'EL MEZQUITE'),
  ('CLIPPER', 'LA MATA - LA VENTOSA'),
  ('NORDEX', 'LOS CANONES'),
  ('VESTAS', 'SAN PEDRO'),
  ('GE ENERGY', 'COROMUEL'),
  ('ACCIONA', 'PALO ALTO'),
  ('ACCIONA', 'DOLORES'),
  ('ALSTOM POWER', 'SURESTE I PHASE II'),
  ('SIEMENS ENERGY', 'VIENTOS DEL ALTIPLANO'),
  ('SIEMENS ENERGY', 'AMISTAD I'),
  ('SIEMENS ENERGY', 'ZOPILOAPAN'),
  ('SIEMENS ENERGY', 'DOMINICA I'),
  ('SIEMENS ENERGY', 'DOMINICA II'),
  ('VESTAS', 'SALITRILLOS'),
  ('ENVISION', 'PENINSULA'),
  ('ACCIONA', 'VENTIKA I'),
  ('ACCIONA', 'VENTIKA II'),
  ('GE ENERGY', 'FUERZA EOLICA SAN MATIAS'),
  ('SIEMENS ENERGY', 'BII NEE STIPA II FASE III EL RETIRO'),
  ('VESTAS', 'VICENTE GUERRERO'),
  ('SIEMENS ENERGY', 'SAN JACINTO'),
  ('GE ENERGY', 'SANTA CATARINA'),
  ('VESTAS', 'LOS ALTOS'),
  ('VESTAS', 'ARRIAGA'),
  ('SIEMENS ENERGY', 'PIER IV'),
  ('SIEMENS ENERGY', 'LA VENTOSA I'),
  ('SIEMENS ENERGY', 'LA VENTOSA II'),
  ('SIEMENS ENERGY', 'BII NEE STIPA'),
  ('SIEMENS ENERGY', 'LA VENTOSA PEM'),
  ('SIEMENS ENERGY', 'LA VENTOSA III'),
  ('SIEMENS ENERGY', 'DOS ARBOLITOS'),
  ('SIEMENS ENERGY', 'STIPA NAYAA'),
  ('SIEMENS ENERGY', 'PIER II'),
  ('VESTAS', 'SIERRA JUAREZ'),
  ('VESTAS', 'SIERRA JUAREZ II'),
  ('VESTAS', 'FENICIAS'),
  ('VESTAS', 'CIUDAD VICTORIA'),
  ('VESTAS', 'LA MESA II'),
  ('SIEMENS ENERGY', 'BII HIOXIO'),
  ('CLIPPER', 'FUERZA EOLICA DEL ISTMO I'),
  ('CLIPPER', 'FUERZA EOLICA DEL ISTMO II'),
  ('SIEMENS ENERGY', 'PIEDRA LARGA I'),
  ('SIEMENS ENERGY', 'PIEDRA LARGA II'),
  ('SIEMENS ENERGY', 'DELARO'),
  ('SIEMENS ENERGY', 'LA RUMOROSA I'),
  ('ENVISION', 'EOLICA GOLFO 1'),
  ('VESTAS', 'LA MESA I'),
  ('ACCIONA', 'INGENIO')
) AS v(company, farm)
JOIN public.companies AS c ON c.name = v.company
ON CONFLICT (name) DO NOTHING;
