CREATE TABLE IF NOT EXISTS erp_mirror._live_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('catalog','aggregate')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  picked_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS live_requests_pending_idx ON erp_mirror._live_requests (created_at) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS erp_mirror._live_state (key text PRIMARY KEY, value jsonb, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE erp_mirror._reports ADD COLUMN IF NOT EXISTS result jsonb;
ALTER TABLE erp_mirror._reports ADD COLUMN IF NOT EXISTS refreshed_at timestamptz;
REVOKE ALL ON erp_mirror._live_requests, erp_mirror._live_state FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.erp_mirror_essential_tables() RETURNS text[] LANGUAGE sql IMMUTABLE AS
$$ SELECT ARRAY['accountingstatistics','c_plan_contabil','c_tipuri_document','c_h_note_contabile','c_h_note_contabile_parteneri'] $$;

CREATE OR REPLACE FUNCTION public.erp_mirror_ensure_table(p_table text, p_source text, p_columns jsonb, p_pk text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror', 'public'
AS $function$
DECLARE c jsonb; t text; allowed text[] := ARRAY['bigint','numeric','boolean','date','timestamp','timestamptz','text'];
BEGIN
  IF p_table !~ '^[a-z0-9_]{1,63}$' OR left(p_table,1) = '_' THEN RAISE EXCEPTION 'invalid table name %', p_table; END IF;
  -- Only the essential tables are copied; everything else is read live from Senior.
  IF NOT (p_table = ANY(public.erp_mirror_essential_tables())) THEN RAISE EXCEPTION 'tabel neesential: se citeste direct din Senior'; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.erp_live_enqueue(p_kind text, p_payload jsonb) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path TO 'erp_mirror' AS
$$ INSERT INTO erp_mirror._live_requests(kind, payload) VALUES (p_kind, coalesce(p_payload,'{}')) RETURNING id $$;

CREATE OR REPLACE FUNCTION public.erp_live_get(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'erp_mirror' AS
$$ SELECT jsonb_build_object('status', status, 'result', result, 'error', error) FROM erp_mirror._live_requests WHERE id = p_id $$;

CREATE OR REPLACE FUNCTION public.erp_live_pull(p_limit int DEFAULT 3) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
DECLARE r jsonb;
BEGIN
  INSERT INTO erp_mirror._live_state(key, value, updated_at) VALUES ('agent', '{}'::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET updated_at = now();
  DELETE FROM erp_mirror._live_requests WHERE created_at < now() - interval '1 hour';
  -- Requests nobody answered within 2 minutes are abandoned by the caller anyway.
  UPDATE erp_mirror._live_requests SET status = 'error', error = 'expirat', finished_at = now()
    WHERE status IN ('pending','running') AND created_at < now() - interval '2 minutes';
  WITH picked AS (
    SELECT id FROM erp_mirror._live_requests WHERE status = 'pending'
    ORDER BY created_at LIMIT least(greatest(coalesce(p_limit,3),1),10) FOR UPDATE SKIP LOCKED
  )
  UPDATE erp_mirror._live_requests q SET status = 'running', picked_at = now()
    FROM picked WHERE q.id = picked.id
    RETURNING jsonb_build_object('id', q.id, 'kind', q.kind, 'payload', q.payload) INTO r;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'payload', payload)), '[]'::jsonb) INTO r
    FROM erp_mirror._live_requests WHERE status = 'running' AND picked_at >= now() - interval '2 seconds';
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.erp_live_complete(p_id uuid, p_result jsonb, p_error text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
DECLARE k text;
BEGIN
  UPDATE erp_mirror._live_requests SET status = CASE WHEN p_error IS NULL THEN 'done' ELSE 'error' END,
    result = p_result, error = left(p_error, 2000), finished_at = now()
    WHERE id = p_id RETURNING kind INTO k;
  IF k = 'catalog' AND p_error IS NULL THEN
    INSERT INTO erp_mirror._live_state(key, value, updated_at) VALUES ('catalog', p_result, now())
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.erp_live_state(p_key text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'erp_mirror' AS
$$ SELECT jsonb_build_object('value', value, 'updated_at', updated_at) FROM erp_mirror._live_state WHERE key = p_key $$;

CREATE OR REPLACE FUNCTION public.erp_mirror_reports(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror'
AS $function$
DECLARE r jsonb;
BEGIN
  IF p_action = 'list' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at), '[]') INTO r FROM erp_mirror._reports t;
  ELSIF p_action = 'save' THEN
    INSERT INTO erp_mirror._reports(title, config, created_by, result, refreshed_at)
    VALUES (p_data->>'title', p_data->'config', p_data->>'created_by', p_data->'result', CASE WHEN p_data ? 'result' THEN now() END)
    RETURNING to_jsonb(_reports) INTO r;
  ELSIF p_action = 'set_result' THEN
    UPDATE erp_mirror._reports SET result = p_data->'result', refreshed_at = now() WHERE id = (p_data->>'id')::uuid RETURNING to_jsonb(_reports) INTO r;
  ELSIF p_action = 'delete' THEN
    DELETE FROM erp_mirror._reports WHERE id = (p_data->>'id')::uuid; r := '{"ok":true}';
  ELSE RAISE EXCEPTION 'acțiune invalidă'; END IF;
  RETURN r;
END $function$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['erp_live_enqueue(text,jsonb)','erp_live_get(uuid)','erp_live_pull(int)','erp_live_complete(uuid,jsonb,text)','erp_live_state(text)','erp_mirror_reports(text,jsonb)','erp_mirror_ensure_table(text,text,jsonb,text[])','erp_mirror_essential_tables()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;