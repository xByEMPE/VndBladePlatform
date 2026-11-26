-- Solo base LOCAL: replica los 24 parques que ya existen en la base de pruebas remota (sin sus aerogeneradores).
INSERT INTO public.companies (name) VALUES ('ACCIONA'),('SIEMENS ENERGY'),('VESTAS') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.wind_farms (company_id, name) SELECT c.id, v.farm FROM (VALUES
  ('ACCIONA','EL CORTIJO'),
  ('ACCIONA','EURUS'),
  ('ACCIONA','OAXACA II'),
  ('ACCIONA','OAXACA III'),
  ('ACCIONA','OAXACA IV'),
  ('ACCIONA','SANTA CRUZ'),
  ('SIEMENS ENERGY','AMISTAD III'),
  ('SIEMENS ENERGY','BII STINU'),
  ('SIEMENS ENERGY','EOLICA DE COAHUILA'),
  ('SIEMENS ENERGY','LA BUFA'),
  ('SIEMENS ENERGY','SANTIAGO EOLO'),
  ('SIEMENS ENERGY','SANTO DOMINGO'),
  ('SIEMENS ENERGY','TIZIMIN'),
  ('VESTAS','EL PORVENIR'),
  ('VESTAS','EOLICA DEL SUR'),
  ('VESTAS','MESA LA PAZ'),
  ('VESTAS','OAXACA 1'),
  ('VESTAS','PER IV'),
  ('VESTAS','PER V'),
  ('VESTAS','SEDENA'),
  ('VESTAS','TRES MESAS I'),
  ('VESTAS','TRES MESAS II'),
  ('VESTAS','TRES MESAS III'),
  ('VESTAS','TRES MESAS IV')
) AS v(company, farm) JOIN public.companies c ON c.name = v.company ON CONFLICT (name) DO NOTHING;
