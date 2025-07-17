-- Șterg snapshot-ul de azi complet
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Recreez snapshot-ul folosind logica corectă de grupare după produs și lot
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
    SUM(quantity) as net_quantity,  -- Folosesc quantity pentru ambele pentru că net_quantity e incorectă
    MAX(unit) as unit,
    product_id,
    supplier_id,
    manufacturer_id,
    crate_type_id,
    MIN(entry_number) as entry_number,
    document_number,
    receipt_date
FROM inventory
WHERE quantity > 0  -- DOAR intrările cu stoc > 0
GROUP BY name, lot_number, product_id, supplier_id, manufacturer_id, crate_type_id, document_number, receipt_date;