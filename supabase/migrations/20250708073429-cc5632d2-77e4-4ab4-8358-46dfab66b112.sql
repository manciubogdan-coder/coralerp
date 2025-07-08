-- Create ambalaje transfer tables
CREATE TABLE IF NOT EXISTS public.ambalaje_stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  destination TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ambalaje transfer items table
CREATE TABLE IF NOT EXISTS public.ambalaje_stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.ambalaje_stock_transfers(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.ambalaje_inventory(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  net_quantity NUMERIC,
  unit TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add trigger for automatic timestamp updates on ambalaje transfers
CREATE TRIGGER update_ambalaje_stock_transfers_modtime
BEFORE UPDATE ON public.ambalaje_stock_transfers
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();