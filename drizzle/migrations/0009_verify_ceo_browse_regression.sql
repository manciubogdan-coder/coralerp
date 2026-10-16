DO $test$
DECLARE r jsonb;
BEGIN
r:=public.erp_mirror_browse('{"table":"bi__salesdivisionsclassification","offset":0}'::jsonb);
IF jsonb_typeof(r->'rows') <> 'array' OR jsonb_array_length(r->'rows') <> 1 THEN RAISE EXCEPTION 'Browse count mismatch'; END IF;
IF (r->'rows'->0) ? '_pk' THEN RAISE EXCEPTION 'Internal metadata exposed'; END IF;
r:=public.erp_mirror_browse('{"table":"bi__salesdivisionsclassification","offset":0,"search_col":"salesdivisionid","search":"unmatched-test-value"}'::jsonb);
IF jsonb_array_length(r->'rows')<>0 THEN RAISE EXCEPTION 'Search filtering failed'; END IF;
BEGIN
PERFORM public.erp_mirror_browse('{"table":"bi__salesdivisionsclassification","offset":0,"date_col":"salesdivisionid","start":"2026-01-01","end":"2026-10-16"}'::jsonb);
RAISE EXCEPTION 'Invalid date column was accepted';
EXCEPTION WHEN OTHERS THEN
IF SQLERRM <> 'Coloană de dată invalidă' THEN RAISE; END IF;
END;
END
$test$;