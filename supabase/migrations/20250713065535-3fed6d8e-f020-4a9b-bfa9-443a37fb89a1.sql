-- Verifică și extinde limitarea pentru câmpul destination în tabelele de transfer
-- Pentru tabelul principal de transferuri
ALTER TABLE public.stock_transfers 
ALTER COLUMN destination TYPE TEXT;

-- Pentru tabelul de transferuri ambalaje  
ALTER TABLE public.ambalaje_stock_transfers 
ALTER COLUMN destination TYPE TEXT;

-- Verifică și extinde și alte câmpuri care ar putea avea limitări prea stricte
-- Pentru tabelul de transfer items
ALTER TABLE public.stock_transfer_items 
ALTER COLUMN unit TYPE TEXT;

-- Pentru tabelul de transfer items ambalaje
ALTER TABLE public.ambalaje_stock_transfer_items 
ALTER COLUMN unit TYPE TEXT;