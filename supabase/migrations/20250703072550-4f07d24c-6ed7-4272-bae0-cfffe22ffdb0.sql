-- Actualizez trigger-ul calculate_quantities să includă și crate_weight (greutatea paletului)
CREATE OR REPLACE FUNCTION public.calculate_quantities()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Setăm gross_quantity să fie egală cu quantity
  NEW.gross_quantity := NEW.quantity;

  -- Dacă quantity = 0, resetez toate valorile
  IF NEW.quantity = 0 THEN
    NEW.crate_count := 0;
    NEW.crate_weight := 0;
    NEW.net_quantity := 0;
  ELSE
    -- Calculăm net_quantity = quantity - greutatea lăzilor - greutatea paletului
    IF NEW.crate_type_id IS NOT NULL AND NEW.crate_count > 0 THEN
      SELECT NEW.quantity - (ct.weight * NEW.crate_count) - COALESCE(NEW.crate_weight, 0)
      INTO NEW.net_quantity
      FROM public.crate_types ct 
      WHERE ct.id = NEW.crate_type_id;
    ELSE
      NEW.net_quantity := NEW.quantity - COALESCE(NEW.crate_weight, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;