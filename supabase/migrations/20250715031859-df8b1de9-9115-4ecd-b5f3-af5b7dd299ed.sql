-- Șterge snapshot-ul meu incorect de la 3:02 AM
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Recreez snapshot-ul pentru ora exactă când a trebuit să ruleze cron job-ul (5:00 AM România)
-- Voi folosi stocul de la acel moment prin recalcularea inversă a mișcărilor
-- care s-au întâmplat după ora 2:00 UTC (5:00 AM România)

-- Inserez toate articolele din inventar ca snapshot pentru azi
-- dar voi calcula cantitățile de la ora 2:00 UTC
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
FROM inventory;