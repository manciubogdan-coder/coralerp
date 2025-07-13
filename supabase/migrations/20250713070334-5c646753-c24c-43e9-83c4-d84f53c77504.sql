-- Înlocuiesc funcțiile cu versiuni care nu modifică valorile originale de recepție

-- Funcție nouă pentru inventar principal
CREATE OR REPLACE FUNCTION public.calculate_quantities_reception_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- La INSERT (recepție nouă), calculez cantitățile
  IF TG_OP = 'INSERT' THEN
    -- Setez gross_quantity = quantity la recepție
    NEW.gross_quantity := NEW.quantity;
    
    -- Calculez net_quantity scăzând greutatea lăzilor și paletului
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
    
    -- Asigur că net_quantity nu devine negativă
    NEW.net_quantity := GREATEST(NEW.net_quantity, 0);
  END IF;
  
  -- La UPDATE, NU recalculez valorile originale de recepție
  -- Doar resetez la zero dacă cantitatea este zero
  IF TG_OP = 'UPDATE' THEN
    IF NEW.quantity = 0 THEN
      -- Nu modific valorile originale, doar cantitatea curentă
      -- gross_quantity, crate_count, crate_weight rămân ca la recepție
      NEW.net_quantity := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Funcție nouă pentru inventar ambalaje
CREATE OR REPLACE FUNCTION public.calculate_quantities_ambalaje_reception_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- La INSERT (recepție nouă), calculez cantitățile
  IF TG_OP = 'INSERT' THEN
    NEW.gross_quantity := NEW.quantity;
    
    -- Calculez net_quantity pentru ambalaje
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
  
  -- La UPDATE, NU recalculez valorile originale
  IF TG_OP = 'UPDATE' THEN
    IF NEW.quantity = 0 THEN
      NEW.net_quantity := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;