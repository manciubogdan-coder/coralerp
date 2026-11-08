CREATE TABLE public.productie_retetar_inlocuiri (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_increase_pct numeric NOT NULL DEFAULT 50 CHECK (max_increase_pct >= 0 AND max_increase_pct <= 300),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.productie_retetar_inlocuiri TO anon, authenticated;
GRANT ALL ON public.productie_retetar_inlocuiri TO service_role;
ALTER TABLE public.productie_retetar_inlocuiri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read recipe substitutions" ON public.productie_retetar_inlocuiri FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.productie_retetar_inlocuiri (id, rules, max_increase_pct, updated_by) VALUES (true,
  '[{"from":"Iceberg","to":["Pan di Zuchero"],"always":true},{"from":"Scarola","to":["Pan di Zuchero"],"always":false},{"from":"Mizuna Green","to":["Mizuna Red"],"always":false},{"from":"Morcovi","to":[],"always":false}]'::jsonb,
  50, 'setare inițială');