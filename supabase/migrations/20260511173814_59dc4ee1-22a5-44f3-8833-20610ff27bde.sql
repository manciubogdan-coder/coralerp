ALTER TABLE public.purchase_orders_imported_items
ADD COLUMN IF NOT EXISTS cod_articol text,
ADD COLUMN IF NOT EXISTS product_id uuid;

CREATE INDEX IF NOT EXISTS idx_poii_cod_articol ON public.purchase_orders_imported_items(cod_articol);
CREATE INDEX IF NOT EXISTS idx_poii_product_id ON public.purchase_orders_imported_items(product_id);