
-- Function to create a stock transfer item
CREATE OR REPLACE FUNCTION public.create_stock_transfer_item(
  p_transfer_id UUID,
  p_inventory_item_id UUID,
  p_quantity NUMERIC,
  p_unit TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_item_id UUID;
BEGIN
  -- Insert the new transfer item and return the ID
  INSERT INTO public.stock_transfer_items (
    transfer_id,
    inventory_item_id,
    quantity,
    unit
  )
  VALUES (
    p_transfer_id,
    p_inventory_item_id,
    p_quantity,
    p_unit
  )
  RETURNING id INTO new_item_id;
  
  RETURN new_item_id;
END;
$$;
