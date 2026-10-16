CREATE OR REPLACE FUNCTION public.erp_mirror_pnl(p_year int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
WITH b AS (
  SELECT a.periodid, p.cont, p.descriere, left(a.periodid,4)::int y,
    CASE WHEN p.cont LIKE '7%' THEN a.creditturnover - a.debitturnover ELSE 0 END rev,
    CASE WHEN p.cont LIKE '6%' THEN a.debitturnover - a.creditturnover ELSE 0 END exp
  FROM erp_mirror.accountingstatistics a JOIN erp_mirror.c_plan_contabil p ON p.analitic_id = a.analiticid
  WHERE a.tipsubiectid = 1 AND (p.cont LIKE '6%' OR p.cont LIKE '7%')
    AND left(a.periodid,4)::int IN (p_year, p_year - 1) AND length(a.periodid) = 6
)
SELECT jsonb_build_object(
  'months', (SELECT coalesce(jsonb_agg(x ORDER BY x.period), '[]') FROM (SELECT periodid period, y, round(sum(rev),2) revenue, round(sum(exp),2) expenses FROM b GROUP BY periodid, y) x),
  'accounts', (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT periodid period, cont, max(descriere) name, round(sum(rev),2) rev, round(sum(exp),2) exp FROM b GROUP BY periodid, cont HAVING sum(rev) <> 0 OR sum(exp) <> 0) x),
  'top_revenue', (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT cont, max(descriere) name, round(sum(rev),2) value FROM b WHERE y = p_year AND cont LIKE '7%' GROUP BY cont ORDER BY 3 DESC LIMIT 10) x),
  'top_expenses', (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT cont, max(descriere) name, round(sum(exp),2) value FROM b WHERE y = p_year AND cont LIKE '6%' GROUP BY cont ORDER BY 3 DESC LIMIT 10) x),
  'last_period', (SELECT max(periodid) FROM b WHERE rev <> 0 OR exp <> 0)
);
$$;
REVOKE ALL ON FUNCTION public.erp_mirror_pnl(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_pnl(int) TO service_role;