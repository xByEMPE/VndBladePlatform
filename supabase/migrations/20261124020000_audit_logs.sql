-- Reconstruida desde la base de pruebas (tddtfhmkjlpbcqtahcgf): bitácora de auditoría append-only.
-- Idempotente: se puede ejecutar sobre una base que ya tiene estos objetos sin cambiar su estado final.
--
-- Contenido:
--   1) tabla public.audit_logs + índices base (los de record y txid los agrega 20261125100000)
--   2) RLS: solo un dev activo lee; sin escritura directa para ningún rol de la API
--   3) append-only: triggers que rechazan UPDATE, DELETE y TRUNCATE
--   4) private.audit_row_change() (primera versión; 20261125100000 le agrega el contexto forense) y su trigger
--      en 13 tablas de negocio (todas menos captures y findings, por volumen)

-- ============================== 1) Tabla e índices ==============================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid,
  user_role   text,
  action      text        NOT NULL,
  table_name  text        NOT NULL,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx    ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_table_name_idx ON public.audit_logs USING btree (table_name);

-- ============================== 2) RLS y permisos ==============================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_dev ON public.audit_logs;
CREATE POLICY audit_logs_select_dev ON public.audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT private.is_dev()));

-- Solo lectura para authenticated; nadie de la API escribe (las filas las crean los triggers SECURITY DEFINER).
REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated, service_role;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

-- ============================== 3) Append-only ==============================
CREATE OR REPLACE FUNCTION private.reject_audit_log_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'audit_logs es append-only: no se permite %', TG_OP
    USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS audit_logs_block_row_mutation ON public.audit_logs;
CREATE TRIGGER audit_logs_block_row_mutation
  BEFORE DELETE OR UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_block_truncate ON public.audit_logs;
CREATE TRIGGER audit_logs_block_truncate
  BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.reject_audit_log_mutation();

-- ============================== 4) Captura de cambios ==============================
CREATE OR REPLACE FUNCTION private.audit_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_old       jsonb;
  v_new       jsonb;
  v_row       jsonb;
  v_pk        jsonb;
  v_record_id text;
  v_user_id   uuid := auth.uid();
  v_user_role text;
  v_headers   jsonb;
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

  SELECT up.role::text
  INTO v_user_role
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
        'ip',         split_part(v_headers ->> 'x-forwarded-for', ',', 1),
        'user_agent', v_headers ->> 'user-agent'
      )
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

-- Un trigger por tabla de negocio (las tablas que no existan en una base dada se omiten).
-- Quedan FUERA `captures` y `findings` a propósito: son las de mayor volumen (decenas de miles de filas por proyecto),
-- y las cargas masivas y los borrados en cascada inflarían audit_logs. Si una base ya tenía el trigger en ellas, se retira.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['captures', 'findings']
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_capture_row_changes ON public.%I', t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'app-releases', 'blades', 'companies', 'instruments', 'pilots',
    'project_access', 'project_farms', 'projects', 'turbines', 'user_profiles',
    'wind_farms', 'wind_turbines', 'wtgmFile'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_capture_row_changes ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER audit_capture_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION private.audit_row_change()',
        t
      );
    END IF;
  END LOOP;
END;
$$;
