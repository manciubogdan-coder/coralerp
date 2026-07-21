CREATE TABLE public.productie_grupare_ambalare (
  produs_id text NOT NULL PRIMARY KEY,
  grup_nume text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productie_grupare_ambalare TO authenticated;
GRANT ALL ON public.productie_grupare_ambalare TO service_role;
ALTER TABLE public.productie_grupare_ambalare ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read grupare" ON public.productie_grupare_ambalare FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write grupare" ON public.productie_grupare_ambalare FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_grupare_grup_nume ON public.productie_grupare_ambalare(grup_nume);