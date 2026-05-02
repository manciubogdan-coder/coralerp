CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.fire_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://yeniohmlmxhjzywqlidx.supabase.co/functions/v1/send-push';
  v_subs jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'endpoint', ps.endpoint,
        'p256dh_key', ps.p256dh_key,
        'auth_key', ps.auth_key
      )
    ),
    '[]'::jsonb
  )
  INTO v_subs
  FROM public.push_subscriptions ps
  WHERE ps.user_id = NEW.user_id;

  IF jsonb_array_length(v_subs) = 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM extensions.http_post(
      url := v_url,
      body := jsonb_build_object(
        'title', NEW.title,
        'body', COALESCE(NEW.body, ''),
        'link', COALESCE(NEW.link, '/'),
        'notification_id', NEW.id,
        'subscriptions', v_subs
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_fire_push ON public.notifications;
CREATE TRIGGER notifications_fire_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_push_for_notification();