-- Fixes pentru stocuri, calculele și trigger-uri

-- 1. Fix trigger calculate_quantities să folosească corect greutatea lăzilor
CREATE OR REPLACE FUNCTION public.calculate_quantities()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Setăm gross_quantity să fie egală cu quantity doar la INSERT
  IF TG_OP = 'INSERT' THEN
    NEW.gross_quantity := NEW.quantity;
  END IF;

  -- Dacă quantity = 0, resetez toate valorile
  IF NEW.quantity = 0 THEN
    NEW.crate_count := 0;
    NEW.crate_weight := 0;
    NEW.net_quantity := 0;
  ELSE
    -- Calculăm net_quantity = quantity - greutatea lăzilor - greutatea paletului
    IF NEW.crate_type_id IS NOT NULL AND NEW.crate_count > 0 THEN
      -- Obținem greutatea unei lăzi și o înmulțim cu numărul de lăzi
      SELECT NEW.quantity - (ct.weight * NEW.crate_count) - COALESCE(NEW.crate_weight, 0)
      INTO NEW.net_quantity
      FROM public.crate_types ct 
      WHERE ct.id = NEW.crate_type_id;
      
      -- Verificăm dacă am găsit crate_type
      IF NEW.net_quantity IS NULL THEN
        NEW.net_quantity := NEW.quantity - COALESCE(NEW.crate_weight, 0);
      END IF;
    ELSE
      NEW.net_quantity := NEW.quantity - COALESCE(NEW.crate_weight, 0);
    END IF;
    
    -- Asigurăm că net_quantity nu devine negativă
    NEW.net_quantity := GREATEST(NEW.net_quantity, 0);
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Asigurăm că trigger-ul este pe toate tabelele relevante
DROP TRIGGER IF EXISTS calculate_quantities_trigger ON inventory;
DROP TRIGGER IF EXISTS calculate_quantities_trigger ON ambalaje_inventory;

CREATE TRIGGER calculate_quantities_trigger
  BEFORE INSERT OR UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quantities();

CREATE TRIGGER calculate_quantities_trigger_ambalaje
  BEFORE INSERT OR UPDATE ON ambalaje_inventory
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quantities();

-- 3. Creăm trigger pentru ambalaje_crate_types să folosească același sistem
DROP TRIGGER IF EXISTS calculate_quantities_trigger_ambalaje_crate ON ambalaje_inventory;

CREATE OR REPLACE FUNCTION public.calculate_quantities_ambalaje()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Pentru ambalaje folosim același sistem
  IF TG_OP = 'INSERT' THEN
    NEW.gross_quantity := NEW.quantity;
  END IF;

  -- Dacă quantity = 0, resetez toate valorile
  IF NEW.quantity = 0 THEN
    NEW.crate_count := 0;
    NEW.crate_weight := 0;
    NEW.net_quantity := 0;
  ELSE
    -- Pentru ambalaje calculăm net_quantity = quantity - greutatea lăzilor - greutatea paletului
    IF NEW.crate_type_id IS NOT NULL AND NEW.crate_count > 0 THEN
      SELECT NEW.quantity - (ct.weight * NEW.crate_count) - COALESCE(NEW.crate_weight, 0)
      INTO NEW.net_quantity
      FROM public.ambalaje_crate_types ct 
      WHERE ct.id = NEW.crate_type_id;
      
      IF NEW.net_quantity IS NULL THEN
        NEW.net_quantity := NEW.quantity - COALESCE(NEW.crate_weight, 0);
      END IF;
    ELSE
      NEW.net_quantity := NEW.quantity - COALESCE(NEW.crate_weight, 0);
    END IF;
    
    -- Asigurăm că net_quantity nu devine negativă
    NEW.net_quantity := GREATEST(NEW.net_quantity, 0);
  END IF;

  RETURN NEW;
END;
$function$;

-- Aplicăm trigger-ul specific pentru ambalaje
DROP TRIGGER IF EXISTS calculate_quantities_trigger_ambalaje ON ambalaje_inventory;
CREATE TRIGGER calculate_quantities_trigger_ambalaje
  BEFORE INSERT OR UPDATE ON ambalaje_inventory
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quantities_ambalaje();