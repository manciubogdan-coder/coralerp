CREATE TABLE public.productie_restock_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  auto_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.productie_restock_settings TO anon, authenticated;
GRANT ALL ON public.productie_restock_settings TO service_role;
ALTER TABLE public.productie_restock_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read production restock mode" ON public.productie_restock_settings FOR SELECT TO anon, authenticated USING (true);
COMMENT ON TABLE public.productie_restock_settings IS 'Global default-off operator restock offers; writes only through operational-admin validated Argus.';