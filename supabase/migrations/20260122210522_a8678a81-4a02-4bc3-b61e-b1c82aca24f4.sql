-- 1) Helper to normalize & detect Production destination (RO diacritics-safe)
CREATE OR REPLACE FUNCTION public.is_production_destination(p_destination text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    regexp_replace(
      lower(trim(coalesce(p_destination, ''))),
      '[\s\u00A0]+',
      '',
      'g'
    )
  ) IN (
    'productie',
    -- also accept common variants with diacritics (in case regex/encoding keeps them)
    'producție',
    'producţie'
  );
$$;

-- 2) Trigger function for materii-prime transfer items -> production_stock
CREATE OR REPLACE FUNCTION public.trg_sync_production_stock_from_transfer_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_dest text;
  v_transfer_date date;
  v_inv record;
  v_qty numeric;
BEGIN
  SELECT destination, transfer_date
    INTO v_dest, v_transfer_date
  FROM public.stock_transfers
  WHERE id = NEW.transfer_id;

  IF NOT public.is_production_destination(v_dest) THEN
    RETURN NEW;
  END IF;

  SELECT id, name, product_id, supplier_id, manufacturer_id, lot_number, document_number, unit
    INTO v_inv
  FROM public.inventory
  WHERE id = NEW.inventory_item_id;

  IF v_inv.id IS NULL THEN
    -- inventory row missing; skip
    RETURN NEW;
  END IF;

  v_qty := COALESCE(NEW.net_quantity, NEW.quantity);

  INSERT INTO public.production_stock (
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
  ) VALUES (
    v_inv.id,
    NEW.transfer_id,
    v_inv.product_id,
    v_inv.supplier_id,
    v_inv.manufacturer_id,
    v_inv.name,
    v_qty,
    COALESCE(NEW.unit, v_inv.unit),
    v_inv.lot_number,
    v_inv.document_number,
    v_transfer_date::timestamptz
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_production_stock_from_transfer_item ON public.stock_transfer_items;
CREATE TRIGGER sync_production_stock_from_transfer_item
AFTER INSERT ON public.stock_transfer_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_production_stock_from_transfer_item();

-- 3) Trigger function for ambalaje transfer items -> ambalaje_production_stock
CREATE OR REPLACE FUNCTION public.trg_sync_ambalaje_production_stock_from_transfer_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_dest text;
  v_transfer_date date;
  v_inv record;
  v_qty numeric;
BEGIN
  SELECT destination, transfer_date
    INTO v_dest, v_transfer_date
  FROM public.ambalaje_stock_transfers
  WHERE id = NEW.transfer_id;

  IF NOT public.is_production_destination(v_dest) THEN
    RETURN NEW;
  END IF;

  SELECT id, name, product_id, supplier_id, manufacturer_id, lot_number, document_number, unit
    INTO v_inv
  FROM public.ambalaje_inventory
  WHERE id = NEW.inventory_item_id;

  IF v_inv.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_qty := COALESCE(NEW.net_quantity, NEW.quantity);

  INSERT INTO public.ambalaje_production_stock (
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
  ) VALUES (
    v_inv.id,
    NEW.transfer_id,
    v_inv.product_id,
    v_inv.supplier_id,
    v_inv.manufacturer_id,
    v_inv.name,
    v_qty,
    COALESCE(NEW.unit, v_inv.unit),
    v_inv.lot_number,
    v_inv.document_number,
    v_transfer_date::timestamptz
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_ambalaje_production_stock_from_transfer_item ON public.ambalaje_stock_transfer_items;
CREATE TRIGGER sync_ambalaje_production_stock_from_transfer_item
AFTER INSERT ON public.ambalaje_stock_transfer_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_ambalaje_production_stock_from_transfer_item();
