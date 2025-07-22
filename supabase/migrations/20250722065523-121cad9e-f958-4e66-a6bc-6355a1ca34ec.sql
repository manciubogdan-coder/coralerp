-- Corectează numele pentru product_id ece6cc4c-8c60-4c14-bd22-beede5bca6ef să fie Baby Spanac
-- Stocul de 937 kg trebuie să aparțină la Baby Spanac, nu Bulls Blod
UPDATE daily_stock_snapshots 
SET name = 'Baby Spanac' 
WHERE product_id = 'ece6cc4c-8c60-4c14-bd22-beede5bca6ef' 
AND name = 'Bulls Blod';