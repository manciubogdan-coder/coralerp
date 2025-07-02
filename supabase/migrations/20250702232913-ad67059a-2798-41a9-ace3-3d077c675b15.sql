-- Pas 1: Actualizez lot_number-urile în inventory_history pentru toate transferurile cu lot_number null
UPDATE inventory_history 
SET lot_number = i.lot_number
FROM inventory i
WHERE inventory_history.inventory_item_id = i.id 
  AND inventory_history.action = 'remove' 
  AND inventory_history.lot_number IS NULL 
  AND inventory_history.operation_date >= '2025-07-01';

-- Pas 2: Scad cantitățile din inventory pentru toate transferurile retroactive
-- Folosesc un CTE pentru a calcula cantitățile totale de scăzut pentru fiecare item
WITH transfer_totals AS (
  SELECT 
    inventory_item_id,
    SUM(quantity) as total_transferred
  FROM inventory_history 
  WHERE action = 'remove' 
    AND operation_date >= '2025-07-01'
    AND lot_number IS NOT NULL
  GROUP BY inventory_item_id
)
UPDATE inventory 
SET quantity = GREATEST(0, inventory.quantity - transfer_totals.total_transferred)
FROM transfer_totals
WHERE inventory.id = transfer_totals.inventory_item_id;