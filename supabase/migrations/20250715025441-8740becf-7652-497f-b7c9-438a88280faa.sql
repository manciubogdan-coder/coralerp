-- Actualizez referințele în stock_transfer_items înainte de a șterge duplicatele

-- Pentru Radichio rosso lot 2805 - actualizez referințele să pointeze la înregistrarea păstrată
UPDATE stock_transfer_items 
SET inventory_item_id = '0c22514d-f826-4aad-92fa-514e4b7b2f08'
WHERE inventory_item_id IN ('c1ad097a-d4a8-488c-b698-d4640b79b83d', '449c2816-35f4-43ee-9513-878249400109');

-- Pentru Indivia riccia lot 2901 - actualizez referințele să pointeze la înregistrarea păstrată  
UPDATE stock_transfer_items 
SET inventory_item_id = '44336ed8-7432-44ce-84d7-ce942086f45f'
WHERE inventory_item_id IN ('865870d6-1650-4e26-bb7d-4c81401b88c0', '720aa3e2-902c-45b1-a6f7-322019505437');

-- Pentru Pan di Zuchero lot 2807 - actualizez referințele să pointeze la înregistrarea păstrată
UPDATE stock_transfer_items 
SET inventory_item_id = 'bc7b78a2-2e3c-4419-8157-d53ca532c712'
WHERE inventory_item_id = 'ac5034ec-bc28-40a2-9db0-1bdbcdb166df';

-- Pentru Busuioc lot 2805 - actualizez referințele să pointeze la înregistrarea păstrată
UPDATE stock_transfer_items 
SET inventory_item_id = '75325868-8632-435c-9e64-26dee6eebf56'
WHERE inventory_item_id = '7afb10f6-f228-44b3-9220-f5d9d28ab503';