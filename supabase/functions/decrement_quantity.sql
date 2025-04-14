
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
