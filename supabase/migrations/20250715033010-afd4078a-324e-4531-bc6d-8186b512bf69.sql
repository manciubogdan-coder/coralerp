-- Șterg snapshot-ul incorect
DELETE FROM daily_stock_snapshots WHERE snapshot_date = CURRENT_DATE;

-- Calculez stocul de la ora 2:00 UTC (5:00 AM România) de azi
-- prin scăderea mișcărilor care s-au întâmplat după

-- Creez un view temporar cu stocul ajustat
WITH stock_at_5am AS (
  SELECT 
    i.*,
    -- Pentru fiecare articol, scad transferurile care s-au făcut după ora 2:00 UTC azi
    CASE 
      WHEN i.name = 'Coriandru' AND i.lot_number = '2807' THEN i.quantity - 4.8
      WHEN i.name = 'Radichio rosso' AND i.lot_number = '2804' THEN i.quantity - 90
      ELSE i.quantity
    END as adjusted_quantity,
    CASE 
      WHEN i.name = 'Coriandru' AND i.lot_number = '2807' THEN COALESCE(i.net_quantity, 0) - 4.8
      WHEN i.name = 'Radichio rosso' AND i.lot_number = '2804' THEN COALESCE(i.net_quantity, 0) - 90
      ELSE COALESCE(i.net_quantity, i.quantity)
    END as adjusted_net_quantity
  FROM inventory i
)
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
    GREATEST(0, adjusted_quantity) as quantity,
    GREATEST(0, adjusted_net_quantity) as net_quantity,
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
FROM stock_at_5am;