-- PROPUESTA (no aplicada) · Recuperar `turbines.stitched` y `turbines.inspection_date`.
-- Solo RELLENA datos vacíos; nunca sobrescribe valores existentes. Se puede ejecutar varias veces.
-- Ejecuta cada bloque por separado en el SQL Editor de Supabase.

-- ═══ 0) VISTA PREVIA (solo lectura) ═══════════════════════════════════════════════════════
-- Turbinas con `stitched` vacío y cuántas imágenes stitched válidas hay en el storage (esperado: 12)
with f as (
  select split_part(o.name,'/',1) park, split_part(o.name,'/',2) turbine,
         regexp_match(split_part(o.name,'/',4), '_([ABC])_(LeadingEdge|TrailingEdge|PressureSide|SuctionSide)\.[A-Za-z]+$') m
  from storage.objects o where o.bucket_id = 'images' and split_part(o.name,'/',3) = 'stitched'),
per as (select park, turbine, count(m) matched from f group by 1,2)
select p.wind_farm, t.turbine_name, coalesce(per.matched, 0) imagenes_stitched
from public.turbines t join public.projects p on p.id = t.project_id
left join per on per.park = p.wind_farm and per.turbine = t.turbine_name
where t.stitched is null or t.stitched::text in ('{}', 'null')
order by 1, 2;

-- ═══ 1) STITCHED: reconstruir el JSON { A: { LeadingEdge: ruta, ... }, B: ..., C: ... } ═══
-- Solo turbinas con `stitched` vacío. Conserva el formato que lee la web (ruta dentro del bucket "images").
with f as (
  select split_part(o.name,'/',1) park, split_part(o.name,'/',2) turbine, o.name path,
         regexp_match(split_part(o.name,'/',4), '_([ABC])_(LeadingEdge|TrailingEdge|PressureSide|SuctionSide)\.[A-Za-z]+$') m
  from storage.objects o where o.bucket_id = 'images' and split_part(o.name,'/',3) = 'stitched'),
b as (select park, turbine, m[1] blade, jsonb_object_agg(m[2], path) faces from f where m is not null group by 1,2,3),
t as (select park, turbine, jsonb_object_agg(blade, faces) st from b group by 1,2),
u as (
  update public.turbines tu set stitched = t.st
  from t join public.projects p on p.wind_farm = t.park
  where tu.project_id = p.id and tu.turbine_name = t.turbine
    and (tu.stitched is null or tu.stitched::text in ('{}', 'null'))
  returning p.wind_farm, tu.id)
select wind_farm, count(*) turbinas_actualizadas from u group by 1 order by 1;

-- ═══ 2) FECHA DE INSPECCIÓN: la de la primera foto de cada turbina (EXIF DateTimeOriginal) ═══
-- Hora local de México (la del dron). Solo turbinas con `inspection_date` nulo.
with d as (
  select b.turbine_id,
         min(to_timestamp(c.raw_metadata->'exif_dump'->>'DateTimeOriginal', 'YYYY:MM:DD HH24:MI:SS')) ts
  from public.captures c join public.blades b on b.id = c.blade_id
  where c.raw_metadata->'exif_dump'->>'DateTimeOriginal' ~ '^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$'
  group by 1),
u as (
  update public.turbines t set inspection_date = (d.ts at time zone 'UTC') at time zone 'America/Mexico_City'
  from d where t.id = d.turbine_id and t.inspection_date is null
  returning t.id)
select count(*) turbinas_con_fecha_recuperada from u;
-- Nota: to_timestamp interpreta la hora como si fuera de la zona de la sesión (UTC en Supabase);
-- la segunda conversión la reinterpreta como hora de México, para que el día mostrado sea el real.

-- Marcha atrás (si algo no cuadra): volver a dejar vacío lo recuperado
--   update public.turbines set stitched = '{}' where id in (...);
