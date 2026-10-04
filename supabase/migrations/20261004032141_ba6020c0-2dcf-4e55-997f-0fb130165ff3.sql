CREATE TABLE public.prereceptii (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_type text NOT NULL DEFAULT 'materii-prime',
  document_number text NOT NULL,
  expected_date date,
  supplier_id text,
  supplier_name text,
  status text NOT NULL DEFAULT 'asteptare',
  notes text,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prereceptii TO anon, authenticated;
GRANT ALL ON public.prereceptii TO service_role;
ALTER TABLE public.prereceptii ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prereceptii all" ON public.prereceptii FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prereceptii_updated BEFORE UPDATE ON public.prereceptii FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();

CREATE TABLE public.prereceptie_linii (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prereceptie_id uuid NOT NULL REFERENCES public.prereceptii(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  product_id text,
  product_name text NOT NULL,
  manufacturer_id text,
  manufacturer_name text,
  cantitate_document numeric NOT NULL DEFAULT 0,
  unit text,
  pallets jsonb NOT NULL DEFAULT '[]'::jsonb,
  crates jsonb NOT NULL DEFAULT '[]'::jsonb,
  received_quantity numeric,
  received_inventory_id text,
  received_at timestamptz,
  received_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prereceptie_linii TO anon, authenticated;
GRANT ALL ON public.prereceptie_linii TO service_role;
ALTER TABLE public.prereceptie_linii ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prereceptie_linii all" ON public.prereceptie_linii FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prereceptie_linii_updated BEFORE UPDATE ON public.prereceptie_linii FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();
CREATE INDEX ON public.prereceptie_linii(prereceptie_id);