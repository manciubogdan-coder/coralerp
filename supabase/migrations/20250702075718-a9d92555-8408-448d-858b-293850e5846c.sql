
-- Adaugă coloana cod_produs în tabela products
ALTER TABLE public.products 
ADD COLUMN cod_produs TEXT;

-- Adaugă un index pentru performanță
CREATE INDEX idx_products_cod_produs ON public.products(cod_produs);
