-- Corectez logica pentru produsele cu cantitate 0
-- Când quantity = 0, resetez crate_count la 0 pentru a evita net_quantity negative

UPDATE inventory 
SET crate_count = 0, 
    crate_weight = 0,
    net_quantity = 0
WHERE quantity = 0;

-- Actualizez funcția calculate_quantities să gestioneze corect cazul când quantity = 0
CREATE OR REPLACE FUNCTION public.calculate_quantities()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Setăm gross_quantity să fie egală cu quantity
  NEW.gross_quantity := NEW.quantity;

  -- Dacă quantity = 0, resetez toate valorile
  IF NEW.quantity = 0 THEN
    NEW.crate_count := 0;
    NEW.crate_weight := 0;
    NEW.net_quantity := 0;
  ELSE
    -- Calculăm net_quantity = quantity - greutatea lăzilor
    IF NEW.crate_type_id IS NOT NULL AND NEW.crate_count > 0 THEN
      SELECT NEW.quantity - (ct.weight * NEW.crate_count) 
      INTO NEW.net_quantity
      FROM public.crate_types ct 
      WHERE ct.id = NEW.crate_type_id;
    ELSE
      NEW.net_quantity := NEW.quantity;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;