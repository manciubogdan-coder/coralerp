-- Adaug coloanele lipsă și în tabelul ambalaje_inventory
ALTER TABLE public.ambalaje_inventory 
ADD COLUMN IF NOT EXISTS gross_quantity NUMERIC,
ADD COLUMN IF NOT EXISTS net_quantity NUMERIC,
ADD COLUMN IF NOT EXISTS crate_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS crate_weight NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS crate_type_id UUID REFERENCES public.ambalaje_crate_types(id);

-- Actualizez datele existente să aibă gross_quantity = quantity și net_quantity = quantity
UPDATE public.ambalaje_inventory 
SET gross_quantity = quantity, 
    net_quantity = quantity 
WHERE gross_quantity IS NULL;