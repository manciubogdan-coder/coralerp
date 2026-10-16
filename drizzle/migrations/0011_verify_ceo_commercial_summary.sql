DO $$
DECLARE r jsonb; expected bigint; expected_value numeric;
BEGIN
r := public.erp_mirror_commercial_summary('2026-06-01','2026-06-30');
IF r->>'available' <> 'true' THEN RAISE EXCEPTION 'Commercial sources unavailable'; END IF;
SELECT count(*),sum(h.valoare_rol) INTO expected,expected_value FROM erp_mirror.c_h_note_contabile h JOIN erp_mirror.c_tipuri_document t ON t.tip_document_id=h.tip_document_id WHERE t.cod='CC' AND h.anulat IS FALSE AND h.data>='2026-06-01' AND h.data<'2026-07-01';
IF (r#>>'{metrics,sales_orders,documents}')::bigint IS DISTINCT FROM expected OR (r#>>'{metrics,sales_orders,value}')::numeric IS DISTINCT FROM expected_value THEN RAISE EXCEPTION 'Sales order total mismatch'; END IF;
IF (r#>>'{metrics,sales_invoices,partners}')::bigint > (r#>>'{metrics,sales_invoices,documents}')::bigint THEN RAISE EXCEPTION 'Duplicate partner join'; END IF;
IF NOT (r->>'partial')::boolean THEN RAISE EXCEPTION 'Incomplete mirror not marked partial'; END IF;
r := public.erp_mirror_commercial_summary('2099-01-01','2099-01-31');
IF r->'metrics' <> '{}'::jsonb THEN RAISE EXCEPTION 'Empty period regression'; END IF;
BEGIN
PERFORM public.erp_mirror_commercial_summary('2026-07-01','2026-06-01');
RAISE EXCEPTION 'Invalid interval accepted';
EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Perioadă invalidă' THEN RAISE; END IF;
END;
IF has_function_privilege('anon','public.erp_mirror_commercial_summary(date,date)','EXECUTE') OR has_function_privilege('authenticated','public.erp_mirror_commercial_summary(date,date)','EXECUTE') THEN RAISE EXCEPTION 'Summary function exposed'; END IF;
END;
$$;