-- Filtro por usuario en la bitácora de auditoría.
--
-- Qué cambia:
--   * audit_logs_filtered / audit_logs_search / audit_logs_stats reciben p_user (uuid): solo eventos de ese usuario.
--   * La búsqueda de texto libre (p_query) ahora también coincide con el NOMBRE del usuario (full_name),
--     además de correo, rol, tabla, record_id y contenido.
--
-- Seguridad: se mantiene SECURITY INVOKER y search_path fijo; la RLS de audit_logs (solo 'dev') sigue
-- aplicando, así que un no-dev recibe 0 filas. Mismos GRANT/REVOKE que antes.
-- Índice: audit_logs_user_id_idx ya existe (filtro por user_id).
--
-- Cambiar la firma exige borrar las versiones anteriores (si no, quedarían sobrecargas ambiguas
-- para PostgREST).

DROP FUNCTION IF EXISTS public.audit_logs_search(text, text, text, timestamptz, timestamptz, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.audit_logs_stats(text, text, text, timestamptz, timestamptz, text, text);
DROP FUNCTION IF EXISTS public.audit_logs_filtered(text, text, text, timestamptz, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.audit_logs_filtered(
  p_query  text        DEFAULT NULL,
  p_table  text        DEFAULT NULL,
  p_action text        DEFAULT NULL,
  p_from   timestamptz DEFAULT NULL,
  p_to     timestamptz DEFAULT NULL,
  p_record text        DEFAULT NULL,
  p_txid   text        DEFAULT NULL,
  p_user   uuid        DEFAULT NULL
)
 RETURNS SETOF public.audit_logs
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH params AS (
    SELECT CASE WHEN coalesce(btrim(p_query), '') = '' THEN NULL
                ELSE '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
           END AS pat
  )
  SELECT l.*
  FROM public.audit_logs AS l
  LEFT JOIN public.user_profiles AS up ON up.id = l.user_id
  CROSS JOIN params
  WHERE (p_table  IS NULL OR l.table_name = p_table)
    AND (p_action IS NULL OR l.action = p_action)
    AND (p_from   IS NULL OR l.created_at >= p_from)
    AND (p_to     IS NULL OR l.created_at <= p_to)
    AND (p_record IS NULL OR l.record_id = p_record)
    AND (p_txid   IS NULL OR l.metadata ->> 'txid' = p_txid)
    AND (p_user   IS NULL OR l.user_id = p_user)
    AND (
      params.pat IS NULL
      OR l.record_id  ILIKE params.pat
      OR l.table_name ILIKE params.pat
      OR l.user_role  ILIKE params.pat
      OR up.email     ILIKE params.pat
      OR up.full_name ILIKE params.pat
      OR l.metadata::text ILIKE params.pat
      OR l.old_data::text ILIKE params.pat
      OR l.new_data::text ILIKE params.pat
    );
$function$;

CREATE OR REPLACE FUNCTION public.audit_logs_search(
  p_query  text        DEFAULT NULL,
  p_table  text        DEFAULT NULL,
  p_action text        DEFAULT NULL,
  p_from   timestamptz DEFAULT NULL,
  p_to     timestamptz DEFAULT NULL,
  p_record text        DEFAULT NULL,
  p_txid   text        DEFAULT NULL,
  p_user   uuid        DEFAULT NULL,
  p_limit  integer     DEFAULT 100,
  p_offset integer     DEFAULT 0
)
 RETURNS TABLE (
   id         uuid,
   user_id    uuid,
   user_role  text,
   action     text,
   table_name text,
   record_id  text,
   old_data   jsonb,
   new_data   jsonb,
   metadata   jsonb,
   created_at timestamptz,
   total      bigint
 )
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT f.id, f.user_id, f.user_role, f.action, f.table_name, f.record_id,
         f.old_data, f.new_data, f.metadata, f.created_at,
         count(*) OVER () AS total
  FROM public.audit_logs_filtered(p_query, p_table, p_action, p_from, p_to, p_record, p_txid, p_user) AS f
  ORDER BY f.created_at DESC, f.id
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 500)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$function$;

CREATE OR REPLACE FUNCTION public.audit_logs_stats(
  p_query  text        DEFAULT NULL,
  p_table  text        DEFAULT NULL,
  p_action text        DEFAULT NULL,
  p_from   timestamptz DEFAULT NULL,
  p_to     timestamptz DEFAULT NULL,
  p_record text        DEFAULT NULL,
  p_txid   text        DEFAULT NULL,
  p_user   uuid        DEFAULT NULL
)
 RETURNS TABLE (total bigint, inserts bigint, updates bigint, deletes bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT count(*),
         count(*) FILTER (WHERE f.action = 'INSERT'),
         count(*) FILTER (WHERE f.action = 'UPDATE'),
         count(*) FILTER (WHERE f.action = 'DELETE')
  FROM public.audit_logs_filtered(p_query, p_table, p_action, p_from, p_to, p_record, p_txid, p_user) AS f;
$function$;

REVOKE ALL ON FUNCTION public.audit_logs_filtered(text, text, text, timestamptz, timestamptz, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_logs_search(text, text, text, timestamptz, timestamptz, text, text, uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_logs_stats(text, text, text, timestamptz, timestamptz, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_logs_filtered(text, text, text, timestamptz, timestamptz, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_logs_search(text, text, text, timestamptz, timestamptz, text, text, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_logs_stats(text, text, text, timestamptz, timestamptz, text, text, uuid) TO authenticated;
