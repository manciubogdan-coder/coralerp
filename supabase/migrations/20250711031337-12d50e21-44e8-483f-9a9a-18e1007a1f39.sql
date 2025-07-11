-- Recreez funcția calculate_quantities să fie mai inteligentă
CREATE OR REPLACE FUNCTION public.calculate_quantities()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Setăm gross_quantity să fie egală cu quantity doar pentru inserturi noi
  -- sau când alte câmpuri se modifică, nu doar quantity
  IF TG_OP = 'INSERT' OR 
     (TG_OP = 'UPDATE' AND (
       OLD.crate_type_id IS DISTINCT FROM NEW.crate_type_id OR
       OLD.crate_count IS DISTINCT FROM NEW.crate_count OR
       OLD.crate_weight IS DISTINCT FROM NEW.crate_weight
     )) THEN
    
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
  END IF;

  RETURN NEW;
END;
$function$;

-- Reactiv triggerul pentru ambalaje_inventory cu UPDATE
CREATE TRIGGER calculate_ambalaje_inventory_quantities
  BEFORE INSERT OR UPDATE ON ambalaje_inventory
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quantities();