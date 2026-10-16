CREATE OR REPLACE FUNCTION public.erp_mirror_reports(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
DECLARE r jsonb;
BEGIN
  IF p_action = 'list' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at), '[]') INTO r FROM erp_mirror._reports t;
  ELSIF p_action = 'save' THEN
    INSERT INTO erp_mirror._reports(title, config, created_by) VALUES (p_data->>'title', p_data->'config', p_data->>'created_by') RETURNING to_jsonb(_reports) INTO r;
  ELSIF p_action = 'delete' THEN
    DELETE FROM erp_mirror._reports WHERE id = (p_data->>'id')::uuid; r := '{"ok":true}';
  ELSE RAISE EXCEPTION 'acțiune invalidă'; END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.erp_mirror_reports(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_reports(text, jsonb) TO service_role;