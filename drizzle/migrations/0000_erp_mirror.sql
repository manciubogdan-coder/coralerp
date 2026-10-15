CREATE SCHEMA IF NOT EXISTS erp_mirror;
REVOKE ALL ON SCHEMA erp_mirror FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA erp_mirror TO service_role;

CREATE TABLE IF NOT EXISTS erp_mirror._tables (
  table_name text PRIMARY KEY,
  source_name text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_pk text[] NOT NULL DEFAULT '{}',
  row_count bigint NOT NULL DEFAULT 0,
  last_run uuid,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_mirror._runs (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  host text,
  tables_total int NOT NULL DEFAULT 0,
  tables_synced int NOT NULL DEFAULT 0,
  tables_skipped int NOT NULL DEFAULT 0,
  rows_synced bigint NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT ALL ON ALL TABLES IN SCHEMA erp_mirror TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp_mirror GRANT ALL ON TABLES TO service_role;

CREATE OR REPLACE FUNCTION public.erp_mirror_ensure_table(p_table text, p_source text, p_columns jsonb, p_pk text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp_mirror, public AS $$
DECLARE c jsonb; t text; allowed text[] := ARRAY['bigint','numeric','boolean','date','timestamp','timestamptz','text'];
BEGIN
  IF p_table !~ '^[a-z0-9_]{1,63}$' OR left(p_table,1) = '_' THEN RAISE EXCEPTION 'invalid table name %', p_table; END IF;
  EXECUTE format('CREATE TABLE IF NOT EXISTS erp_mirror.%I (_pk text PRIMARY KEY, _run uuid, _synced_at timestamptz NOT NULL DEFAULT now())', p_table);
  FOR c IN SELECT * FROM jsonb_array_elements(p_columns) LOOP
    t := c->>'type';
    IF NOT (t = ANY(allowed)) THEN t := 'text'; END IF;
    IF (c->>'name') IN ('_pk','_run','_synced_at') THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE erp_mirror.%I ADD COLUMN IF NOT EXISTS %I %s', p_table, left(c->>'name',63), t);
  END LOOP;
  INSERT INTO erp_mirror._tables(table_name, source_name, columns, source_pk)
  VALUES (p_table, p_source, p_columns, coalesce(p_pk,'{}'))
  ON CONFLICT (table_name) DO UPDATE SET source_name = excluded.source_name, columns = excluded.columns, source_pk = excluded.source_pk;
END $$;

CREATE OR REPLACE FUNCTION public.erp_mirror_upsert(p_table text, p_run uuid, p_rows jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp_mirror, public AS $$
DECLARE cols text; upd text; n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM erp_mirror._tables WHERE table_name = p_table) THEN RAISE EXCEPTION 'unknown table %', p_table; END IF;
  SELECT string_agg(format('%I', column_name), ',' ORDER BY ordinal_position),
         string_agg(format('%I = excluded.%I', column_name, column_name), ',' ORDER BY ordinal_position) FILTER (WHERE column_name <> '_pk')
    INTO cols, upd
  FROM information_schema.columns WHERE table_schema = 'erp_mirror' AND table_name = p_table AND column_name NOT IN ('_run','_synced_at');
  EXECUTE format(
    'INSERT INTO erp_mirror.%1$I (%2$s, _run, _synced_at) SELECT %2$s, $2, now() FROM jsonb_populate_recordset(NULL::erp_mirror.%1$I, $1) ON CONFLICT (_pk) DO UPDATE SET %3$s, _run = excluded._run, _synced_at = now()',
    p_table, cols, coalesce(upd || ',', '') || '_pk = excluded._pk')
  USING p_rows, p_run;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.erp_mirror_finish_table(p_table text, p_run uuid, p_rows bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp_mirror, public AS $$
DECLARE d bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM erp_mirror._tables WHERE table_name = p_table) THEN RAISE EXCEPTION 'unknown table %', p_table; END IF;
  EXECUTE format('DELETE FROM erp_mirror.%I WHERE _run IS DISTINCT FROM $1', p_table) USING p_run;
  GET DIAGNOSTICS d = ROW_COUNT;
  UPDATE erp_mirror._tables SET row_count = p_rows, last_run = p_run, last_synced_at = now(), last_error = NULL WHERE table_name = p_table;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.erp_mirror_log(p_run uuid, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp_mirror, public AS $$
BEGIN
  INSERT INTO erp_mirror._runs(id, host) VALUES (p_run, p_data->>'host') ON CONFLICT (id) DO NOTHING;
  UPDATE erp_mirror._runs SET
    finished_at = CASE WHEN (p_data->>'finished')::boolean THEN now() ELSE finished_at END,
    tables_total = coalesce((p_data->>'tables_total')::int, tables_total),
    tables_synced = coalesce((p_data->>'tables_synced')::int, tables_synced),
    tables_skipped = coalesce((p_data->>'tables_skipped')::int, tables_skipped),
    rows_synced = coalesce((p_data->>'rows_synced')::bigint, rows_synced),
    errors = coalesce(p_data->'errors', errors)
  WHERE id = p_run;
  IF p_data ? 'table_error' THEN
    UPDATE erp_mirror._tables SET last_error = p_data->'table_error'->>'error' WHERE table_name = p_data->'table_error'->>'table';
  END IF;
END $$;

-- Read-only query helper for reports (service role / Argus only)
CREATE OR REPLACE FUNCTION public.erp_mirror_query(p_sql text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp_mirror AS $$
DECLARE r jsonb;
BEGIN
  IF p_sql !~* '^\s*(select|with)\s' OR p_sql ~ ';\s*\S' THEN RAISE EXCEPTION 'only single SELECT allowed'; END IF;
  SET LOCAL transaction_read_only = on;
  SET LOCAL statement_timeout = '20s';
  EXECUTE format('SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (SELECT * FROM (%s) q LIMIT 2000) t', regexp_replace(p_sql, ';\s*$', '')) INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.erp_mirror_ensure_table(text,text,jsonb,text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_mirror_upsert(text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_mirror_finish_table(text,uuid,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_mirror_log(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_mirror_query(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_ensure_table(text,text,jsonb,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.erp_mirror_upsert(text,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.erp_mirror_finish_table(text,uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.erp_mirror_log(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.erp_mirror_query(text) TO service_role;