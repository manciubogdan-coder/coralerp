-- Extinde limita pentru câmpul action în tabelele de istoric
ALTER TABLE public.inventory_history 
ALTER COLUMN action TYPE TEXT;

-- Verifică și pentru tabelul ambalaje
ALTER TABLE public.ambalaje_inventory_history 
ALTER COLUMN action TYPE TEXT;