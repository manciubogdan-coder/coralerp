-- Migrez datele existente din inventory în reception_records
INSERT INTO public.reception_records (
  id, entry_number, receipt_date, name, original_quantity, gross_quantity, 
  net_quantity, unit, crate_count, crate_weight, crate_type_id,
  document_number, lot_number, supplier_id, product_id, manufacturer_id, 
  supplier_name, created_at, updated_at
)
SELECT 
  id, entry_number, receipt_date, name, quantity as original_quantity, 
  COALESCE(gross_quantity, quantity), COALESCE(net_quantity, quantity), 
  unit, COALESCE(crate_count, 0), COALESCE(crate_weight, 0), crate_type_id,
  document_number, lot_number, supplier_id, product_id, manufacturer_id,
  supplier_name, created_at, updated_at
FROM public.inventory
WHERE receipt_date IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Migrez datele existente din ambalaje_inventory în ambalaje_reception_records
INSERT INTO public.ambalaje_reception_records (
  id, entry_number, receipt_date, name, original_quantity, gross_quantity, 
  net_quantity, unit, crate_count, crate_weight, crate_type_id,
  document_number, lot_number, supplier_id, product_id, manufacturer_id, 
  supplier_name, created_at, updated_at
)
SELECT 
  id, entry_number, receipt_date, name, quantity as original_quantity, 
  COALESCE(gross_quantity, quantity), COALESCE(net_quantity, quantity), 
  unit, COALESCE(crate_count, 0), COALESCE(crate_weight, 0), crate_type_id,
  document_number, lot_number, supplier_id, product_id, manufacturer_id,
  supplier_name, created_at, updated_at
FROM public.ambalaje_inventory
WHERE receipt_date IS NOT NULL
ON CONFLICT (id) DO NOTHING;