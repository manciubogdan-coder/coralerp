-- Șterg tot snapshot-ul de azi
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Inserez doar o înregistrare per produs+lot, grupând toate cantitățile
INSERT INTO daily_stock_snapshots (
    snapshot_date, name, lot_number, quantity, net_quantity, unit
)
SELECT 
    CURRENT_DATE as snapshot_date,
    name, 
    lot_number, 
    SUM(quantity) as quantity, 
    SUM(net_quantity) as net_quantity, 
    MAX(unit) as unit
FROM inventory
GROUP BY name, lot_number;