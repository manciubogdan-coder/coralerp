-- Add lot_number column to inventory_history table
ALTER TABLE public.inventory_history 
ADD COLUMN lot_number TEXT;