-- Reparație completă pentru toate produsele din stoc
-- Pas 1: Pentru toate item-urile care au transferuri, actualizez și net_quantity = quantity
UPDATE inventory 
SET net_quantity = quantity, updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT inventory_item_id 
  FROM inventory_history 
  WHERE action = 'remove' 
    AND operation_date >= '2025-07-01'
);

-- Pas 2: Pentru item-urile care nu au transferuri dar au net_quantity != quantity, 
-- să le fac consistente (net_quantity = quantity) 
UPDATE inventory 
SET net_quantity = quantity, updated_at = NOW()
WHERE net_quantity != quantity 
  AND id NOT IN (
    SELECT DISTINCT inventory_item_id 
    FROM inventory_history 
    WHERE action = 'remove' 
      AND operation_date >= '2025-07-01'
  );