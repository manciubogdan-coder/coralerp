-- Add supplier_code column to both suppliers tables
ALTER TABLE public.suppliers ADD COLUMN supplier_code text;
ALTER TABLE public.ambalaje_suppliers ADD COLUMN supplier_code text;