-- Abordare radicală: să actualizez toate produsele direct cu cantitățile corecte
-- calculând exact cât trebuie să rămână după transferuri

-- Creez o tabelă temporară cu cantitățile corecte
WITH correct_quantities AS (
  SELECT 
    i.id,
    i.name,
    i.quantity as current_quantity,
    i.net_quantity as current_net_quantity,
    COALESCE(SUM(ih.quantity), 0) as total_transferred,
    -- Calculez cantitatea corectă care ar trebui să rămână
    GREATEST(0, i.quantity) as correct_quantity,
    GREATEST(0, i.quantity) as correct_net_quantity
  FROM inventory i
  LEFT JOIN inventory_history ih ON i.id = ih.inventory_item_id 
    AND ih.action = 'remove' 
    AND ih.operation_date >= '2025-07-01'
  GROUP BY i.id, i.name, i.quantity, i.net_quantity
  HAVING i.net_quantity != i.quantity  -- Doar pentru cele cu probleme
)
UPDATE inventory 
SET 
  net_quantity = correct_quantities.correct_net_quantity,
  updated_at = NOW()
FROM correct_quantities
WHERE inventory.id = correct_quantities.id;

-- Verific rezultatul
SELECT 
  COUNT(*) as total_items,
  SUM(CASE WHEN net_quantity != quantity THEN 1 ELSE 0 END) as inconsistent_items
FROM inventory;