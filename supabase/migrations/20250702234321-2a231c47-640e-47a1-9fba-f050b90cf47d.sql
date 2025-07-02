-- Corectez logica inconsistentă între funcții
-- Șterge funcția conflictuală calculate_net_quantity
DROP FUNCTION IF EXISTS public.calculate_net_quantity();

-- Actualizez funcția calculate_quantities pentru logică consistentă
CREATE OR REPLACE FUNCTION public.calculate_quantities()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Setăm gross_quantity să fie egală cu quantity
  NEW.gross_quantity := NEW.quantity;

  -- Calculăm net_quantity bazat pe quantity și greutățile lăzilor
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

-- Corectez toate înregistrările existente
UPDATE inventory 
SET gross_quantity = quantity;

-- Recalculez net_quantity pentru toate înregistrările cu lăzi
UPDATE inventory 
SET net_quantity = quantity - (
  SELECT COALESCE(ct.weight * inventory.crate_count, 0)
  FROM crate_types ct 
  WHERE ct.id = inventory.crate_type_id
)
WHERE crate_type_id IS NOT NULL AND crate_count > 0;

-- Pentru înregistrările fără lăzi, net_quantity = quantity
UPDATE inventory 
SET net_quantity = quantity 
WHERE crate_type_id IS NULL OR crate_count = 0;