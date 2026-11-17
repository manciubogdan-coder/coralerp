CREATE TABLE public.achizitii_radar_setari (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.achizitii_radar_setari TO service_role;
ALTER TABLE public.achizitii_radar_setari ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.achizitii_comenzi_istoric (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_type text NOT NULL,
  order_id text NOT NULL,
  product_id text,
  delivery_date date,
  quantity numeric NOT NULL,
  status text,
  seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX achizitii_comenzi_istoric_order ON public.achizitii_comenzi_istoric (inventory_type, order_id, seen_at);
GRANT ALL ON public.achizitii_comenzi_istoric TO service_role;
ALTER TABLE public.achizitii_comenzi_istoric ENABLE ROW LEVEL SECURITY;