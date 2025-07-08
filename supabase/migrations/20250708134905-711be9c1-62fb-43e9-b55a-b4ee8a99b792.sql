-- Create stock_transfer_view for materii prime to support transfer history with product codes
DROP VIEW IF EXISTS public.stock_transfer_view;

CREATE VIEW public.stock_transfer_view AS
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
  i.name,
  i.document_number,
  i.entry_number,
  i.lot_number,
  i.supplier,
  s.name as supplier_name,
  m.name as manufacturer_name,
  p.name as product_name,
  p.cod_produs as product_code
FROM public.stock_transfers st
JOIN public.stock_transfer_items sti ON st.id = sti.transfer_id
JOIN public.inventory i ON sti.inventory_item_id = i.id
LEFT JOIN public.suppliers s ON i.supplier_id = s.id
LEFT JOIN public.manufacturers m ON i.manufacturer_id = m.id
LEFT JOIN public.products p ON i.product_id = p.id;