-- =============================================
-- ETICHETE SECTION - Complete Database Schema
-- =============================================

-- 1. Suppliers table for etichete
CREATE TABLE public.etichete_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  supplier_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Manufacturers table for etichete
CREATE TABLE public.etichete_manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Products table for etichete
CREATE TABLE public.etichete_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  default_unit TEXT NOT NULL,
  cod_produs TEXT,
  pt_percent NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Crate types table for etichete
CREATE TABLE public.etichete_crate_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Main inventory table for etichete
CREATE TABLE public.etichete_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number SERIAL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  gross_quantity NUMERIC,
  net_quantity NUMERIC,
  crate_count INTEGER,
  crate_weight NUMERIC,
  crate_type_id UUID REFERENCES public.etichete_crate_types(id),
  document_number TEXT,
  lot_number TEXT,
  receipt_date TIMESTAMPTZ,
  supplier TEXT,
  supplier_id UUID REFERENCES public.etichete_suppliers(id),
  supplier_name TEXT,
  product_id UUID REFERENCES public.etichete_products(id),
  manufacturer_id UUID REFERENCES public.etichete_manufacturers(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Inventory history table for etichete
CREATE TABLE public.etichete_inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID REFERENCES public.etichete_inventory(id),
  action TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  previous_quantity NUMERIC,
  supplier TEXT,
  supplier_id UUID REFERENCES public.etichete_suppliers(id),
  product_id UUID REFERENCES public.etichete_products(id),
  manufacturer_id UUID REFERENCES public.etichete_manufacturers(id),
  document_number TEXT,
  lot_number TEXT,
  pallets INTEGER,
  notes TEXT,
  operation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_timestamp TIMESTAMPTZ
);

-- 7. Reception records table for etichete
CREATE TABLE public.etichete_reception_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number SERIAL,
  receipt_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  original_quantity NUMERIC NOT NULL DEFAULT 0,
  gross_quantity NUMERIC,
  net_quantity NUMERIC,
  unit TEXT NOT NULL,
  crate_count INTEGER,
  crate_weight NUMERIC,
  crate_type_id UUID REFERENCES public.etichete_crate_types(id),
  document_number TEXT,
  lot_number TEXT,
  supplier_id UUID REFERENCES public.etichete_suppliers(id),
  supplier_name TEXT,
  product_id UUID REFERENCES public.etichete_products(id),
  manufacturer_id UUID REFERENCES public.etichete_manufacturers(id),
  nonconform_percent NUMERIC,
  consider_quantity NUMERIC,
  obs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Stock transfers table for etichete
CREATE TABLE public.etichete_stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  destination TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Stock transfer items table for etichete
CREATE TABLE public.etichete_stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.etichete_stock_transfers(id),
  inventory_item_id UUID NOT NULL REFERENCES public.etichete_inventory(id),
  quantity NUMERIC NOT NULL,
  net_quantity NUMERIC,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Production stock table for etichete
CREATE TABLE public.etichete_production_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID REFERENCES public.etichete_inventory(id),
  transfer_id UUID REFERENCES public.etichete_stock_transfers(id),
  product_id UUID REFERENCES public.etichete_products(id),
  supplier_id UUID REFERENCES public.etichete_suppliers(id),
  manufacturer_id UUID REFERENCES public.etichete_manufacturers(id),
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  lot_number TEXT,
  document_number TEXT,
  transfer_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Production stock history table for etichete
CREATE TABLE public.etichete_production_stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_stock_id UUID REFERENCES public.etichete_production_stock(id),
  action TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  previous_quantity NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Daily stock snapshots table for etichete
CREATE TABLE public.etichete_daily_stock_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  gross_quantity NUMERIC,
  net_quantity NUMERIC,
  crate_count INTEGER,
  crate_weight NUMERIC,
  crate_type_id UUID REFERENCES public.etichete_crate_types(id),
  document_number TEXT,
  entry_number INTEGER,
  lot_number TEXT,
  receipt_date TIMESTAMPTZ,
  supplier_id UUID REFERENCES public.etichete_suppliers(id),
  product_id UUID REFERENCES public.etichete_products(id),
  manufacturer_id UUID REFERENCES public.etichete_manufacturers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Daily stock quality table for etichete
CREATE TABLE public.etichete_daily_stock_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL UNIQUE REFERENCES public.etichete_daily_stock_snapshots(id),
  nonconform_percent NUMERIC NOT NULL DEFAULT 0,
  consider_quantity NUMERIC NOT NULL DEFAULT 0,
  obs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE public.etichete_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_crate_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_reception_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_production_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_production_stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_daily_stock_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_daily_stock_quality ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies - Allow all for authenticated users
-- =============================================

-- Suppliers policies
CREATE POLICY "etichete_suppliers_select" ON public.etichete_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_suppliers_insert" ON public.etichete_suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_suppliers_update" ON public.etichete_suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_suppliers_delete" ON public.etichete_suppliers FOR DELETE TO authenticated USING (true);

