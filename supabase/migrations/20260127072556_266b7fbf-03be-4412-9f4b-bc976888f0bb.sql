-- Create product order settings tables for each inventory type

-- Materii Prime
CREATE TABLE public.product_order_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  min_order_quantity NUMERIC(14,2) NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- Ambalaje
CREATE TABLE public.ambalaje_product_order_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.ambalaje_products(id) ON DELETE CASCADE,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  min_order_quantity NUMERIC(14,2) NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- Etichete
CREATE TABLE public.etichete_product_order_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.etichete_products(id) ON DELETE CASCADE,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  min_order_quantity NUMERIC(14,2) NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- Enable RLS
ALTER TABLE public.product_order_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_product_order_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_product_order_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users to manage settings
CREATE POLICY "Allow authenticated users full access to product_order_settings"
ON public.product_order_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to ambalaje_product_order_settings"
ON public.ambalaje_product_order_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to etichete_product_order_settings"
ON public.etichete_product_order_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_product_order_settings_updated_at
  BEFORE UPDATE ON public.product_order_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ambalaje_product_order_settings_updated_at
  BEFORE UPDATE ON public.ambalaje_product_order_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_etichete_product_order_settings_updated_at
  BEFORE UPDATE ON public.etichete_product_order_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();