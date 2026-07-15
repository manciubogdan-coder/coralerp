
CREATE TABLE public.evidenta_andrada_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_type TEXT NOT NULL DEFAULT 'materii-prime',
  data DATE NOT NULL,
  lot TEXT,
  produs TEXT,
  cantitate_intrata NUMERIC,
  furnizor TEXT,
  kg_solicitat NUMERIC,
  procent_cn_solicitata NUMERIC,
  cantitate_ramasa NUMERIC,
  data_productie DATE,
  schimb TEXT,
  mp_intrata_in_prod NUMERIC,
  mp_utilizata_vanduta NUMERIC,
  pierdere_totala NUMERIC,
  rebut NUMERIC,
  retur_repozit NUMERIC,
  procent_nc NUMERIC,
  pierdere_tehnologica NUMERIC,
  procent_cantar NUMERIC,
  bucati_15g NUMERIC,
  bucati_30g NUMERIC,
  bucati_70g NUMERIC,
  bucati_100g NUMERIC,
  bucati_250g NUMERIC,
  bucati_500g NUMERIC,
  kg_final NUMERIC,
  nr_pers INTEGER,
  ora_start TEXT,
  ora_stop TEXT,
  pauza_min INTEGER,
  observatii TEXT,
  retur TEXT,
  producator TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidenta_andrada_data ON public.evidenta_andrada_rows(data DESC);
CREATE INDEX idx_evidenta_andrada_type ON public.evidenta_andrada_rows(inventory_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidenta_andrada_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidenta_andrada_rows TO anon;
GRANT ALL ON public.evidenta_andrada_rows TO service_role;

ALTER TABLE public.evidenta_andrada_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view evidenta rows" ON public.evidenta_andrada_rows FOR SELECT USING (true);
CREATE POLICY "Anyone can insert evidenta rows" ON public.evidenta_andrada_rows FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update evidenta rows" ON public.evidenta_andrada_rows FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete evidenta rows" ON public.evidenta_andrada_rows FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at_evidenta()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_evidenta_updated
BEFORE UPDATE ON public.evidenta_andrada_rows
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_evidenta();
