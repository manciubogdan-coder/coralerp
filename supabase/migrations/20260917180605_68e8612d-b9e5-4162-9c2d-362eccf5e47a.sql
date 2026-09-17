CREATE TABLE public.productie_linii_grupe (
  linie_id uuid PRIMARY KEY,
  grup_nume text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.productie_linii_grupe TO authenticated;
GRANT SELECT ON public.productie_linii_grupe TO anon;
GRANT ALL ON public.productie_linii_grupe TO service_role;

ALTER TABLE public.productie_linii_grupe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read line groups" ON public.productie_linii_grupe FOR SELECT USING (true);
CREATE POLICY "Anyone can insert line groups" ON public.productie_linii_grupe FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update line groups" ON public.productie_linii_grupe FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete line groups" ON public.productie_linii_grupe FOR DELETE USING (true);

CREATE TRIGGER trg_linii_grupe_updated_at
BEFORE UPDATE ON public.productie_linii_grupe
FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();