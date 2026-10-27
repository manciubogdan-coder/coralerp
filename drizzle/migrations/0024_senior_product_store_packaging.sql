CREATE TABLE public.productie_baxare_magazine (
 produs_id uuid NOT NULL,
 magazin_key text NOT NULL,
 magazin text NOT NULL,
 senior_units text,
 manual_units text,
 senior_code text,
 senior_date date,
 synced_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (produs_id, magazin_key),
 CHECK (manual_units IS NULL OR manual_units ~ '^[1-9][0-9]*(\+[1-9][0-9]*)*$')
);
GRANT SELECT ON public.productie_baxare_magazine TO anon, authenticated;
GRANT ALL ON public.productie_baxare_magazine TO service_role;
ALTER TABLE public.productie_baxare_magazine ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Packaging readable like shared production catalog" ON public.productie_baxare_magazine FOR SELECT TO anon, authenticated USING (true);
COMMENT ON TABLE public.productie_baxare_magazine IS 'Exact operational product/store packaging from verified live Senior document-line CT_CantitateBAX, with admin-validated local overrides; no browser writes.';