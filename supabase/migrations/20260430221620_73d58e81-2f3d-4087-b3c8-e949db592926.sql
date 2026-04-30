REVOKE EXECUTE ON FUNCTION public.emit_notification_event(text, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.emit_notification_event(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emit_notification_event(text, text, text, text, jsonb) TO service_role;