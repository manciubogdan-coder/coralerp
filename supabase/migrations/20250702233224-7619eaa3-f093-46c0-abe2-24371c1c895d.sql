-- Actualizez direct net_quantity pentru item-urile specifice care încă au probleme
UPDATE inventory 
SET net_quantity = CASE 
  WHEN id = '58fbc134-98eb-47bc-a7cb-7ec45a3fd082' THEN 0  -- Mizuna red (5 kg transferat, rămân 0)
  WHEN id = 'f4f7de6a-cefd-44cf-84f2-ef82808067d3' THEN GREATEST(0, 37 - 20.5)  -- Mizuna green (20.5 kg transferat din 37)
  ELSE net_quantity
END
WHERE id IN ('58fbc134-98eb-47bc-a7cb-7ec45a3fd082', 'f4f7de6a-cefd-44cf-84f2-ef82808067d3');

-- De asemenea, să actualizez și quantity pentru Mizuna green să fie consistent
UPDATE inventory 
SET quantity = net_quantity
WHERE id = 'f4f7de6a-cefd-44cf-84f2-ef82808067d3';