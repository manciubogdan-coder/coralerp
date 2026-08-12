CREATE TABLE public.productie_order_cuts (
  comanda_id uuid PRIMARY KEY,
  cantitate_taiata numeric NOT NULL DEFAULT 0,
  motiv text,
  produs_nume text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.productie_order_cuts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productie_order_cuts TO authenticated;
GRANT ALL ON public.productie_order_cuts TO service_role;

ALTER TABLE public.productie_order_cuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order cuts readable" ON public.productie_order_cuts FOR SELECT USING (true);
CREATE POLICY "order cuts insertable" ON public.productie_order_cuts FOR INSERT WITH CHECK (true);
CREATE POLICY "order cuts updatable" ON public.productie_order_cuts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "order cuts deletable" ON public.productie_order_cuts FOR DELETE USING (true);

CREATE TRIGGER trg_order_cuts_updated_at BEFORE UPDATE ON public.productie_order_cuts
FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();