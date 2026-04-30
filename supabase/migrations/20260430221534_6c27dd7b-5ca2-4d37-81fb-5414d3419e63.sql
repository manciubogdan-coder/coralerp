-- Allow notification rules to target either one user, one department, or nobody (global rule)
ALTER TABLE public.notif_rules
  DROP CONSTRAINT IF EXISTS notif_rules_check;

ALTER TABLE public.notif_rules
  ADD CONSTRAINT notif_rules_check
  CHECK (num_nonnulls(target_user_id, target_department) <= 1);

-- Rebuild recipient resolution so global rules notify all app users with roles
CREATE OR REPLACE FUNCTION public.emit_notification_event(
  p_event_key text,
  p_title_default text,
  p_body text DEFAULT NULL::text,
  p_link text DEFAULT NULL::text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_users uuid[];
  uid uuid;
  cnt int := 0;
BEGIN
  FOR r IN
    SELECT *
    FROM public.notif_rules
    WHERE event_key = p_event_key
      AND enabled = true
  LOOP
    v_users := ARRAY[]::uuid[];

    IF r.target_user_id IS NOT NULL THEN
      v_users := ARRAY[r.target_user_id];
    ELSIF r.target_department IS NOT NULL THEN
      SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
      INTO v_users
      FROM public.app_user_roles
      WHERE lower(trim(role::text)) = lower(trim(r.target_department));
    ELSE
      SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
      INTO v_users
      FROM public.app_user_roles;
    END IF;

    IF COALESCE(array_length(v_users, 1), 0) = 0 THEN
      CONTINUE;
    END IF;

    FOREACH uid IN ARRAY v_users LOOP
      INSERT INTO public.notifications (user_id, event_key, title, body, link, payload)
      VALUES (
        uid,
        p_event_key,
        COALESCE(NULLIF(r.title_template, ''), p_title_default),
        COALESCE(r.body_template, p_body),
        p_link,
        COALESCE(p_payload, '{}'::jsonb)
      );
      cnt := cnt + 1;
    END LOOP;
  END LOOP;

  RETURN cnt;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.emit_notification_event(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emit_notification_event(text, text, text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.emit_notification_event(text, text, text, text, jsonb) TO service_role;