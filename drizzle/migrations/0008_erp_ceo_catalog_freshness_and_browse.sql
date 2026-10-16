CREATE OR REPLACE FUNCTION public.erp_mirror_catalog()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.table_name,'source',t.source_name,'rows',t.row_count,'synced_at',t.last_synced_at,'error',t.last_error,
'columns',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.column_name,'type',c.data_type) ORDER BY c.ordinal_position),'[]'::jsonb) FROM information_schema.columns c WHERE c.table_schema='erp_mirror' AND c.table_name=t.table_name AND c.column_name NOT IN ('_pk','_run','_synced_at'))) ORDER BY t.source_name),'[]'::jsonb) FROM erp_mirror._tables t;
$$;
REVOKE ALL ON FUNCTION public.erp_mirror_catalog() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_catalog() TO service_role;
CREATE OR REPLACE FUNCTION public.erp_mirror_browse(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
DECLARE tbl text:=p->>'table'; date_col text:=nullif(p->>'date_col',''); search_col text:=nullif(p->>'search_col',''); start_date date; end_date date; conditions text[]:='{}'; statement text; result jsonb; page_offset int:=greatest(coalesce((p->>'offset')::int,0),0);
BEGIN
IF NOT EXISTS(SELECT 1 FROM erp_mirror._tables WHERE table_name=tbl AND last_synced_at IS NOT NULL) THEN RAISE EXCEPTION 'Tabelul nu a fost încă încărcat complet.'; END IF;
IF date_col IS NOT NULL THEN
IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='erp_mirror' AND table_name=tbl AND column_name=date_col AND data_type IN ('date','timestamp without time zone','timestamp with time zone')) THEN RAISE EXCEPTION 'Coloană de dată invalidă'; END IF;
start_date:=(p->>'start')::date; end_date:=(p->>'end')::date;
IF start_date IS NULL OR end_date IS NULL OR start_date>end_date THEN RAISE EXCEPTION 'Perioadă invalidă'; END IF;
conditions:=array_append(conditions,format('%I >= %L::date AND %I < (%L::date + interval ''1 day'')',date_col,start_date,date_col,end_date));
END IF;
IF search_col IS NOT NULL AND coalesce(p->>'search','')<>'' THEN
IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='erp_mirror' AND table_name=tbl AND column_name=search_col AND column_name NOT IN ('_pk','_run','_synced_at')) THEN RAISE EXCEPTION 'Coloană de căutare invalidă'; END IF;
conditions:=array_append(conditions,format('%I::text ILIKE %L',search_col,'%' || left(p->>'search',200) || '%'));
END IF;
statement:=format('SELECT coalesce(jsonb_agg(to_jsonb(r) - ''_pk'' - ''_run'' - ''_synced_at''),''[]''::jsonb) FROM (SELECT * FROM erp_mirror.%I %s ORDER BY %s LIMIT 51 OFFSET %s) r',tbl,CASE WHEN cardinality(conditions)>0 THEN 'WHERE ' || array_to_string(conditions,' AND ') ELSE '' END,CASE WHEN date_col IS NOT NULL THEN format('%I DESC NULLS LAST, _pk',date_col) ELSE '_pk' END,page_offset);
PERFORM set_config('statement_timeout','15s',true);
EXECUTE statement INTO result;
RETURN jsonb_build_object('rows',result,'offset',page_offset);
END;
$$;
REVOKE ALL ON FUNCTION public.erp_mirror_browse(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_browse(jsonb) TO service_role;