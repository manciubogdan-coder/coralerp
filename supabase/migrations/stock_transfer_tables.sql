
-- Create the stock_transfers table to track transfer documents if it doesn't exist already
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  destination TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create the stock_transfer_items table to track individual items in a transfer if it doesn't exist already
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add function to decrement quantity if it doesn't exist already
CREATE OR REPLACE FUNCTION public.decrement_quantity(row_id uuid, amount numeric)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  current_qty numeric;
  new_qty numeric;
BEGIN
  -- Get current quantity
  SELECT quantity INTO current_qty FROM public.inventory WHERE id = row_id;
  
  -- Calculate new quantity
  new_qty := GREATEST(0, current_qty - amount);
  
  -- Update quantity in the row
  UPDATE public.inventory 
  SET quantity = new_qty
  WHERE id = row_id;
  
  -- Return the new quantity
  RETURN new_qty;
END;
$$;
