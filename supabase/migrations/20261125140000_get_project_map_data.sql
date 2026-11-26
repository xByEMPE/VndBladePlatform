-- Datos para el mapa de aerogeneradores de un proyecto.
--
-- Una fila por turbina del proyecto (incluye turbinas sin capturas o sin hallazgos):
--   max_severity : severidad máxima (1..5) entre sus hallazgos; NULL si no hay.
--   damage_count : número de hallazgos con severidad (todos los tipos, igual que los reportes).
--   gps_samples  : capturas con GPS válido usadas para la estimación.
--   est_lat/lon  : mediana del GPS de las capturas (posición "estimada por fotos"); NULL si no hay.
--
-- Seguridad: SECURITY INVOKER (RLS del llamador sobre turbines/blades/captures/findings),
-- search_path fijo y EXECUTE solo para `authenticated`.
-- El filtro de clientes (solo turbinas "Aprobado") se aplica en el frontend, como en la lista.

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
  -- Acota todo al proyecto antes de agregar (un admin ve todos los proyectos por RLS).
  project_turbines as (
    select t.id
    from public.turbines t
    where t.project_id = p_project_id
  ),
  -- Severidad por turbina. Se agrega aparte del GPS para que varios hallazgos en una misma
  -- captura no dupliquen filas y sesguen la mediana.
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
  -- GPS válido: no NULL, dentro de rango y distinto de 0,0.
  gps as (
    select
      b.turbine_id,
      count(*)::integer                                       as gps_samples,
      percentile_cont(0.5) within group (order by c.gps_lat)  as est_lat,
      percentile_cont(0.5) within group (order by c.gps_lon)  as est_lon
    from project_turbines pt
    join public.blades b   on b.turbine_id = pt.id
    join public.captures c on c.blade_id = b.id
    where c.gps_lat is not null
      and c.gps_lon is not null
      and c.gps_lat between -90 and 90
      and c.gps_lon between -180 and 180
      and not (c.gps_lat = 0 and c.gps_lon = 0)
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

-- Supabase concede EXECUTE a anon/PUBLIC por defecto: se revoca de forma explícita.
revoke all on function public.get_project_map_data(uuid) from public, anon;
grant execute on function public.get_project_map_data(uuid) to authenticated;
