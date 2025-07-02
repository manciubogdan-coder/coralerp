-- Actualizez și net_quantity pentru toate item-urile care au fost transferate
-- Setez net_quantity = quantity pentru toate item-urile unde quantity a fost scăzută
UPDATE inventory 
SET net_quantity = quantity 
WHERE id IN (
  SELECT DISTINCT inventory_item_id 
  FROM inventory_history 
  WHERE action = 'remove' 
    AND operation_date >= '2025-07-01'
);