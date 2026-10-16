DO $test$
DECLARE result jsonb; expected bigint;
BEGIN
  BEGIN
    SELECT count(*) INTO expected FROM erp_mirror.bi__salesdivisionsclassification;
    result := public.erp_mirror_aggregate('{"table":"bi__salesdivisionsclassification","groups":[],"measures":[],"filters":[]}'::jsonb);
    IF (result->0->>'m1')::bigint IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Default count regression: %', result; END IF;
    result := public.erp_mirror_aggregate('{"table":"bi__salesdivisionsclassification","groups":[{"col":"salesdivisionid"}],"measures":[],"filters":[{"col":"salesdivisionid","op":"notnull"}]}'::jsonb);
    IF jsonb_typeof(result) <> 'array' THEN RAISE EXCEPTION 'Grouped count regression: %', result; END IF;
    result := public.erp_mirror_aggregate('{"table":"bi__salesdivisionsclassification","groups":[],"measures":[{"col":"salesdivisionid","fn":"count"}],"filters":[]}'::jsonb);
    IF (result->0->>'m1')::bigint IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Explicit count regression: %', result; END IF;
    -- Roll back the function's transaction-local read-only setting after testing.
    RAISE SQLSTATE 'ZX001' USING MESSAGE = 'Regression checks passed';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END
$test$;