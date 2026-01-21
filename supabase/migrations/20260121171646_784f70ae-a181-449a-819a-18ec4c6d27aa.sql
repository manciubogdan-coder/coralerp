
-- Tabel stoc producție materii prime
CREATE TABLE public.production_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID REFERENCES public.inventory(id),
  transfer_id UUID REFERENCES public.stock_transfers(id),
  product_id UUID REFERENCES public.products(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  manufacturer_id UUID REFERENCES public.manufacturers(id),
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  lot_number TEXT,
  document_number TEXT,
  transfer_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabel stoc producție ambalaje
CREATE TABLE public.ambalaje_production_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID REFERENCES public.ambalaje_inventory(id),
  transfer_id UUID REFERENCES public.ambalaje_stock_transfers(id),
  product_id UUID REFERENCES public.ambalaje_products(id),
  supplier_id UUID REFERENCES public.ambalaje_suppliers(id),
  manufacturer_id UUID REFERENCES public.ambalaje_manufacturers(id),
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  lot_number TEXT,
  document_number TEXT,
  transfer_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Istoric operații stoc producție materii prime
CREATE TABLE public.production_stock_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_stock_id UUID REFERENCES public.production_stock(id),
  action TEXT NOT NULL, -- 'consumption', 'return', 'modify', 'delete'
  quantity NUMERIC NOT NULL,
  previous_quantity NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Istoric operații stoc producție ambalaje
CREATE TABLE public.ambalaje_production_stock_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_stock_id UUID REFERENCES public.ambalaje_production_stock(id),
  action TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  previous_quantity NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_production_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_production_stock_history ENABLE ROW LEVEL SECURITY;

-- Policies pentru acces
CREATE POLICY "Allow all access to production_stock" ON public.production_stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to ambalaje_production_stock" ON public.ambalaje_production_stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to production_stock_history" ON public.production_stock_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to ambalaje_production_stock_history" ON public.ambalaje_production_stock_history FOR ALL USING (true) WITH CHECK (true);

-- Trigger pentru updated_at
CREATE TRIGGER update_production_stock_updated_at
  BEFORE UPDATE ON public.production_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ambalaje_production_stock_updated_at
  BEFORE UPDATE ON public.ambalaje_production_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
