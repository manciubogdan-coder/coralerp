-- Dezactivez temporar trigger-ele care recalculează cantitățile
ALTER TABLE public.inventory DISABLE TRIGGER calculate_net_quantity_trigger;
ALTER TABLE public.inventory DISABLE TRIGGER calculate_quantities_trigger;

-- Acum actualizez cantitățile manual pentru produsele problematice
-- Mizuna red - complet transferat
UPDATE inventory SET net_quantity = 0 WHERE id = '58fbc134-98eb-47bc-a7cb-7ec45a3fd082';

-- Mizuna green - transferat 20.5 din 37, rămân 16.5  
UPDATE inventory SET net_quantity = 16.5 WHERE id = 'f4f7de6a-cefd-44cf-84f2-ef82808067d3';

-- Baby Spanac (entry 192) - transferat complet
UPDATE inventory SET net_quantity = 0 WHERE id = '5ccf538d-0daa-4b64-b039-3a48751312d0';

-- Busuioc (entry 194) - transferat 330.7 din 353.7, rămân 23
UPDATE inventory SET net_quantity = 23 WHERE id = '9f7e081f-992a-4d58-b592-4c50a3393498';

-- Busuioc (entry 222) - transferat complet  
UPDATE inventory SET net_quantity = 0 WHERE id = '43f65872-9f27-4161-be47-a6f84d51c1be';

-- Reactive trigger-ele
ALTER TABLE public.inventory ENABLE TRIGGER calculate_net_quantity_trigger;
ALTER TABLE public.inventory ENABLE TRIGGER calculate_quantities_trigger;