-- Add supplier_code field to ambalaje_suppliers table
ALTER TABLE public.ambalaje_suppliers 
ADD COLUMN supplier_code TEXT;