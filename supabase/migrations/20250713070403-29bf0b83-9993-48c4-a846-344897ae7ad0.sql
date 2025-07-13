-- Înlocuiesc triggerele cu noile funcții pentru a păstra valorile originale de recepție

-- Pentru tabelul principal de inventar
DROP TRIGGER IF EXISTS calculate_inventory_quantities ON public.inventory;
CREATE TRIGGER calculate_inventory_quantities_reception_only
    BEFORE INSERT OR UPDATE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION calculate_quantities_reception_only();

-- Pentru tabelul ambalaje  
DROP TRIGGER IF EXISTS calculate_ambalaje_inventory_quantities ON public.ambalaje_inventory;
DROP TRIGGER IF EXISTS calculate_quantities_trigger_ambalaje ON public.ambalaje_inventory;

CREATE TRIGGER calculate_ambalaje_inventory_quantities_reception_only
    BEFORE INSERT OR UPDATE ON public.ambalaje_inventory
    FOR EACH ROW EXECUTE FUNCTION calculate_quantities_ambalaje_reception_only();