-- Manufacturers policies
CREATE POLICY "etichete_manufacturers_select" ON public.etichete_manufacturers FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_manufacturers_insert" ON public.etichete_manufacturers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_manufacturers_update" ON public.etichete_manufacturers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_manufacturers_delete" ON public.etichete_manufacturers FOR DELETE TO authenticated USING (true);

-- Products policies
CREATE POLICY "etichete_products_select" ON public.etichete_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_products_insert" ON public.etichete_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_products_update" ON public.etichete_products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_products_delete" ON public.etichete_products FOR DELETE TO authenticated USING (true);

-- Crate types policies
CREATE POLICY "etichete_crate_types_select" ON public.etichete_crate_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_crate_types_insert" ON public.etichete_crate_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_crate_types_update" ON public.etichete_crate_types FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_crate_types_delete" ON public.etichete_crate_types FOR DELETE TO authenticated USING (true);

-- Inventory policies
CREATE POLICY "etichete_inventory_select" ON public.etichete_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_inventory_insert" ON public.etichete_inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_inventory_update" ON public.etichete_inventory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_inventory_delete" ON public.etichete_inventory FOR DELETE TO authenticated USING (true);

-- Inventory history policies
CREATE POLICY "etichete_inventory_history_select" ON public.etichete_inventory_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_inventory_history_insert" ON public.etichete_inventory_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_inventory_history_update" ON public.etichete_inventory_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_inventory_history_delete" ON public.etichete_inventory_history FOR DELETE TO authenticated USING (true);

-- Reception records policies
CREATE POLICY "etichete_reception_records_select" ON public.etichete_reception_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_reception_records_insert" ON public.etichete_reception_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_reception_records_update" ON public.etichete_reception_records FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_reception_records_delete" ON public.etichete_reception_records FOR DELETE TO authenticated USING (true);

-- Stock transfers policies
CREATE POLICY "etichete_stock_transfers_select" ON public.etichete_stock_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_stock_transfers_insert" ON public.etichete_stock_transfers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_stock_transfers_update" ON public.etichete_stock_transfers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_stock_transfers_delete" ON public.etichete_stock_transfers FOR DELETE TO authenticated USING (true);

-- Stock transfer items policies
CREATE POLICY "etichete_stock_transfer_items_select" ON public.etichete_stock_transfer_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_stock_transfer_items_insert" ON public.etichete_stock_transfer_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_stock_transfer_items_update" ON public.etichete_stock_transfer_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_stock_transfer_items_delete" ON public.etichete_stock_transfer_items FOR DELETE TO authenticated USING (true);

-- Production stock policies
CREATE POLICY "etichete_production_stock_select" ON public.etichete_production_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_production_stock_insert" ON public.etichete_production_stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_production_stock_update" ON public.etichete_production_stock FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_production_stock_delete" ON public.etichete_production_stock FOR DELETE TO authenticated USING (true);

-- Production stock history policies
CREATE POLICY "etichete_production_stock_history_select" ON public.etichete_production_stock_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_production_stock_history_insert" ON public.etichete_production_stock_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_production_stock_history_update" ON public.etichete_production_stock_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_production_stock_history_delete" ON public.etichete_production_stock_history FOR DELETE TO authenticated USING (true);

-- Daily stock snapshots policies
CREATE POLICY "etichete_daily_stock_snapshots_select" ON public.etichete_daily_stock_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_daily_stock_snapshots_insert" ON public.etichete_daily_stock_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_daily_stock_snapshots_update" ON public.etichete_daily_stock_snapshots FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_daily_stock_snapshots_delete" ON public.etichete_daily_stock_snapshots FOR DELETE TO authenticated USING (true);

-- Daily stock quality policies
CREATE POLICY "etichete_daily_stock_quality_select" ON public.etichete_daily_stock_quality FOR SELECT TO authenticated USING (true);
CREATE POLICY "etichete_daily_stock_quality_insert" ON public.etichete_daily_stock_quality FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "etichete_daily_stock_quality_update" ON public.etichete_daily_stock_quality FOR UPDATE TO authenticated USING (true);
CREATE POLICY "etichete_daily_stock_quality_delete" ON public.etichete_daily_stock_quality FOR DELETE TO authenticated USING (true);

-- =============================================
-- Triggers for etichete inventory calculations
-- =============================================

-- Function to calculate quantities for etichete
CREATE OR REPLACE FUNCTION public.calculate_quantities_etichete_reception_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.gross_quantity := NEW.quantity;
    
    IF NEW.crate_type_id IS NOT NULL AND NEW.crate_count > 0 THEN
      SELECT NEW.quantity - (ct.weight * NEW.crate_count) - COALESCE(NEW.crate_weight, 0)
      INTO NEW.net_quantity
      FROM public.etichete_crate_types ct 
      WHERE ct.id = NEW.crate_type_id;
      
      IF NEW.net_quantity IS NULL THEN
        NEW.net_quantity := NEW.quantity - COALESCE(NEW.crate_weight, 0);
      END IF;
    ELSE
      NEW.net_quantity := NEW.quantity - COALESCE(NEW.crate_weight, 0);
    END IF;
    
    NEW.net_quantity := GREATEST(NEW.net_quantity, 0);
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF NEW.quantity = 0 THEN
      NEW.net_quantity := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for etichete inventory
