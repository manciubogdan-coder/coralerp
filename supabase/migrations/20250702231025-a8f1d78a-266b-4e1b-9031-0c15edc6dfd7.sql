-- Fix pentru regenerarea snapshot-urilor corecte
-- Șterge snapshot-urile vechi pentru azi și regenerează-le corect
DELETE FROM daily_stock_snapshots WHERE snapshot_date = '2025-07-03';

-- Inserează snapshot-ul corect pentru azi bazat pe stocul curent real
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
    '2025-07-03'::date as snapshot_date,
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