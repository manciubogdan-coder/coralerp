-- Create ambalaje_products table
CREATE TABLE public.ambalaje_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  default_unit TEXT NOT NULL,
  cod_produs TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ambalaje_suppliers table
CREATE TABLE public.ambalaje_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ambalaje_manufacturers table
CREATE TABLE public.ambalaje_manufacturers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ambalaje_crate_types table
CREATE TABLE public.ambalaje_crate_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ambalaje_inventory table
CREATE TABLE public.ambalaje_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  supplier VARCHAR,
  supplier_id UUID REFERENCES public.ambalaje_suppliers(id),
  product_id UUID REFERENCES public.ambalaje_products(id),
  manufacturer_id UUID REFERENCES public.ambalaje_manufacturers(id),
  receipt_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  document_number TEXT,
  entry_number INTEGER NOT NULL DEFAULT nextval('inventory_entry_number_seq'),
  crate_type_id UUID REFERENCES public.ambalaje_crate_types(id),
  crate_count INTEGER DEFAULT 0,
  crate_weight NUMERIC DEFAULT 0,
  gross_quantity NUMERIC,
  net_quantity NUMERIC,
  lot_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ambalaje_inventory_history table
CREATE TABLE public.ambalaje_inventory_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID REFERENCES public.ambalaje_inventory(id),
  action VARCHAR NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  previous_quantity NUMERIC,
  supplier VARCHAR,
  supplier_id UUID REFERENCES public.ambalaje_suppliers(id),
  product_id UUID REFERENCES public.ambalaje_products(id),
  manufacturer_id UUID REFERENCES public.ambalaje_manufacturers(id),
  document_number TEXT,
  crate_type_id UUID REFERENCES public.ambalaje_crate_types(id),
  crate_count INTEGER DEFAULT 0,
  crate_weight NUMERIC DEFAULT 0,
  operation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  exit_timestamp TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  lot_number TEXT,
  net_quantity NUMERIC,
  pallets INTEGER
);

-- Create ambalaje_daily_stock_snapshots table
CREATE TABLE public.ambalaje_daily_stock_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  supplier_id UUID REFERENCES public.ambalaje_suppliers(id),
  product_id UUID REFERENCES public.ambalaje_products(id),
  manufacturer_id UUID REFERENCES public.ambalaje_manufacturers(id),
  crate_type_id UUID REFERENCES public.ambalaje_crate_types(id),
  crate_count INTEGER DEFAULT 0,
  crate_weight NUMERIC DEFAULT 0,
  gross_quantity NUMERIC,
  net_quantity NUMERIC,
  receipt_date TIMESTAMP WITH TIME ZONE,
  entry_number INTEGER,
  document_number TEXT,
  lot_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add triggers for ambalaje_inventory
CREATE TRIGGER set_ambalaje_inventory_lot_number
  BEFORE INSERT ON public.ambalaje_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lot_number();

CREATE TRIGGER calculate_ambalaje_inventory_quantities
  BEFORE INSERT OR UPDATE ON public.ambalaje_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_quantities();

CREATE TRIGGER ensure_ambalaje_inventory_net_quantity
  BEFORE INSERT OR UPDATE ON public.ambalaje_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_net_quantity();

-- Add timestamp triggers
CREATE TRIGGER update_ambalaje_products_updated_at
  BEFORE UPDATE ON public.ambalaje_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ambalaje_suppliers_updated_at
  BEFORE UPDATE ON public.ambalaje_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ambalaje_manufacturers_updated_at
  BEFORE UPDATE ON public.ambalaje_manufacturers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ambalaje_crate_types_updated_at
  BEFORE UPDATE ON public.ambalaje_crate_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all ambalaje tables
ALTER TABLE public.ambalaje_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_crate_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_daily_stock_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for all tables (allow all operations for now)
CREATE POLICY "Allow all operations on ambalaje_products" ON public.ambalaje_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ambalaje_suppliers" ON public.ambalaje_suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ambalaje_manufacturers" ON public.ambalaje_manufacturers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ambalaje_crate_types" ON public.ambalaje_crate_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ambalaje_inventory" ON public.ambalaje_inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ambalaje_inventory_history" ON public.ambalaje_inventory_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ambalaje_daily_stock_snapshots" ON public.ambalaje_daily_stock_snapshots FOR ALL USING (true) WITH CHECK (true);