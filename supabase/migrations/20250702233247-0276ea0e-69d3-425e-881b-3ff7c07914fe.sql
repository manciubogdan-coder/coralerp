-- Actualizare directă și simplă pentru net_quantity
UPDATE inventory 
SET net_quantity = 0 
WHERE id = '58fbc134-98eb-47bc-a7cb-7ec45a3fd082';  -- Mizuna red

UPDATE inventory 
SET net_quantity = 16.5, quantity = 16.5  
WHERE id = 'f4f7de6a-cefd-44cf-84f2-ef82808067d3';  -- Mizuna green (37 - 20.5 = 16.5)