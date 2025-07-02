-- Să încerc să forțez actualizarea prin alte mijloace
-- Dezactivez temporar orice trigger care ar putea recalcula net_quantity
-- și apoi actualizez direct

-- Mai întâi să verific cum arată datele înainte de actualizare
SELECT id, name, quantity, net_quantity FROM inventory 
WHERE id IN ('58fbc134-98eb-47bc-a7cb-7ec45a3fd082', 'f4f7de6a-cefd-44cf-84f2-ef82808067d3');

-- Apoi să fac actualizarea forțată
UPDATE inventory 
SET net_quantity = 0, updated_at = NOW()
WHERE id = '58fbc134-98eb-47bc-a7cb-7ec45a3fd082';

UPDATE inventory 
SET net_quantity = 16.5, quantity = 16.5, updated_at = NOW()
WHERE id = 'f4f7de6a-cefd-44cf-84f2-ef82808067d3';

-- Să verific din nou rezultatul
SELECT id, name, quantity, net_quantity FROM inventory 
WHERE id IN ('58fbc134-98eb-47bc-a7cb-7ec45a3fd082', 'f4f7de6a-cefd-44cf-84f2-ef82808067d3');