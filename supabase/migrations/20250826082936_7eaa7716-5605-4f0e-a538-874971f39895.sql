-- Add supplier_code column to suppliers table (ambalaje_suppliers already has it)
ALTER TABLE public.suppliers ADD COLUMN supplier_code text;