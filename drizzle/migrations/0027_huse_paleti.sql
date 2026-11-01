CREATE TABLE public.huse_paleti_miscari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  tip text NOT NULL CHECK (tip IN ('intrare','predare','retur','pierdere')),
  cantitate integer NOT NULL CHECK (cantitate > 0),
  zona text NOT NULL DEFAULT 'picking' CHECK (zona IN ('picking','depozit_mp')),
  persoana text,
  destinatie text,
  document text,
  observatii text,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.huse_paleti_miscari TO anon, authenticated;
GRANT ALL ON public.huse_paleti_miscari TO service_role;
ALTER TABLE public.huse_paleti_miscari ENABLE ROW LEVEL SECURITY;
CREATE POLICY "huse read" ON public.huse_paleti_miscari FOR SELECT USING (true);
CREATE POLICY "huse insert" ON public.huse_paleti_miscari FOR INSERT WITH CHECK (true);
CREATE POLICY "huse delete" ON public.huse_paleti_miscari FOR DELETE USING (true);