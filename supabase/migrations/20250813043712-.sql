-- Add pt_percent column to products and ambalaje_products to support "% PT" in UI

-- Safely add to public.products if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    ALTER TABLE public.products 
      ADD COLUMN IF NOT EXISTS pt_percent numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add to ambalaje_products (this table exists in current schema)
ALTER TABLE public.ambalaje_products 
  ADD COLUMN IF NOT EXISTS pt_percent numeric NOT NULL DEFAULT 0;