CREATE TRIGGER calculate_quantities_etichete_trigger
  BEFORE INSERT OR UPDATE ON public.etichete_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_quantities_etichete_reception_only();

-- Function to sync to etichete reception records
CREATE OR REPLACE FUNCTION public.sync_to_etichete_reception_records()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.receipt_date IS NOT NULL THEN
    INSERT INTO etichete_reception_records (
      id, entry_number, receipt_date, name, original_quantity, 
      gross_quantity, net_quantity, unit, crate_count, crate_weight, 
      crate_type_id, document_number, lot_number, supplier_id, 
      product_id, manufacturer_id, supplier_name, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.entry_number, NEW.receipt_date, NEW.name, NEW.quantity,
      NEW.gross_quantity, NEW.net_quantity, NEW.unit, NEW.crate_count, 
      NEW.crate_weight, NEW.crate_type_id, NEW.document_number, 
      NEW.lot_number, NEW.supplier_id, NEW.product_id, NEW.manufacturer_id, 
      NEW.supplier_name, NEW.created_at, NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for syncing to reception records
CREATE TRIGGER sync_etichete_to_reception_trigger
  AFTER INSERT ON public.etichete_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_to_etichete_reception_records();

-- Function to setup etichete inventory
CREATE OR REPLACE FUNCTION public.simple_etichete_inventory_setup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.lot_number IS NULL THEN
    NEW.lot_number := generate_lot_number();
  END IF;
  
  IF NEW.supplier_name IS NULL AND NEW.supplier_id IS NOT NULL THEN
    SELECT name INTO NEW.supplier_name 
    FROM etichete_suppliers 
    WHERE id = NEW.supplier_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for etichete inventory setup
CREATE TRIGGER etichete_inventory_setup_trigger
  BEFORE INSERT ON public.etichete_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.simple_etichete_inventory_setup();

-- Function to recalculate consider_quantity for etichete reception
CREATE OR REPLACE FUNCTION public.recalc_consider_quantity_reception_etichete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.consider_quantity := GREATEST(0,
    COALESCE(NEW.net_quantity, NEW.gross_quantity, NEW.original_quantity, 0)
    * (1 - COALESCE(NEW.nonconform_percent, 0) / 100.0)
  );
  RETURN NEW;
END;
$function$;

-- Create trigger for recalculating consider_quantity
CREATE TRIGGER recalc_consider_quantity_etichete_trigger
  BEFORE INSERT OR UPDATE ON public.etichete_reception_records
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_consider_quantity_reception_etichete();

-- Function for etichete daily stock quality recalculation
CREATE OR REPLACE FUNCTION public.recalc_consider_quantity_etichete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  base_qty numeric;
  pt numeric := 0;
BEGIN
  SELECT COALESCE(s.net_quantity, s.quantity) INTO base_qty
  FROM public.etichete_daily_stock_snapshots s
  WHERE s.id = NEW.snapshot_id;

  IF base_qty IS NULL THEN
    base_qty := 0;
  END IF;

  SELECT COALESCE(p.pt_percent, 0) INTO pt
  FROM public.etichete_daily_stock_snapshots s
  LEFT JOIN public.etichete_products p ON p.id = s.product_id
  WHERE s.id = NEW.snapshot_id;

  NEW.consider_quantity := GREATEST(
    0,
    base_qty * (1 - COALESCE(NEW.nonconform_percent, 0) / 100.0) * (1 - COALESCE(pt, 0) / 100.0)
  );
  RETURN NEW;
END;
$function$;

-- Create trigger for daily stock quality
CREATE TRIGGER recalc_consider_quantity_etichete_quality_trigger
  BEFORE INSERT OR UPDATE ON public.etichete_daily_stock_quality
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_consider_quantity_etichete();

-- Trigger to sync production stock from transfer items
CREATE OR REPLACE FUNCTION public.trg_sync_etichete_production_stock_from_transfer_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_dest text;
  v_transfer_date date;
  v_inv record;
  v_qty numeric;
BEGIN
  SELECT destination, transfer_date
    INTO v_dest, v_transfer_date
  FROM public.etichete_stock_transfers
  WHERE id = NEW.transfer_id;

  IF NOT public.is_production_destination(v_dest) THEN
    RETURN NEW;
  END IF;

  SELECT id, name, product_id, supplier_id, manufacturer_id, lot_number, document_number, unit
    INTO v_inv
  FROM public.etichete_inventory
  WHERE id = NEW.inventory_item_id;

  IF v_inv.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_qty := COALESCE(NEW.net_quantity, NEW.quantity);

  INSERT INTO public.etichete_production_stock (
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
$function$;

-- Create trigger for syncing production stock
CREATE TRIGGER sync_etichete_production_stock_trigger
  AFTER INSERT ON public.etichete_stock_transfer_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_etichete_production_stock_from_transfer_item();