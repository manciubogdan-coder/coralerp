-- Eliminăm trigger-ul și funcția conflictuală
DROP TRIGGER IF EXISTS calculate_net_quantity_trigger ON inventory;
DROP FUNCTION IF EXISTS public.calculate_net_quantity();

-- Păstrez doar funcția calculate_quantities cu logică corectă
CREATE OR REPLACE FUNCTION public.calculate_quantities()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Setăm gross_quantity să fie egală cu quantity (cantitatea brută introdusă)
  NEW.gross_quantity := NEW.quantity;

  -- Calculăm net_quantity = quantity - greutatea lăzilor
  IF NEW.crate_type_id IS NOT NULL AND NEW.crate_count > 0 THEN
    SELECT NEW.quantity - (ct.weight * NEW.crate_count) 
    INTO NEW.net_quantity
    FROM public.crate_types ct 
    WHERE ct.id = NEW.crate_type_id;
  ELSE
    NEW.net_quantity := NEW.quantity;
  END IF;

  RETURN NEW;
END;
$$;

-- Corectez toate înregistrările existente cu logica corectă
UPDATE inventory SET gross_quantity = quantity;

-- Recalculez net_quantity pentru toate înregistrările cu lăzi
UPDATE inventory 
SET net_quantity = quantity - COALESCE((
  SELECT ct.weight * inventory.crate_count
  FROM crate_types ct 
  WHERE ct.id = inventory.crate_type_id
), 0)
WHERE crate_type_id IS NOT NULL AND crate_count > 0;

-- Pentru înregistrările fără lăzi, net_quantity = quantity
UPDATE inventory 
SET net_quantity = quantity 
WHERE crate_type_id IS NULL OR crate_count = 0;