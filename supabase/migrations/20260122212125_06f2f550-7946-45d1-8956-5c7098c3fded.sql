-- Backfill: adaugă în production_stock ce lipsește pentru transferurile către Producție (azi)
insert into public.production_stock (
  inventory_item_id,
  transfer_id,
  product_id,
  supplier_id,
  manufacturer_id,
  name,
  quantity,
  unit,
  lot_number,
  document_number,
  transfer_date
)
select
  inv.id as inventory_item_id,
  sti.transfer_id,
  inv.product_id,
  inv.supplier_id,
  inv.manufacturer_id,
  inv.name,
  coalesce(sti.net_quantity, sti.quantity) as quantity,
  coalesce(sti.unit, inv.unit) as unit,
  inv.lot_number,
  inv.document_number,
  st.transfer_date::timestamptz as transfer_date
from public.stock_transfer_items sti
join public.stock_transfers st on st.id = sti.transfer_id
join public.inventory inv on inv.id = sti.inventory_item_id
where st.transfer_date = current_date
  and public.is_production_destination(st.destination)
  and not exists (
    select 1
    from public.production_stock ps
    where ps.transfer_id = sti.transfer_id
      and ps.inventory_item_id = sti.inventory_item_id
  );

-- Backfill: ambalaje_production_stock (azi)
insert into public.ambalaje_production_stock (
  inventory_item_id,
  transfer_id,
  product_id,
  supplier_id,
  manufacturer_id,
  name,
  quantity,
  unit,
  lot_number,
  document_number,
  transfer_date
)
select
  inv.id as inventory_item_id,
  sti.transfer_id,
  inv.product_id,
  inv.supplier_id,
  inv.manufacturer_id,
  inv.name,
  coalesce(sti.net_quantity, sti.quantity) as quantity,
  coalesce(sti.unit, inv.unit) as unit,
  inv.lot_number,
  inv.document_number,
  st.transfer_date::timestamptz as transfer_date
from public.ambalaje_stock_transfer_items sti
join public.ambalaje_stock_transfers st on st.id = sti.transfer_id
join public.ambalaje_inventory inv on inv.id = sti.inventory_item_id
where st.transfer_date = current_date
  and public.is_production_destination(st.destination)
  and not exists (
    select 1
    from public.ambalaje_production_stock ps
    where ps.transfer_id = sti.transfer_id
      and ps.inventory_item_id = sti.inventory_item_id
  );