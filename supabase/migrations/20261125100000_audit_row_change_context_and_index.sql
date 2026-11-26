-- Fase 1 de auditoría: contexto forense en cada fila + índices.
-- metadata ahora incluye: session_id (sesión del login), actor_email (correo EN ESE MOMENTO),
-- txid (agrupa un borrado con sus cascadas) y db_user (cuando no hay sesión: SQL Editor/servicio).
CREATE OR REPLACE FUNCTION private.audit_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_old        jsonb;
  v_new        jsonb;
  v_row        jsonb;
  v_pk         jsonb;
  v_record_id  text;
  v_user_id    uuid := auth.uid();
  v_user_role  text;
  v_user_email text;
  v_headers    jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := NULL;
  END IF;

  v_row := coalesce(v_new, v_old);

  SELECT up.role::text, up.email
  INTO v_user_role, v_user_email
  FROM public.user_profiles AS up
  WHERE up.id = v_user_id;

  -- Resuelve la PK desde el catálogo, incluidas las claves compuestas.
  SELECT jsonb_object_agg(
           a.attname,
           v_row -> a.attname
           ORDER BY k.ordinality
         )
  INTO v_pk
  FROM pg_catalog.pg_index AS i
  JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality)
    ON k.ordinality <= i.indnkeyatts
  JOIN pg_catalog.pg_attribute AS a
    ON a.attrelid = i.indrelid
   AND a.attnum = k.attnum
   AND NOT a.attisdropped
  WHERE i.indrelid = TG_RELID
    AND i.indisprimary;

  -- jsonb_object_keys() cuenta las claves de la PK.
  IF v_pk IS NOT NULL
     AND (SELECT count(*) FROM jsonb_object_keys(v_pk)) = 1
  THEN
    SELECT e.value
    INTO v_record_id
    FROM jsonb_each_text(v_pk) AS e;
  ELSIF v_pk IS NOT NULL THEN
    v_record_id := v_pk::text;
  END IF;

  v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;

  INSERT INTO public.audit_logs (
    user_id,
    user_role,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    metadata
  )
  VALUES (
    v_user_id,
    v_user_role,
    TG_OP,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    v_record_id,
    v_old,
    v_new,
    jsonb_strip_nulls(
      jsonb_build_object(
        'ip',          split_part(v_headers ->> 'x-forwarded-for', ',', 1),
        'user_agent',  v_headers ->> 'user-agent',
        'session_id',  (SELECT auth.jwt() ->> 'session_id'),
        'actor_email', coalesce((SELECT auth.jwt() ->> 'email'), v_user_email),
        'txid',        txid_current(),
        'db_user',     CASE WHEN v_user_id IS NULL THEN current_user::text END
      )
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

-- Historial de un registro: filtrar por tabla + record_id ordenado por fecha.
CREATE INDEX IF NOT EXISTS audit_logs_table_record_created_idx
  ON public.audit_logs (table_name, record_id, created_at DESC);

-- Agrupar por transacción (borrado + cascadas) para la restauración (Fase 2).
CREATE INDEX IF NOT EXISTS audit_logs_txid_idx
  ON public.audit_logs ((metadata ->> 'txid'));
