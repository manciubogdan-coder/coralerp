-- 1. Tabel push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  device_label text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_sub_select ON public.push_subscriptions;
CREATE POLICY push_sub_select ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_sub_insert ON public.push_subscriptions;
CREATE POLICY push_sub_insert ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_sub_update ON public.push_subscriptions;
CREATE POLICY push_sub_update ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_sub_delete ON public.push_subscriptions;
CREATE POLICY push_sub_delete ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2. RPC: register subscription (upsert by endpoint)
CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_label text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh_key, auth_key, device_label, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_device_label, p_user_agent)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = auth.uid(),
        p256dh_key = EXCLUDED.p256dh_key,
        auth_key = EXCLUDED.auth_key,
        device_label = COALESCE(EXCLUDED.device_label, public.push_subscriptions.device_label),
        user_agent = COALESCE(EXCLUDED.user_agent, public.push_subscriptions.user_agent),
        last_used_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3. RPC: delete subscription
CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.push_subscriptions
  WHERE endpoint = p_endpoint AND user_id = auth.uid();
END;
$$;

-- 4. Enable pg_net for async http calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 5. Trigger function: when a notification is inserted, fire push
CREATE OR REPLACE FUNCTION public.fire_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_url text := 'https://yeniohmlmxhjzywqlidx.supabase.co/functions/v1/send-push';
BEGIN
  -- fire and forget; don't block the insert if pg_net or function fails
  BEGIN
    PERFORM extensions.http_post(
      url := v_url,
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', NEW.body,
        'link', NEW.link,
        'notification_id', NEW.id
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- swallow errors, push delivery is best-effort
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