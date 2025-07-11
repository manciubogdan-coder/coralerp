-- Modificăm triggerul pentru a nu calcula din nou net_quantity pentru transferuri
-- când nu este necesar

-- Dezactivez temporar triggerul pentru a putea face transferuri fără recalculări
DROP TRIGGER IF EXISTS calculate_ambalaje_inventory_quantities ON ambalaje_inventory;

-- Recreez triggerul să se execute doar la INSERT, nu la UPDATE de cantitate
CREATE TRIGGER calculate_ambalaje_inventory_quantities
  BEFORE INSERT ON ambalaje_inventory
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quantities();