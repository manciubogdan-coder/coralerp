-- Șterge snapshot-ul de azi care are probleme
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Regenerează snapshot-ul corect pentru azi bazat pe stocul curent
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
    crate_count,
    crate_weight,
    gross_quantity,
    entry_number,
    document_number,
    receipt_date
)
SELECT 
    CURRENT_DATE as snapshot_date,
    name,
    lot_number,
    quantity,
    net_quantity,
    unit,
    product_id,
    supplier_id,
    manufacturer_id,
    crate_type_id,
    crate_count,
    crate_weight,
    gross_quantity,
    entry_number,
    document_number,
    receipt_date
FROM inventory
WHERE quantity > 0 OR net_quantity > 0;