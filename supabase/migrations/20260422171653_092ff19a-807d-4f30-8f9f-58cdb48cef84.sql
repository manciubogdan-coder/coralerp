UPDATE public.inventory
SET quantity = 0
WHERE quantity <> 0
  AND abs(quantity) < 0.000001;

UPDATE public.ambalaje_inventory
SET quantity = 0
WHERE quantity <> 0
  AND abs(quantity) < 0.000001;

UPDATE public.etichete_inventory
SET quantity = 0
WHERE quantity <> 0
  AND abs(quantity) < 0.000001;