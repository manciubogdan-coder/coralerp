CREATE TABLE public.ambalaje_tuburi_miscari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produs_nume text NOT NULL,
  product_id text,
  tip text NOT NULL CHECK (tip IN ('receptie','transfer','retur')),
  role integer NOT NULL DEFAULT 0,
  tuburi integer NOT NULL DEFAULT 0,
  lot text,
  document text,
  furnizor text,
  observatii text,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ambalaje_tuburi_miscari TO anon, authenticated;
GRANT ALL ON public.ambalaje_tuburi_miscari TO service_role;
ALTER TABLE public.ambalaje_tuburi_miscari ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tuburi read" ON public.ambalaje_tuburi_miscari FOR SELECT USING (true);
CREATE POLICY "tuburi insert" ON public.ambalaje_tuburi_miscari FOR INSERT WITH CHECK (true);
CREATE POLICY "tuburi delete" ON public.ambalaje_tuburi_miscari FOR DELETE USING (true);
CREATE INDEX ON public.ambalaje_tuburi_miscari (lower(produs_nume));