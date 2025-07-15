-- Șterg snapshot-ul de azi complet
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Recreez snapshot-ul grupând produsele exact ca în interfața de stoc curent
-- (doar după nume, nu după nume + lot)
INSERT INTO daily_stock_snapshots (
    snapshot_date, 
    name, 
    quantity, 
    net_quantity, 
    unit
)
SELECT 
    CURRENT_DATE as snapshot_date,
    name, 
    SUM(quantity) as quantity, 
    SUM(net_quantity) as net_quantity, 
    MAX(unit) as unit
FROM inventory
GROUP BY name;