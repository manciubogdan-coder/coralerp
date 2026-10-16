CREATE TABLE IF NOT EXISTS erp_mirror._reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  config jsonb NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON erp_mirror._reports TO service_role;

CREATE OR REPLACE FUNCTION public.erp_mirror_catalog()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('table', t.table_name, 'source', t.source_name, 'rows', t.row_count,
    'columns', (SELECT jsonb_agg(jsonb_build_object('name', c.column_name, 'type', c.data_type) ORDER BY c.ordinal_position)
                FROM information_schema.columns c WHERE c.table_schema='erp_mirror' AND c.table_name=t.table_name AND c.column_name NOT IN ('_pk','_run','_synced_at')))
    ORDER BY t.source_name), '[]'::jsonb)
  FROM erp_mirror._tables t WHERE t.last_synced_at IS NOT NULL AND t.row_count > 0;
$$;

CREATE OR REPLACE FUNCTION public.erp_mirror_aggregate(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
DECLARE tbl text := p->>'table'; g jsonb; m jsonb; f jsonb; sel text[] := '{}'; grp text[] := '{}'; whr text[] := '{}';
  expr text; col text; fn text; op text; ord text; lim int; r jsonb; n int := 0;
BEGIN
  IF tbl IS NULL OR NOT EXISTS (SELECT 1 FROM erp_mirror._tables WHERE table_name = tbl) THEN RAISE EXCEPTION 'tabel necunoscut'; END IF;
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'groups','[]')) LOOP
    col := g->>'col';
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='erp_mirror' AND table_name=tbl AND column_name=col) THEN RAISE EXCEPTION 'coloană necunoscută %', col; END IF;
    expr := CASE g->>'bucket' WHEN 'month' THEN format('to_char(%I::timestamp,''YYYY-MM'')', col) WHEN 'year' THEN format('to_char(%I::timestamp,''YYYY'')', col) WHEN 'day' THEN format('to_char(%I::timestamp,''YYYY-MM-DD'')', col) ELSE format('%I::text', col) END;
    n := n + 1; sel := sel || format('%s AS %I', expr, 'g' || n); grp := grp || expr;
  END LOOP;
  n := 0;
  FOR m IN SELECT * FROM jsonb_array_elements(coalesce(p->'measures','[]')) LOOP
    col := m->>'col'; fn := lower(coalesce(m->>'fn','count')); n := n + 1;
    IF fn NOT IN ('sum','count','avg','min','max','count_distinct') THEN RAISE EXCEPTION 'funcție invalidă'; END IF;
    IF col IS NULL OR col = '*' THEN expr := 'count(*)';
    ELSE
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='erp_mirror' AND table_name=tbl AND column_name=col) THEN RAISE EXCEPTION 'coloană necunoscută %', col; END IF;
      expr := CASE fn WHEN 'count_distinct' THEN format('count(DISTINCT %I)', col) WHEN 'count' THEN format('count(%I)', col) ELSE format('%s(%I)', fn, col) END;
    END IF;
    sel := sel || format('%s AS %I', expr, 'm' || n);
  END LOOP;
  IF n = 0 THEN sel := sel || 'count(*) AS m1'; END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(coalesce(p->'filters','[]')) LOOP
    col := f->>'col'; op := f->>'op';
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='erp_mirror' AND table_name=tbl AND column_name=col) THEN RAISE EXCEPTION 'coloană necunoscută %', col; END IF;
    whr := whr || CASE op
      WHEN 'eq' THEN format('%I::text = %L', col, f->>'value')
      WHEN 'neq' THEN format('%I::text <> %L', col, f->>'value')
      WHEN 'contains' THEN format('%I::text ILIKE %L', col, '%' || (f->>'value') || '%')
      WHEN 'starts' THEN format('%I::text ILIKE %L', col, (f->>'value') || '%')
      WHEN 'gte' THEN format('%I >= %L', col, f->>'value')
      WHEN 'lte' THEN format('%I <= %L', col, f->>'value')
      WHEN 'notnull' THEN format('%I IS NOT NULL', col)
      ELSE NULL END;
  END LOOP;
  whr := array_remove(whr, NULL);
  lim := least(greatest(coalesce((p->>'limit')::int, 200), 1), 2000);
  ord := CASE WHEN p->>'order' = 'group' AND array_length(grp,1) > 0 THEN '1' ELSE '"m1" DESC NULLS LAST' END;
  SET LOCAL transaction_read_only = on;
  SET LOCAL statement_timeout = '25s';
  EXECUTE format('SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (SELECT %s FROM erp_mirror.%I %s %s ORDER BY %s LIMIT %s) t',
    array_to_string(sel, ', '), tbl,
    CASE WHEN array_length(whr,1) > 0 THEN 'WHERE ' || array_to_string(whr, ' AND ') ELSE '' END,
    CASE WHEN array_length(grp,1) > 0 THEN 'GROUP BY ' || array_to_string(grp, ', ') ELSE '' END,
    ord, lim) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.erp_mirror_pnl(p_year int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
WITH b AS (
  SELECT a.periodid, p.cont, p.descriere, left(a.periodid,4)::int y,
    CASE WHEN p.cont LIKE '7%' THEN a.creditturnover - a.debitturnover ELSE 0 END rev,
    CASE WHEN p.cont LIKE '6%' THEN a.debitturnover - a.creditturnover ELSE 0 END exp
  FROM erp_mirror.accountingstatistics a JOIN erp_mirror.c_plan_contabil p ON p.analitic_id = a.analiticid
  WHERE a.tipsubiectid = 1 AND (p.cont LIKE '6%' OR p.cont LIKE '7%') AND p.cont NOT LIKE '121%'
    AND left(a.periodid,4)::int IN (p_year, p_year - 1) AND length(a.periodid) = 6
)
SELECT jsonb_build_object(
  'months', (SELECT coalesce(jsonb_agg(x ORDER BY x.period), '[]') FROM (SELECT periodid period, y, round(sum(rev),2) revenue, round(sum(exp),2) expenses FROM b GROUP BY periodid, y) x),
  'top_revenue', (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT cont, max(descriere) name, round(sum(rev),2) value FROM b WHERE y = p_year AND cont LIKE '7%' GROUP BY cont ORDER BY 3 DESC LIMIT 10) x),
  'top_expenses', (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT cont, max(descriere) name, round(sum(exp),2) value FROM b WHERE y = p_year AND cont LIKE '6%' GROUP BY cont ORDER BY 3 DESC LIMIT 10) x),
  'last_period', (SELECT max(periodid) FROM b WHERE rev <> 0 OR exp <> 0)
);
$$;

REVOKE ALL ON FUNCTION public.erp_mirror_catalog() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_mirror_aggregate(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_mirror_pnl(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_catalog() TO service_role;
GRANT EXECUTE ON FUNCTION public.erp_mirror_aggregate(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.erp_mirror_pnl(int) TO service_role;