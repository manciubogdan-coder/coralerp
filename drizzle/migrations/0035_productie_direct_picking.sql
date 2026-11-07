CREATE TABLE public.productie_direct_picking (
  produs_id text PRIMARY KEY,
  produs_nume text NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.productie_direct_picking TO anon, authenticated;
GRANT ALL ON public.productie_direct_picking TO service_role;
ALTER TABLE public.productie_direct_picking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read direct picking products" ON public.productie_direct_picking FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.productie_direct_picking (produs_id, produs_nume, updated_by)
VALUES ('136ec27a-fe67-4777-aa5e-eb32d6e3be60', 'BIO BABY SPANAC 100 GR', 'setare inițială');