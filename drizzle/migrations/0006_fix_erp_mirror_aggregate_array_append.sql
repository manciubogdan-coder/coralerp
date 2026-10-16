DO $migration$
DECLARE
  definition text;
BEGIN
  definition := pg_get_functiondef('public.erp_mirror_aggregate(jsonb)'::regprocedure);
  IF strpos(definition, 'sel := sel || ''count(*) AS m1''') = 0 THEN
    RAISE EXCEPTION 'Expected aggregate fallback not found';
  END IF;
  definition := replace(definition, 'sel := sel || format(''%s AS %I'', expr, ''g'' || n)', 'sel := array_append(sel, format(''%s AS %I'', expr, ''g'' || n))');
  definition := replace(definition, 'grp := grp || expr', 'grp := array_append(grp, expr)');
  definition := replace(definition, 'sel := sel || format(''%s AS %I'', expr, ''m'' || n)', 'sel := array_append(sel, format(''%s AS %I'', expr, ''m'' || n))');
  definition := replace(definition, 'sel := sel || ''count(*) AS m1''', 'sel := array_append(sel, ''count(*) AS m1'')');
  definition := replace(definition, 'whr := whr || CASE op', 'whr := array_append(whr, CASE op');
  definition := replace(definition, 'ELSE NULL END;', 'ELSE NULL END);');
  EXECUTE definition;
END
$migration$;
REVOKE ALL ON FUNCTION public.erp_mirror_aggregate(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_aggregate(jsonb) TO service_role;