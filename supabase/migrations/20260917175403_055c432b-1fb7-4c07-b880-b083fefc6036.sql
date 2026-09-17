CREATE TABLE public.productie_sesiuni_rebut (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesiune_id uuid NOT NULL,
  comanda_id uuid,
  linie_id uuid,
  linie_nume text,
  cantitate numeric NOT NULL DEFAULT 0,
  motiv text,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.productie_sesiuni_rebut TO authenticated;
GRANT SELECT, INSERT ON public.productie_sesiuni_rebut TO anon;
GRANT ALL ON public.productie_sesiuni_rebut TO service_role;

ALTER TABLE public.productie_sesiuni_rebut ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rebut" ON public.productie_sesiuni_rebut FOR SELECT USING (true);
CREATE POLICY "Anyone can insert rebut" ON public.productie_sesiuni_rebut FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update rebut" ON public.productie_sesiuni_rebut FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_productie_sesiuni_rebut_sesiune ON public.productie_sesiuni_rebut (sesiune_id);
CREATE INDEX idx_productie_sesiuni_rebut_created ON public.productie_sesiuni_rebut (created_at);

CREATE TRIGGER trg_productie_sesiuni_rebut_updated
BEFORE UPDATE ON public.productie_sesiuni_rebut
FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();