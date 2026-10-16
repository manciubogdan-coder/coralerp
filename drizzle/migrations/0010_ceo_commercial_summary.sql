CREATE OR REPLACE FUNCTION public.erp_mirror_commercial_summary(p_start date, p_end date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
DECLARE result jsonb; sources jsonb;
BEGIN
IF p_start IS NULL OR p_end IS NULL OR p_start > p_end OR extract(year FROM p_end)-extract(year FROM p_start)>2 THEN RAISE EXCEPTION 'Perioadă invalidă'; END IF;
IF to_regclass('erp_mirror.c_h_note_contabile') IS NULL OR to_regclass('erp_mirror.c_tipuri_document') IS NULL OR to_regclass('erp_mirror.c_h_note_contabile_parteneri') IS NULL THEN
RETURN jsonb_build_object('available',false,'reason','Documentele și partenerii necesari nu au ajuns încă în copie.'); END IF;
SELECT jsonb_agg(jsonb_build_object('table',table_name,'synced_at',last_synced_at,'error',last_error,'complete',last_synced_at IS NOT NULL AND last_error IS NULL) ORDER BY table_name) INTO sources FROM erp_mirror._tables WHERE table_name IN ('c_h_note_contabile','c_tipuri_document','c_h_note_contabile_parteneri');
WITH docs AS MATERIALIZED (
SELECT h.h_id,h.data,h.valoare_rol,t.cod,
CASE t.cod WHEN 'CC' THEN 'sales_orders' WHEN 'CF' THEN 'purchase_orders' WHEN 'FC' THEN 'sales_invoices' ELSE 'purchase_invoices' END AS kind
FROM erp_mirror.c_h_note_contabile h JOIN erp_mirror.c_tipuri_document t ON t.tip_document_id=h.tip_document_id
WHERE h.data>=p_start AND h.data<p_end+interval '1 day' AND h.anulat IS FALSE AND t.cod IN ('CC','CF','FC','FF','FFI')
), partners AS MATERIALIZED (
SELECT p.h_id,min(p.partener_id) AS partner_id,min(p.partener_denumire) AS name,count(DISTINCT p.partener_id) AS partner_count
FROM erp_mirror.c_h_note_contabile_parteneri p JOIN docs d ON d.h_id=p.h_id GROUP BY p.h_id
), enriched AS MATERIALIZED (
SELECT d.*,CASE WHEN p.partner_count=1 THEN p.partner_id END AS partner_id,CASE WHEN p.partner_count=1 THEN p.name END AS name FROM docs d LEFT JOIN partners p ON p.h_id=d.h_id
), metrics AS (
SELECT kind,count(*) AS documents,sum(valoare_rol) AS value,count(valoare_rol) AS valued_documents,count(DISTINCT partner_id) AS partners,count(*) FILTER(WHERE partner_id IS NULL) AS unidentified_partners,min(data) AS first_date,max(data) AS last_date FROM enriched GROUP BY kind
), monthly AS (
SELECT to_char(data,'YYYY-MM') AS month,kind,count(*) AS documents,sum(valoare_rol) AS value FROM docs GROUP BY 1,2
), ranking AS (
SELECT kind,partner_id,name,count(*) AS documents,sum(valoare_rol) AS value,row_number() OVER(PARTITION BY kind ORDER BY sum(valoare_rol) DESC NULLS LAST) AS rank FROM enriched WHERE partner_id IS NOT NULL AND kind IN ('sales_invoices','purchase_invoices') GROUP BY kind,partner_id,name
)
SELECT jsonb_build_object('available',true,'metrics',coalesce((SELECT jsonb_object_agg(kind,to_jsonb(m)-'kind') FROM metrics m),'{}'::jsonb),'monthly',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY month,kind) FROM monthly m),'[]'::jsonb),'rankings',coalesce((SELECT jsonb_agg(to_jsonb(r)-'rank' ORDER BY kind,rank) FROM ranking r WHERE rank<=10),'[]'::jsonb)) INTO result;
RETURN result || jsonb_build_object('sources',sources,'partial',coalesce((SELECT bool_or(last_synced_at IS NULL OR last_error IS NOT NULL) FROM erp_mirror._tables WHERE table_name IN ('c_h_note_contabile','c_tipuri_document','c_h_note_contabile_parteneri')),true),'start',p_start,'end',p_end);
END;
$$;
REVOKE ALL ON FUNCTION public.erp_mirror_commercial_summary(date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_commercial_summary(date,date) TO service_role;
ALTER FUNCTION public.erp_mirror_commercial_summary(date,date) SET statement_timeout='20s';