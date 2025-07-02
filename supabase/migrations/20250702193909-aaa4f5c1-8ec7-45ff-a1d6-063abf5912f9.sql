-- Create daily stock snapshots table
CREATE TABLE public.daily_stock_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  net_quantity NUMERIC,
  gross_quantity NUMERIC,
  unit TEXT NOT NULL,
  lot_number TEXT,
  document_number TEXT,
  entry_number INTEGER,
  receipt_date TIMESTAMP WITH TIME ZONE,
  supplier_id UUID,
  product_id UUID,
  manufacturer_id UUID,
  crate_type_id UUID,
  crate_count INTEGER DEFAULT 0,
  crate_weight NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_stock_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public select on daily_stock_snapshots" 
ON public.daily_stock_snapshots 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on daily_stock_snapshots" 
ON public.daily_stock_snapshots 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on daily_stock_snapshots" 
ON public.daily_stock_snapshots 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on daily_stock_snapshots" 
ON public.daily_stock_snapshots 
FOR DELETE 
USING (true);

-- Add foreign key constraints
ALTER TABLE public.daily_stock_snapshots 
ADD CONSTRAINT daily_stock_snapshots_supplier_id_fkey 
FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);

ALTER TABLE public.daily_stock_snapshots 
ADD CONSTRAINT daily_stock_snapshots_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE public.daily_stock_snapshots 
ADD CONSTRAINT daily_stock_snapshots_manufacturer_id_fkey 
FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id);

ALTER TABLE public.daily_stock_snapshots 
ADD CONSTRAINT daily_stock_snapshots_crate_type_id_fkey 
FOREIGN KEY (crate_type_id) REFERENCES public.crate_types(id);

-- Create indexes for performance
CREATE INDEX idx_daily_stock_snapshots_date ON public.daily_stock_snapshots(snapshot_date);
CREATE INDEX idx_daily_stock_snapshots_product ON public.daily_stock_snapshots(product_id);
CREATE INDEX idx_daily_stock_snapshots_lot ON public.daily_stock_snapshots(lot_number);

-- Create trigger for updated_at
CREATE TRIGGER update_daily_stock_snapshots_updated_at
BEFORE UPDATE ON public.daily_stock_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();