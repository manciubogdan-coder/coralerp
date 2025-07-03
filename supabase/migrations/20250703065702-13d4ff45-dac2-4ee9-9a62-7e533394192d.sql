-- Migrate existing reception data from inventory to receptions table
INSERT INTO public.receptions (
  entry_number,
  receipt_date,
  name,
  quantity,
  gross_quantity,
  net_quantity,
  unit,
  document_number,
  lot_number,
  supplier_id,
  product_id,
  manufacturer_id,
  crate_type_id,
  crate_count,
  crate_weight,
  created_at,
  updated_at
)
SELECT 
  entry_number,
  receipt_date,
  name,
  quantity,
  gross_quantity,
  net_quantity,
  unit,
  document_number,
  lot_number,
  supplier_id,
  product_id,
  manufacturer_id,
  crate_type_id,
  crate_count,
  crate_weight,
  created_at,
  updated_at
FROM public.inventory 
WHERE receipt_date IS NOT NULL;