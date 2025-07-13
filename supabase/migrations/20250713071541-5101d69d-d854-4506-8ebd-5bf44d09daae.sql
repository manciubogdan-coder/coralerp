-- Creez tabele separate pentru recepții (care nu se modifică niciodată)
-- și stoc curent (care se modifică cu transferurile)

-- Tabelul de recepții originale (nu se modifică niciodată)
CREATE TABLE IF NOT EXISTS public.reception_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number INTEGER NOT NULL DEFAULT nextval('inventory_entry_number_seq'),
  receipt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  original_quantity NUMERIC NOT NULL DEFAULT 0,
  gross_quantity NUMERIC,
  net_quantity NUMERIC,
  unit TEXT NOT NULL,
  crate_count INTEGER DEFAULT 0,
  crate_weight NUMERIC DEFAULT 0,
  crate_type_id UUID REFERENCES public.crate_types(id),
  document_number TEXT,
  lot_number TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  product_id UUID REFERENCES public.products(id),
  manufacturer_id UUID REFERENCES public.manufacturers(id),
  supplier_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabelul pentru recepții ambalaje (nu se modifică niciodată)
CREATE TABLE IF NOT EXISTS public.ambalaje_reception_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number INTEGER NOT NULL DEFAULT nextval('inventory_entry_number_seq'),
  receipt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  original_quantity NUMERIC NOT NULL DEFAULT 0,
  gross_quantity NUMERIC,
  net_quantity NUMERIC,
  unit TEXT NOT NULL,
  crate_count INTEGER DEFAULT 0,
  crate_weight NUMERIC DEFAULT 0,
  crate_type_id UUID REFERENCES public.ambalaje_crate_types(id),
  document_number TEXT,
  lot_number TEXT,
  supplier_id UUID REFERENCES public.ambalaje_suppliers(id),
  product_id UUID REFERENCES public.ambalaje_products(id),
  manufacturer_id UUID REFERENCES public.ambalaje_manufacturers(id),
  supplier_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexuri pentru performanță
CREATE INDEX IF NOT EXISTS idx_reception_records_receipt_date ON public.reception_records(receipt_date);
CREATE INDEX IF NOT EXISTS idx_reception_records_product_id ON public.reception_records(product_id);
CREATE INDEX IF NOT EXISTS idx_ambalaje_reception_records_receipt_date ON public.ambalaje_reception_records(receipt_date);
CREATE INDEX IF NOT EXISTS idx_ambalaje_reception_records_product_id ON public.ambalaje_reception_records(product_id);

-- Politici RLS
ALTER TABLE public.reception_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_reception_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on reception_records" ON public.reception_records FOR ALL USING (true);
CREATE POLICY "Allow all operations on ambalaje_reception_records" ON public.ambalaje_reception_records FOR ALL USING (true);