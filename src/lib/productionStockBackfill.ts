import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";

type InventoryType = "materii-prime" | "ambalaje" | "etichete";

type DateRange = { from?: Date; to?: Date };

type SyncArgs = {
  inventoryType: InventoryType;
  dateRange: DateRange;
};

const normalizeDestination = (destination: string) =>
  (destination ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isProductionDestination = (destination: string) =>
  normalizeDestination(destination) === "productie";

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function syncProductionStockFromTransfers({
  inventoryType,
  dateRange,
}: SyncArgs): Promise<{ inserted: number; scannedTransfers: number }>
{
  const transfersTable = inventoryType === "ambalaje" 
    ? "ambalaje_stock_transfers" 
    : inventoryType === "etichete"
      ? "etichete_stock_transfers"
      : "stock_transfers";
  const transferItemsTable = inventoryType === "ambalaje" 
    ? "ambalaje_stock_transfer_items" 
    : inventoryType === "etichete"
      ? "etichete_stock_transfer_items"
      : "stock_transfer_items";
  const productionStockTable = inventoryType === "ambalaje" 
    ? "ambalaje_production_stock" 
    : inventoryType === "etichete"
      ? "etichete_production_stock"
      : "production_stock";

  // 1) Identify transfers in the selected range that went to Production
  let transfersQuery = supabase
    .from(transfersTable)
    .select("id, destination, transfer_date");

  if (dateRange.from) {
    transfersQuery = transfersQuery.gte("transfer_date", format(dateRange.from, "yyyy-MM-dd"));
  }
  if (dateRange.to) {
    transfersQuery = transfersQuery.lte("transfer_date", format(dateRange.to, "yyyy-MM-dd"));
  }

  const { data: transfers, error: transfersError } = await transfersQuery;
  if (transfersError) throw transfersError;

  const productionTransferIds = (transfers || [])
    .filter((t: any) => isProductionDestination(t.destination))
    .map((t: any) => t.id);

  if (productionTransferIds.length === 0) {
    return { inserted: 0, scannedTransfers: 0 };
  }

  // 2) Fetch transfer items + inventory metadata for those transfers
  const { data: transferItems, error: itemsError } = await supabase
    .from(transferItemsTable)
    .select(
      `
        id,
        transfer_id,
        inventory_item_id,
        quantity,
        net_quantity,
        unit,
        inventory:inventory_item_id (
          id,
          name,
          product_id,
          supplier_id,
          manufacturer_id,
          lot_number,
          document_number,
          unit
        ),
        stock_transfers:transfer_id (
          transfer_date,
          destination
        )
      `
    )
    .in("transfer_id", productionTransferIds);

  if (itemsError) throw itemsError;

  const items = (transferItems || []).filter((it: any) =>
    isProductionDestination(it.stock_transfers?.destination || "")
  );

  if (items.length === 0) {
    return { inserted: 0, scannedTransfers: productionTransferIds.length };
  }

  // 3) Load existing production_stock rows to avoid duplicates
  const { data: existingRows, error: existingError } = await supabase
    .from(productionStockTable)
    .select("transfer_id, inventory_item_id")
    .in("transfer_id", productionTransferIds);

  if (existingError) throw existingError;

  const existingKeySet = new Set(
    (existingRows || []).map((r: any) => `${r.transfer_id}:${r.inventory_item_id}`)
  );

  const rowsToInsert = items
    .map((it: any) => {
      const inv = it.inventory;
      const transfer = it.stock_transfers;
      if (!inv?.id || !it.transfer_id || !transfer?.transfer_date) return null;

      const key = `${it.transfer_id}:${inv.id}`;
      if (existingKeySet.has(key)) return null;

      const qty = typeof it.net_quantity === "number" ? it.net_quantity : it.quantity;
      return {
        inventory_item_id: inv.id,
        transfer_id: it.transfer_id,
        product_id: inv.product_id,
        supplier_id: inv.supplier_id,
        manufacturer_id: inv.manufacturer_id,
        name: inv.name,
        quantity: qty,
        unit: it.unit || inv.unit,
        lot_number: inv.lot_number,
        document_number: inv.document_number,
        // `transfer_date` in production_stock is timestamptz; Postgres will cast date -> timestamp
        transfer_date: transfer.transfer_date,
      };
    })
    .filter(Boolean) as any[];

  if (rowsToInsert.length === 0) {
    return { inserted: 0, scannedTransfers: productionTransferIds.length };
  }

  // 4) Insert in chunks
  let inserted = 0;
  for (const batch of chunk(rowsToInsert, 100)) {
    const { error: insertError } = await supabase.from(productionStockTable).insert(batch);
    if (insertError) throw insertError;
    inserted += batch.length;
  }

  return { inserted, scannedTransfers: productionTransferIds.length };
}
