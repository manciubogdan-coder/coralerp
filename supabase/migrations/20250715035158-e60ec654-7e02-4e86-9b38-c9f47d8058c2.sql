-- Șterg snapshot-ul de azi pentru a-l recrea corect grupând intrările duplicate
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Inserez stocul curent grupat (sumez cantitățile pentru același produs și lot)
INSERT INTO daily_stock_snapshots (
    snapshot_date, name, lot_number, quantity, net_quantity, unit,
    product_id, supplier_id, manufacturer_id, crate_type_id,
    crate_count, crate_weight, gross_quantity, entry_number,
    document_number, receipt_date
)
SELECT 
    CURRENT_DATE as snapshot_date,
    name, 
    lot_number, 
    SUM(quantity) as quantity, 
    SUM(net_quantity) as net_quantity, 
    unit,
    product_id, 
    supplier_id, 
    manufacturer_id, 
    crate_type_id,
    SUM(crate_count) as crate_count, 
    SUM(crate_weight) as crate_weight, 
    SUM(gross_quantity) as gross_quantity, 
    MIN(entry_number) as entry_number,
    document_number, 
    receipt_date
FROM inventory
GROUP BY name, lot_number, unit, product_id, supplier_id, manufacturer_id, crate_type_id, document_number, receipt_date;