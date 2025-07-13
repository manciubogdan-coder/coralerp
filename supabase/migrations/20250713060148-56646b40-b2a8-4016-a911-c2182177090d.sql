-- Simplific structura pentru a lucra doar cu cantitatea netă
-- Elimin gross_quantity și păstrez doar quantity (care va fi net)

-- 1. Actualizez structura tabelului inventory
ALTER TABLE inventory 
DROP COLUMN IF EXISTS gross_quantity,
DROP COLUMN IF EXISTS crate_count,
DROP COLUMN IF EXISTS crate_type_id,
DROP COLUMN IF EXISTS crate_weight,
DROP COLUMN IF EXISTS net_quantity;

-- Quantity va reprezenta cantitatea netă finală
-- Păstrez doar informații esențiale pentru lot
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- 2. Actualizez structura pentru ambalaje
ALTER TABLE ambalaje_inventory 
DROP COLUMN IF EXISTS gross_quantity,
DROP COLUMN IF EXISTS crate_count,
DROP COLUMN IF EXISTS crate_type_id,
DROP COLUMN IF EXISTS crate_weight,
DROP COLUMN IF EXISTS net_quantity;

ALTER TABLE ambalaje_inventory 
ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- 3. Actualizez history să păstreze doar cantitatea netă
ALTER TABLE inventory_history 
DROP COLUMN IF EXISTS crate_count,
DROP COLUMN IF EXISTS crate_type_id,
DROP COLUMN IF EXISTS crate_weight,
DROP COLUMN IF EXISTS net_quantity;

ALTER TABLE ambalaje_inventory_history 
DROP COLUMN IF EXISTS crate_count,
DROP COLUMN IF EXISTS crate_type_id,
DROP COLUMN IF EXISTS crate_weight,
DROP COLUMN IF EXISTS net_quantity;

-- 4. Elimin trigger-urile complexe - nu mai sunt necesare
DROP TRIGGER IF EXISTS calculate_quantities_reception_only_trigger ON inventory;
DROP TRIGGER IF EXISTS calculate_quantities_ambalaje_reception_only_trigger ON ambalaje_inventory;

-- 5. Creez trigger simplu pentru setarea lot_number
CREATE OR REPLACE FUNCTION public.simple_inventory_setup()
RETURNS TRIGGER AS $$
BEGIN
  -- Setez lot_number dacă nu e specificat
  IF NEW.lot_number IS NULL THEN
    NEW.lot_number := generate_lot_number();
  END IF;
  
  -- Setez supplier_name din relația cu suppliers dacă nu e specificat
  IF NEW.supplier_name IS NULL AND NEW.supplier_id IS NOT NULL THEN
    SELECT name INTO NEW.supplier_name 
    FROM suppliers 
    WHERE id = NEW.supplier_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER simple_inventory_setup_trigger
  BEFORE INSERT ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION simple_inventory_setup();

-- 6. Același trigger pentru ambalaje
CREATE OR REPLACE FUNCTION public.simple_ambalaje_inventory_setup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lot_number IS NULL THEN
    NEW.lot_number := generate_lot_number();
  END IF;
  
  IF NEW.supplier_name IS NULL AND NEW.supplier_id IS NOT NULL THEN
    SELECT name INTO NEW.supplier_name 
    FROM ambalaje_suppliers 
    WHERE id = NEW.supplier_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER simple_ambalaje_inventory_setup_trigger
  BEFORE INSERT ON ambalaje_inventory
  FOR EACH ROW
  EXECUTE FUNCTION simple_ambalaje_inventory_setup();