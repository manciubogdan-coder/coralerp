-- Șterg snapshot-ul de azi
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Recreez snapshot-ul SIMPLU - doar cu cantitatea principală (quantity)
INSERT INTO daily_stock_snapshots (
    snapshot_date, 
    name, 
    quantity, 
    unit
)
SELECT 
    CURRENT_DATE as snapshot_date,
    name, 
    SUM(quantity) as quantity, 
    MAX(unit) as unit
FROM inventory
GROUP BY name;