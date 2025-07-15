-- Șterg snapshot-ul de azi
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Recreez snapshot-ul cu loturi pentru funcția de consum zilnic
-- dar grupând pe intrări duplicate pentru același produs + lot
INSERT INTO daily_stock_snapshots (
    snapshot_date, 
    name, 
    lot_number,
    quantity, 
    net_quantity,
    unit,
    product_id,
    supplier_id,
    manufacturer_id,
    crate_type_id,
    entry_number,
    document_number,
    receipt_date
)
SELECT 
    CURRENT_DATE as snapshot_date,
    name, 
    lot_number,
    SUM(quantity) as quantity, 
    SUM(net_quantity) as net_quantity,
    MAX(unit) as unit,
    product_id,
    supplier_id,
    manufacturer_id,
    crate_type_id,
    MIN(entry_number) as entry_number,
    document_number,
    receipt_date
FROM inventory
GROUP BY name, lot_number, product_id, supplier_id, manufacturer_id, crate_type_id, document_number, receipt_date;