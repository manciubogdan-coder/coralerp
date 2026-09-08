CREATE TABLE public.app_activity_pings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text,
  display_name text,
  path text NOT NULL,
  tab text,
  seconds integer NOT NULL DEFAULT 60,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_activity_pings_occurred_at ON public.app_activity_pings (occurred_at DESC);
CREATE INDEX idx_app_activity_pings_user ON public.app_activity_pings (user_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.app_activity_pings TO anon;
GRANT SELECT, INSERT ON public.app_activity_pings TO authenticated;
GRANT ALL ON public.app_activity_pings TO service_role;

ALTER TABLE public.app_activity_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert activity pings"
  ON public.app_activity_pings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read activity pings"
  ON public.app_activity_pings FOR SELECT
  USING (true);
