-- Corectare trigger să nu se aplice la recepții, doar la scăderi din stoc
-- Creăm un flag pentru a diferenția între recepții și scăderi

CREATE OR REPLACE FUNCTION public.calculate_quantities()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- La INSERT (recepție nouă), doar setăm gross_quantity = quantity
  -- și calculăm net_quantity fără a modifica quantity
  IF TG_OP = 'INSERT' THEN
    -- Păstrăm quantity ca fiind gross_quantity la recepție
    NEW.gross_quantity := NEW.quantity;
    
    -- Calculăm net_quantity = quantity - greutatea lăzilor - greutatea paletului
    IF NEW.crate_type_id IS NOT NULL AND NEW.crate_count > 0 THEN
      SELECT NEW.quantity - (ct.weight * NEW.crate_count) - COALESCE(NEW.crate_weight, 0)
      INTO NEW.net_quantity
      FROM public.crate_types ct 
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
  
  -- La UPDATE (scădere din stoc), recalculăm tot
  IF TG_OP = 'UPDATE' THEN
    -- Dacă quantity = 0, resetez toate valorile
    IF NEW.quantity = 0 THEN
      NEW.crate_count := 0;
      NEW.crate_weight := 0;
      NEW.net_quantity := 0;
      NEW.gross_quantity := 0;
    ELSE
      -- Păstrăm gross_quantity dacă nu e setat
      IF NEW.gross_quantity IS NULL THEN
        NEW.gross_quantity := NEW.quantity;
      END IF;
      
      -- Recalculăm net_quantity în funcție de proporția rămasă
      IF OLD.quantity > 0 AND NEW.quantity != OLD.quantity THEN
        -- Calculăm proporția rămasă din stoc
        declare
          remaining_ratio NUMERIC;
        begin
          remaining_ratio := NEW.quantity::NUMERIC / OLD.quantity::NUMERIC;
          
          -- Ajustăm și net_quantity proporțional
          NEW.net_quantity := GREATEST(0, OLD.net_quantity * remaining_ratio);
        end;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Același trigger pentru ambalaje
CREATE OR REPLACE FUNCTION public.calculate_quantities_ambalaje()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- La INSERT (recepție nouă), doar setăm gross_quantity = quantity
  IF TG_OP = 'INSERT' THEN
    NEW.gross_quantity := NEW.quantity;
    
    -- Calculăm net_quantity pentru ambalaje
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
    
    NEW.net_quantity := GREATEST(NEW.net_quantity, 0);
  END IF;
  
  -- La UPDATE, recalculăm proporțional
  IF TG_OP = 'UPDATE' THEN
    IF NEW.quantity = 0 THEN
      NEW.crate_count := 0;
      NEW.crate_weight := 0;
      NEW.net_quantity := 0;
      NEW.gross_quantity := 0;
    ELSE
      IF NEW.gross_quantity IS NULL THEN
        NEW.gross_quantity := NEW.quantity;
      END IF;
      
      IF OLD.quantity > 0 AND NEW.quantity != OLD.quantity THEN
        declare
          remaining_ratio NUMERIC;
        begin
          remaining_ratio := NEW.quantity::NUMERIC / OLD.quantity::NUMERIC;
          NEW.net_quantity := GREATEST(0, OLD.net_quantity * remaining_ratio);
        end;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;