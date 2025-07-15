-- Consolideză duplicatele din inventory
-- Păstrez doar prima înregistrare și sumez cantitățile

-- Pentru Indivia riccia lot 2901 (3 duplicate)
UPDATE inventory 
SET quantity = (
  SELECT SUM(quantity) 
  FROM inventory 
  WHERE name = 'Indivia riccia' AND lot_number = '2901'
)
WHERE id = '44336ed8-7432-44ce-84d7-ce942086f45f';

-- Șterg duplicatele pentru Indivia riccia
DELETE FROM inventory 
WHERE name = 'Indivia riccia' AND lot_number = '2901' 
AND id IN ('865870d6-1650-4e26-bb7d-4c81401b88c0', '720aa3e2-902c-45b1-a6f7-322019505437');

-- Pentru Radichio rosso lot 2805 (3 duplicate)
UPDATE inventory 
SET quantity = (
  SELECT SUM(quantity) 
  FROM inventory 
  WHERE name = 'Radichio rosso' AND lot_number = '2805'
)
WHERE id = '0c22514d-f826-4aad-92fa-514e4b7b2f08';

-- Șterg duplicatele pentru Radichio rosso
DELETE FROM inventory 
WHERE name = 'Radichio rosso' AND lot_number = '2805' 
AND id IN ('c1ad097a-d4a8-488c-b698-d4640b79b83d', '449c2816-35f4-43ee-9513-878249400109');

-- Pentru Pan di Zuchero lot 2807 (2 duplicate)
UPDATE inventory 
SET quantity = (
  SELECT SUM(quantity) 
  FROM inventory 
  WHERE name = 'Pan di Zuchero' AND lot_number = '2807'
)
WHERE id = 'bc7b78a2-2e3c-4419-8157-d53ca532c712';

-- Șterg duplicatul pentru Pan di Zuchero
DELETE FROM inventory 
WHERE name = 'Pan di Zuchero' AND lot_number = '2807' 
AND id = 'ac5034ec-bc28-40a2-9db0-1bdbcdb166df';

-- Pentru Busuioc lot 2805 (2 duplicate)
UPDATE inventory 
SET quantity = (
  SELECT SUM(quantity) 
  FROM inventory 
  WHERE name = 'Busuioc' AND lot_number = '2805'
)
WHERE id = '75325868-8632-435c-9e64-26dee6eebf56';

-- Șterg duplicatul pentru Busuioc
DELETE FROM inventory 
WHERE name = 'Busuioc' AND lot_number = '2805' 
AND id = '7afb10f6-f228-44b3-9220-f5d9d28ab503';