-- Să încerc să corectez manual câteva item-uri problematice
-- Mizuna red - complet transferat
UPDATE inventory SET net_quantity = 0 WHERE id = '58fbc134-98eb-47bc-a7cb-7ec45a3fd082';

-- Mizuna green - transferat parțial
UPDATE inventory SET net_quantity = 16.5 WHERE id = 'f4f7de6a-cefd-44cf-84f2-ef82808067d3';

-- Baby Spanac (entry 192) - transferat complet
UPDATE inventory SET net_quantity = 0 WHERE id = '5ccf538d-0daa-4b64-b039-3a48751312d0';

-- Busuioc (entry 194) - transferat parțial, ar trebui să rămână aprox 23 kg (353.7 - 330.7)
UPDATE inventory SET net_quantity = 23 WHERE id = '9f7e081f-992a-4d58-b592-4c50a3393498';

-- Să forțez cache refresh prin updated_at
UPDATE inventory SET updated_at = NOW() 
WHERE id IN ('58fbc134-98eb-47bc-a7cb-7ec45a3fd082', 'f4f7de6a-cefd-44cf-84f2-ef82808067d3', 
             '5ccf538d-0daa-4b64-b039-3a48751312d0', '9f7e081f-992a-4d58-b592-4c50a3393498');