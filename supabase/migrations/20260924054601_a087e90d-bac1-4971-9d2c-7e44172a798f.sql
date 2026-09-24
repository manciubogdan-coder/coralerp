CREATE TABLE public.productie_comenzi_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  action text NOT NULL,
  record_ids text[] NOT NULL DEFAULT '{}',
  comanda_ids text[] NOT NULL DEFAULT '{}',
  changes jsonb,
  filter text,
  user_email text,
  user_name text,
  page_path text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.productie_comenzi_audit TO anon, authenticated;
GRANT ALL ON public.productie_comenzi_audit TO service_role;
ALTER TABLE public.productie_comenzi_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read audit" ON public.productie_comenzi_audit FOR SELECT USING (true);
CREATE POLICY "Anyone can insert audit" ON public.productie_comenzi_audit FOR INSERT WITH CHECK (true);
CREATE INDEX idx_pca_comanda ON public.productie_comenzi_audit USING gin (comanda_ids);
CREATE INDEX idx_pca_record ON public.productie_comenzi_audit USING gin (record_ids);
CREATE INDEX idx_pca_created ON public.productie_comenzi_audit (created_at DESC);