-- Actualizez constraint-ul pentru a permite valori de transfer
-- Primul, șterg constraint-ul vechi
ALTER TABLE public.inventory_history 
DROP CONSTRAINT IF EXISTS inventory_history_action_check;

-- Adaug constraint-ul nou cu valorile pentru transferuri
ALTER TABLE public.inventory_history 
ADD CONSTRAINT inventory_history_action_check 
CHECK (action IN ('add', 'remove', 'set', 'transfer', 'transfer_out', 'transfer_in', 'reception', 'consumption', 'adjustment'));

-- Pentru tabelul ambalaje (dacă nu există deja constraint, îl adaug)
ALTER TABLE public.ambalaje_inventory_history 
DROP CONSTRAINT IF EXISTS ambalaje_inventory_history_action_check;

ALTER TABLE public.ambalaje_inventory_history 
ADD CONSTRAINT ambalaje_inventory_history_action_check 
CHECK (action IN ('add', 'remove', 'set', 'transfer', 'transfer_out', 'transfer_in', 'reception', 'consumption', 'adjustment'));