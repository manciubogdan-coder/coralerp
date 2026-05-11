
-- Imported / manual purchase orders (per inventory type)
CREATE TABLE IF NOT EXISTS public.purchase_orders_imported (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_type text NOT NULL CHECK (inventory_type IN ('materii-prime','ambalaje','etichete')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','excel')),
  tip_document text,
  serie text,
  numar text,
  data date NOT NULL,
  partener text NOT NULL,
  supplier_id uuid,
  total_value numeric NOT NULL DEFAULT 0,
  total_lines integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poi_inventory_type ON public.purchase_orders_imported(inventory_type);
CREATE INDEX IF NOT EXISTS idx_poi_partener ON public.purchase_orders_imported(partener);
CREATE INDEX IF NOT EXISTS idx_poi_data ON public.purchase_orders_imported(data);

CREATE TABLE IF NOT EXISTS public.purchase_orders_imported_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders_imported(id) ON DELETE CASCADE,
  denumire_articol text NOT NULL,
  descriere_articol text,
  cantitate numeric NOT NULL DEFAULT 0,
  pret_final numeric NOT NULL DEFAULT 0,
  palet numeric NOT NULL DEFAULT 0,
  valoare_neta numeric NOT NULL DEFAULT 0,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poii_order ON public.purchase_orders_imported_items(order_id);

ALTER TABLE public.purchase_orders_imported ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders_imported_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poi_all_auth" ON public.purchase_orders_imported
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "poii_all_auth" ON public.purchase_orders_imported_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.poi_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_poi_updated_at
  BEFORE UPDATE ON public.purchase_orders_imported
  FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();
