-- Drop existing view if it exists and create the ambalaje_stock_transfer_view
DROP VIEW IF EXISTS public.ambalaje_stock_transfer_view;

CREATE VIEW public.ambalaje_stock_transfer_view AS
SELECT 
  st.id,
  st.transfer_date,
  st.destination,
  st.notes,
  st.created_at,
  sti.transfer_id,
  sti.inventory_item_id,
  sti.quantity,
  sti.net_quantity,
  sti.unit,
  ai.name,
  ai.document_number,
  ai.entry_number,
  ai.lot_number,
  ai.supplier,
  as2.name as supplier_name,
  am.name as manufacturer_name,
  ap.name as product_name,
  ap.cod_produs as product_code
FROM public.ambalaje_stock_transfers st
JOIN public.ambalaje_stock_transfer_items sti ON st.id = sti.transfer_id
JOIN public.ambalaje_inventory ai ON sti.inventory_item_id = ai.id
LEFT JOIN public.ambalaje_suppliers as2 ON ai.supplier_id = as2.id
LEFT JOIN public.ambalaje_manufacturers am ON ai.manufacturer_id = am.id
LEFT JOIN public.ambalaje_products ap ON ai.product_id = ap.id;