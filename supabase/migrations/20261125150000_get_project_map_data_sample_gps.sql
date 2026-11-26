-- Acotar el costo de get_project_map_data con muestreo del GPS.
-- (Aprobada y aplicada.)
--
-- PROBLEMA (medido con un usuario real, es decir CON RLS, en el proyecto de .env.local):
--   * La política de captures evalúa private.can_read_project(private.project_id_of_blade(blade_id)) POR CADA FILA.
--   * La mediana del GPS leía TODAS las capturas del proyecto: ~0.8 ms por captura.
--       1 turbina / 212 capturas  → 163 ms de los 190 ms de la RPC (sin RLS: 7 ms).
--       100 turbinas / ~70 000 capturas → ~55 s, por encima del statement_timeout de 'authenticated' (8 s):
--       la RPC fallaría justo en los proyectos grandes.
--   * La severidad (findings, pocas filas) cuesta 9 ms: no es el problema.
--
-- CAMBIO: la mediana usa una muestra de hasta 10 capturas con GPS válido POR PALA (≤ 30 por turbina).
--   El id es un uuid aleatorio, así que `order by id` es una muestra uniforme. Para una dispersión de ~10 m, la
--   mediana de 30 puntos difiere de la de todas en < 1 m (turbina 25: 16.563638, -94.736723 con muestra frente a
--   16.563632, -94.736727 con todas). El costo pasa a ser acotado: ~2-3 s para 100 turbinas.
--   `gps_samples` pasa a significar "capturas usadas en la estimación" (máx. 30).
--
-- Se mantiene todo lo demás: SECURITY INVOKER, search_path fijo, filtros de GPS (NULL, rango, 0,0),
-- LEFT JOIN desde las turbinas del proyecto y EXECUTE solo para authenticated.

create or replace function public.get_project_map_data(p_project_id uuid)
returns table (
  turbine_id   uuid,
  max_severity integer,
  damage_count integer,
  gps_samples  integer,
  est_lat      double precision,
  est_lon      double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with
  project_turbines as (
    select t.id
    from public.turbines t
    where t.project_id = p_project_id
  ),
  sev as (
    select
      b.turbine_id,
      max((f.severity)::text::integer) as max_severity,
      count(f.id)::integer             as damage_count
    from project_turbines pt
    join public.blades b   on b.turbine_id = pt.id
    join public.captures c on c.blade_id = b.id
    join public.findings f on f.capture_id = c.id and f.severity is not null
    group by b.turbine_id
  ),
  -- GPS válido (no NULL, en rango, distinto de 0,0): hasta 10 capturas por pala, para acotar el costo del RLS.
  gps as (
    select
      b.turbine_id,
      count(*)::integer                                      as gps_samples,
      percentile_cont(0.5) within group (order by s.gps_lat) as est_lat,
      percentile_cont(0.5) within group (order by s.gps_lon) as est_lon
    from project_turbines pt
    join public.blades b on b.turbine_id = pt.id
    cross join lateral (
      select c.gps_lat, c.gps_lon
      from public.captures c
      where c.blade_id = b.id
        and c.gps_lat is not null
        and c.gps_lon is not null
        and c.gps_lat between -90 and 90
        and c.gps_lon between -180 and 180
        and not (c.gps_lat = 0 and c.gps_lon = 0)
      order by c.id
      limit 10
    ) s
    group by b.turbine_id
  )
  select
    pt.id,
    sev.max_severity,
    coalesce(sev.damage_count, 0),
    coalesce(gps.gps_samples, 0),
    gps.est_lat,
    gps.est_lon
  from project_turbines pt
  left join sev on sev.turbine_id = pt.id
  left join gps on gps.turbine_id = pt.id;
$$;

-- `create or replace` conserva los permisos existentes; se repiten por si la función se recrea desde cero.
revoke all on function public.get_project_map_data(uuid) from public, anon;
grant execute on function public.get_project_map_data(uuid) to authenticated;
