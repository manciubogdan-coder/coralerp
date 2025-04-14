
-- Function to create a stock transfer and return its ID
CREATE OR REPLACE FUNCTION public.create_stock_transfer(
  p_transfer_date DATE,
  p_destination TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_transfer_id UUID;
BEGIN
  -- Insert the new transfer and return the ID
  INSERT INTO public.stock_transfers (
    transfer_date,
    destination,
    notes
  )
  VALUES (
    p_transfer_date,
    p_destination,
    p_notes
  )
  RETURNING id INTO new_transfer_id;
  
  RETURN new_transfer_id;
END;
$$;
