-- Creez trigger pentru a insera automat în reception_records când se adaugă în inventory
CREATE OR REPLACE FUNCTION sync_to_reception_records()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserez doar la INSERT în tabelul de inventar și doar dacă receipt_date nu este NULL
  IF TG_OP = 'INSERT' AND NEW.receipt_date IS NOT NULL THEN
    INSERT INTO reception_records (
      id, entry_number, receipt_date, name, original_quantity, 
      gross_quantity, net_quantity, unit, crate_count, crate_weight, 
      crate_type_id, document_number, lot_number, supplier_id, 
      product_id, manufacturer_id, supplier_name, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.entry_number, NEW.receipt_date, NEW.name, NEW.quantity,
      NEW.gross_quantity, NEW.net_quantity, NEW.unit, NEW.crate_count, 
      NEW.crate_weight, NEW.crate_type_id, NEW.document_number, 
      NEW.lot_number, NEW.supplier_id, NEW.product_id, NEW.manufacturer_id, 
      NEW.supplier_name, NEW.created_at, NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Creez trigger pentru tabelul inventory
CREATE TRIGGER sync_inventory_to_reception_records
  AFTER INSERT ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION sync_to_reception_records();

-- Creez trigger pentru ambalaje_inventory  
CREATE OR REPLACE FUNCTION sync_to_ambalaje_reception_records()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.receipt_date IS NOT NULL THEN
    INSERT INTO ambalaje_reception_records (
      id, entry_number, receipt_date, name, original_quantity, 
      gross_quantity, net_quantity, unit, crate_count, crate_weight, 
      crate_type_id, document_number, lot_number, supplier_id, 
      product_id, manufacturer_id, supplier_name, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.entry_number, NEW.receipt_date, NEW.name, NEW.quantity,
      NEW.gross_quantity, NEW.net_quantity, NEW.unit, NEW.crate_count, 
      NEW.crate_weight, NEW.crate_type_id, NEW.document_number, 
      NEW.lot_number, NEW.supplier_id, NEW.product_id, NEW.manufacturer_id, 
      NEW.supplier_name, NEW.created_at, NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_ambalaje_inventory_to_reception_records
  AFTER INSERT ON ambalaje_inventory
  FOR EACH ROW
  EXECUTE FUNCTION sync_to_ambalaje_reception_records();

-- Inserez manual înregistrarea "test" care lipsește din reception_records
INSERT INTO reception_records (
  id, entry_number, receipt_date, name, original_quantity, 
  gross_quantity, net_quantity, unit, crate_count, crate_weight, 
  crate_type_id, document_number, lot_number, supplier_id, 
  product_id, manufacturer_id, supplier_name, created_at, updated_at
)
SELECT 
  id, entry_number, receipt_date, name, quantity as original_quantity,
  gross_quantity, net_quantity, unit, crate_count, crate_weight,
  crate_type_id, document_number, lot_number, supplier_id,
  product_id, manufacturer_id, supplier_name, created_at, updated_at
FROM inventory 
WHERE entry_number = 937
ON CONFLICT (id) DO NOTHING;