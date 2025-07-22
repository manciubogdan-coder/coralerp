-- Corectează numele incorect pentru Baby Spanac în daily_stock_snapshots
-- Product ID ece6cc4c-8c60-4c14-bd22-beede5bca6ef aparține la "Bulls Blod" nu "Baby Spanac"
UPDATE daily_stock_snapshots 
SET name = 'Bulls Blod' 
WHERE product_id = 'ece6cc4c-8c60-4c14-bd22-beede5bca6ef' 
AND name = 'Baby Spanac';