-- Elimin view-urile care depind de coloanele pe care vreau să le șterg
DROP VIEW IF EXISTS transfer_operations CASCADE;
DROP VIEW IF EXISTS consumption_analytics CASCADE;
DROP VIEW IF EXISTS inventory_analytics CASCADE;
DROP VIEW IF EXISTS inventory_aggregated_view CASCADE;
DROP VIEW IF EXISTS inventory_with_history CASCADE;

-- Verific ce alte dependențe pot exista
DROP VIEW IF EXISTS ambalaje_stock_transfer_view CASCADE;

-- Acum pot să șterg coloanele
-- 1. Actualizez structura tabelului inventory
ALTER TABLE inventory 
DROP COLUMN IF EXISTS gross_quantity CASCADE,
DROP COLUMN IF EXISTS crate_count CASCADE,
DROP COLUMN IF EXISTS crate_type_id CASCADE,
DROP COLUMN IF EXISTS crate_weight CASCADE,
DROP COLUMN IF EXISTS net_quantity CASCADE;

-- Quantity va reprezenta cantitatea netă finală
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- 2. Actualizez structura pentru ambalaje
ALTER TABLE ambalaje_inventory 
DROP COLUMN IF EXISTS gross_quantity CASCADE,
DROP COLUMN IF EXISTS crate_count CASCADE,
DROP COLUMN IF EXISTS crate_type_id CASCADE,
DROP COLUMN IF EXISTS crate_weight CASCADE,
DROP COLUMN IF EXISTS net_quantity CASCADE;

ALTER TABLE ambalaje_inventory 
ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- 3. Actualizez history să păstreze doar cantitatea netă
ALTER TABLE inventory_history 
DROP COLUMN IF EXISTS crate_count CASCADE,
DROP COLUMN IF EXISTS crate_type_id CASCADE,
DROP COLUMN IF EXISTS crate_weight CASCADE,
DROP COLUMN IF EXISTS net_quantity CASCADE;

ALTER TABLE ambalaje_inventory_history 
DROP COLUMN IF EXISTS crate_count CASCADE,
DROP COLUMN IF EXISTS crate_type_id CASCADE,
DROP COLUMN IF EXISTS crate_weight CASCADE,
DROP COLUMN IF EXISTS net_quantity CASCADE;