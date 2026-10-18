CREATE TABLE public.productie_avans_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  auto_enabled boolean NOT NULL DEFAULT false,
  run_time text NOT NULL DEFAULT '16:50',
  updated_by_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.productie_avans_settings TO anon;
GRANT SELECT, UPDATE ON public.productie_avans_settings TO authenticated;
GRANT ALL ON public.productie_avans_settings TO service_role;
ALTER TABLE public.productie_avans_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable by everyone" ON public.productie_avans_settings FOR SELECT USING (true);
CREATE POLICY "settings writable by authenticated" ON public.productie_avans_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.productie_avans_settings (id, auto_enabled) VALUES (true, false);

CREATE TABLE public.productie_avans_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday integer NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  produs_id text,
  produs_nume text NOT NULL,
  cantitate numeric NOT NULL CHECK (cantitate > 0),
  linie_id text,
  linie_nume text,
  baxare text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.productie_avans_matrix TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productie_avans_matrix TO authenticated;
GRANT ALL ON public.productie_avans_matrix TO service_role;
ALTER TABLE public.productie_avans_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matrix readable by everyone" ON public.productie_avans_matrix FOR SELECT USING (true);
CREATE POLICY "matrix writable" ON public.productie_avans_matrix FOR INSERT WITH CHECK (true);
CREATE POLICY "matrix updatable" ON public.productie_avans_matrix FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "matrix deletable" ON public.productie_avans_matrix FOR DELETE USING (true);

CREATE TABLE public.productie_avans_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL,
  source text NOT NULL CHECK (source IN ('manual','auto')),
  orders_created integer NOT NULL DEFAULT 0,
  created_by_email text,
  details jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.productie_avans_log TO anon;
GRANT SELECT, INSERT ON public.productie_avans_log TO authenticated;
GRANT ALL ON public.productie_avans_log TO service_role;
ALTER TABLE public.productie_avans_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log readable by everyone" ON public.productie_avans_log FOR SELECT USING (true);
CREATE POLICY "log insertable" ON public.productie_avans_log FOR INSERT WITH CHECK (true);