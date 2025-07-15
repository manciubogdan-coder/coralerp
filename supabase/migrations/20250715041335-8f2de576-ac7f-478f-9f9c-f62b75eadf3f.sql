-- Șterg snapshot-ul de azi
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Inserez grupat doar după nume de produs (ca în interfață)
INSERT INTO daily_stock_snapshots (
    snapshot_date, name, quantity, net_quantity, unit
)
SELECT 
    CURRENT_DATE as snapshot_date,
    name, 
    SUM(quantity) as quantity, 
    SUM(net_quantity) as net_quantity, 
    MAX(unit) as unit
FROM inventory
GROUP BY name;