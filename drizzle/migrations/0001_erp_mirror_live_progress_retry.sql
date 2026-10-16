ALTER TABLE erp_mirror._tables ADD COLUMN IF NOT EXISTS retry_requested boolean NOT NULL DEFAULT false;
ALTER TABLE erp_mirror._runs ADD COLUMN IF NOT EXISTS current_table text, ADD COLUMN IF NOT EXISTS current_rows bigint, ADD COLUMN IF NOT EXISTS current_total bigint, ADD COLUMN IF NOT EXISTS tables_done int, ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

CREATE OR REPLACE FUNCTION public.erp_mirror_finish_table(p_table text, p_run uuid, p_rows bigint)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror', 'public' SET statement_timeout TO '15min'
AS $function$
DECLARE d bigint := 0; prev uuid;
BEGIN
  SELECT last_run INTO prev FROM erp_mirror._tables WHERE table_name = p_table;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown table %', p_table; END IF;
  -- La prima copiere completă nu există rânduri vechi de șters: sărim DELETE-ul (scump pe tabele mari).
  IF prev IS NOT NULL THEN
    EXECUTE format('DELETE FROM erp_mirror.%I WHERE _run IS DISTINCT FROM $1', p_table) USING p_run;
    GET DIAGNOSTICS d = ROW_COUNT;
  END IF;
  UPDATE erp_mirror._tables SET row_count = p_rows, last_run = p_run, last_synced_at = now(), last_error = NULL, retry_requested = false WHERE table_name = p_table;
  RETURN d;
END $function$;

CREATE OR REPLACE FUNCTION public.erp_mirror_log(p_run uuid, p_data jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror', 'public'
AS $function$
BEGIN
  INSERT INTO erp_mirror._runs(id, host) VALUES (p_run, p_data->>'host') ON CONFLICT (id) DO NOTHING;
  UPDATE erp_mirror._runs SET
    finished_at = CASE WHEN (p_data->>'finished')::boolean THEN now() ELSE finished_at END,
    tables_total = coalesce((p_data->>'tables_total')::int, tables_total),
    tables_synced = coalesce((p_data->>'tables_synced')::int, tables_synced),
    tables_skipped = coalesce((p_data->>'tables_skipped')::int, tables_skipped),
    rows_synced = coalesce((p_data->>'rows_synced')::bigint, rows_synced),
    tables_done = coalesce((p_data->>'tables_done')::int, tables_done),
    current_table = CASE WHEN p_data ? 'current_table' THEN p_data->>'current_table' ELSE current_table END,
    current_rows = coalesce((p_data->>'current_rows')::bigint, current_rows),
    current_total = coalesce((p_data->>'current_total')::bigint, current_total),
    heartbeat_at = now(),
    errors = coalesce(p_data->'errors', errors)
  WHERE id = p_run;
  IF p_data ? 'table_error' THEN
    UPDATE erp_mirror._tables SET last_error = p_data->'table_error'->>'error' WHERE table_name = p_data->'table_error'->>'table';
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.erp_mirror_request_retry(p_tables text[] DEFAULT NULL)
 RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror'
AS $function$
DECLARE n int;
BEGIN
  UPDATE erp_mirror._tables SET retry_requested = true
  WHERE (p_tables IS NULL AND last_error IS NOT NULL) OR table_name = ANY(coalesce(p_tables, '{}'));
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $function$;

CREATE OR REPLACE FUNCTION public.erp_mirror_pending_retries()
 RETURNS text[] LANGUAGE sql SECURITY DEFINER SET search_path TO 'erp_mirror'
AS $$ SELECT coalesce(array_agg(source_name), '{}') FROM erp_mirror._tables WHERE retry_requested $$;

CREATE OR REPLACE FUNCTION public.erp_mirror_status()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror'
AS $function$ declare result jsonb; begin select jsonb_build_object(
 'totals', (select jsonb_build_object('tables', count(*) filter (where last_synced_at is not null), 'rows', coalesce(sum(row_count),0), 'last_synced_at', max(last_synced_at), 'tables_with_errors', count(*) filter (where last_error is not null)) from erp_mirror._tables),
 'runs', (select coalesce(jsonb_agg(r order by r.started_at desc), '[]'::jsonb) from (select ru.id, ru.started_at, ru.finished_at, ru.host, ru.tables_total, ru.tables_synced, ru.tables_skipped, ru.rows_synced, ru.errors, ru.tables_done, ru.current_table, ru.current_rows, ru.current_total, ru.heartbeat_at,
    (select count(*) from erp_mirror._tables t where t.last_run = ru.id) as tables_copied_live from erp_mirror._runs ru order by started_at desc limit 10) r),
 'tables', (select coalesce(jsonb_agg(t order by t.last_error is null, t.last_synced_at desc nulls last), '[]'::jsonb) from (select table_name, source_name, row_count, last_synced_at, last_error, retry_requested from erp_mirror._tables) t)
) into result; return result; end $function$;

REVOKE ALL ON FUNCTION public.erp_mirror_request_retry(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_mirror_pending_retries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_request_retry(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.erp_mirror_pending_retries() TO service_role;