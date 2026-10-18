CREATE OR REPLACE FUNCTION public.erp_live_pull(p_limit int DEFAULT 3) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp_mirror' AS $$
DECLARE r jsonb;
BEGIN
  INSERT INTO erp_mirror._live_state(key, value, updated_at) VALUES ('agent', '{}'::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET updated_at = now();
  DELETE FROM erp_mirror._live_requests WHERE created_at < now() - interval '1 hour';
  UPDATE erp_mirror._live_requests SET status = 'error', error = 'expirat', finished_at = now()
    WHERE status IN ('pending','running') AND created_at < now() - interval '2 minutes';
  WITH picked AS (
    SELECT id FROM erp_mirror._live_requests WHERE status = 'pending'
    ORDER BY created_at LIMIT least(greatest(coalesce(p_limit,3),1),10) FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE erp_mirror._live_requests q SET status = 'running', picked_at = now()
    FROM picked WHERE q.id = picked.id RETURNING q.id, q.kind, q.payload
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'payload', payload)), '[]'::jsonb) INTO r FROM upd;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.erp_live_pull(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_live_pull(int) TO service_role;
CREATE OR REPLACE FUNCTION public.erp_mirror_status_live() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'erp_mirror' AS
$$ SELECT public.erp_mirror_status() || jsonb_build_object('live_seen_at', (SELECT updated_at FROM erp_mirror._live_state WHERE key = 'agent'), 'essential', to_jsonb(public.erp_mirror_essential_tables())) $$;
REVOKE ALL ON FUNCTION public.erp_mirror_status_live() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_mirror_status_live() TO service_role;