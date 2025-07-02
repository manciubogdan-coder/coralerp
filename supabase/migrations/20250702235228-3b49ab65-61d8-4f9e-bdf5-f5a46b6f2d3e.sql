-- Corectez toate net_quantity negative prin recalcularea corectă
-- Pentru articolele unde net_quantity < 0, ajustez crate_count să nu depășească quantity/crate_weight

UPDATE inventory 
SET 
  crate_count = CASE 
    WHEN crate_type_id IS NOT NULL AND quantity > 0 THEN
      FLOOR(quantity / (SELECT weight FROM crate_types WHERE id = inventory.crate_type_id))
    ELSE 0
  END,
  crate_weight = CASE 
    WHEN crate_type_id IS NOT NULL AND quantity > 0 THEN
      FLOOR(quantity / (SELECT weight FROM crate_types WHERE id = inventory.crate_type_id)) * 
      (SELECT weight FROM crate_types WHERE id = inventory.crate_type_id)
    ELSE 0
  END
WHERE net_quantity < 0;

-- Recalculez net_quantity pentru toate înregistrările afectate
UPDATE inventory 
SET net_quantity = quantity - COALESCE(crate_weight, 0)
WHERE net_quantity < 0;