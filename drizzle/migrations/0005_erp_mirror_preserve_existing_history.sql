CREATE OR REPLACE FUNCTION public.erp_mirror_finish_table(p_table text, p_run uuid, p_rows bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror', 'public' SET statement_timeout TO '15min'
AS $$
DECLARE retained bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM erp_mirror._tables WHERE table_name = p_table) THEN
    RAISE EXCEPTION 'unknown table %', p_table;
  END IF;
  -- Preserve all previously mirrored rows, including historical rows outside future transfer windows.
  EXECUTE format('SELECT count(*) FROM erp_mirror.%I', p_table) INTO retained;
  UPDATE erp_mirror._tables SET row_count = retained, last_run = p_run,
    last_synced_at = now(), last_error = NULL, retry_requested = false
    WHERE table_name = p_table;
  RETURN 0;
END $$;
REVOKE ALL ON FUNCTION public.erp_mirror_finish_table(text,uuid,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_finish_table(text,uuid,bigint) TO service_role;
COMMENT ON FUNCTION public.erp_mirror_finish_table(text,uuid,bigint) IS 'Completes a mirror transfer without deleting any previously copied data; catalog count includes retained history.';