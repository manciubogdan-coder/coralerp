-- Create receptions table to store original reception data
CREATE TABLE public.receptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number INTEGER NOT NULL,
  receipt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  gross_quantity NUMERIC,
  net_quantity NUMERIC,
  unit TEXT NOT NULL,
  document_number TEXT,
  lot_number TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  product_id UUID REFERENCES public.products(id),
  manufacturer_id UUID REFERENCES public.manufacturers(id),
  crate_type_id UUID REFERENCES public.crate_types(id),
  crate_count INTEGER DEFAULT 0,
  crate_weight NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.receptions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (same as inventory table)
CREATE POLICY "Allow public insert on receptions" 
ON public.receptions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public select on receptions" 
ON public.receptions 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public update on receptions" 
ON public.receptions 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on receptions" 
ON public.receptions 
FOR DELETE 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_receptions_receipt_date ON public.receptions(receipt_date);
CREATE INDEX idx_receptions_entry_number ON public.receptions(entry_number);
CREATE INDEX idx_receptions_product_id ON public.receptions(product_id);
CREATE INDEX idx_receptions_supplier_id ON public.receptions(supplier_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_receptions_updated_at
BEFORE UPDATE ON public.receptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();