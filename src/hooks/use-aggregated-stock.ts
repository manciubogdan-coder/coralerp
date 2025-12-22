
import { useState, useMemo } from 'react';
import { InventoryItem } from '@/types';

interface AggregatedStock extends InventoryItem {
  total_pallets?: number;
  total_crates?: number;
  items?: InventoryItem[];
}

export const useAggregatedStock = (inventory: InventoryItem[]) => {
  const [groupBy, setGroupBy] = useState<'product' | 'supplier' | 'manufacturer' | 'lot'>('product');

  const aggregatedData = useMemo(() => {
    const grouped = new Map<string, AggregatedStock>();

    const normalizeKey = (value: string) => value.trim().toLowerCase();
    // IMPORTANT: use item.name (the name stored in inventory table) NOT products.name
    // because sometimes product_id points to a different product name than item.name
    const getProductName = (item: InventoryItem) => item.name;
    const getSupplierName = (item: InventoryItem) => item.suppliers?.name ?? item.supplier ?? 'Unknown';
    const getManufacturerName = (item: InventoryItem) => item.manufacturers?.name ?? item.manufacturer ?? 'Unknown';

    inventory.forEach((item) => {
      let key: string;
      let displayName: string;

      if (groupBy === 'product') {
        displayName = getProductName(item);
        // IMPORTANT: group by product NAME (not product_id) so Ambalaje stays in sync with the “Stoc Produse” view
        key = `product:${normalizeKey(displayName)}`;
      } else if (groupBy === 'supplier') {
        displayName = getSupplierName(item);
        key = `supplier:${normalizeKey(displayName)}`;
      } else if (groupBy === 'manufacturer') {
        displayName = getManufacturerName(item);
        key = `manufacturer:${normalizeKey(displayName)}`;
      } else {
        // Group by lot: product + lot number
        const productName = getProductName(item);
        const lot = item.lot_number ?? 'No_Lot';
        displayName = `${productName} (Lot: ${lot || 'N/A'})`;
        key = `lot:${normalizeKey(productName)}-${normalizeKey(lot)}`;
      }

      if (!grouped.has(key)) {
        // Create base group with first item's data but reset quantities
        grouped.set(key, {
          ...item,
          name: displayName,
          quantity: 0,
          total_pallets: 0,
          total_crates: 0,
          items: [],
          isHeader: true,
        });
      }

      const group = grouped.get(key)!;
      const itemQuantity = item.quantity || 0;

      // If the group was created from an item without product_id/supplier_id/etc,
      // but we later find one with the IDs filled, keep them for code lookups in UI.
      if (groupBy === 'product') {
        if (!group.product_id && item.product_id) group.product_id = item.product_id;
        if (!group.products && item.products) group.products = item.products;
      }
      if (groupBy === 'supplier') {
        if (!group.supplier_id && item.supplier_id) group.supplier_id = item.supplier_id;
        if (!group.suppliers && item.suppliers) group.suppliers = item.suppliers;
      }
      if (groupBy === 'manufacturer') {
        if (!group.manufacturer_id && item.manufacturer_id) group.manufacturer_id = item.manufacturer_id;
        if (!group.manufacturers && item.manufacturers) group.manufacturers = item.manufacturers;
      }

      // Aggregate quantities
      group.quantity = (group.quantity || 0) + itemQuantity;
      group.total_pallets = (group.total_pallets || 0) + 1;
      group.total_crates = (group.total_crates || 0) + 0; // No crate_count anymore
      group.items?.push(item);
    });

    return Array.from(grouped.values());
  }, [inventory, groupBy]);

  return {
    aggregatedData,
    groupBy,
    setGroupBy
  };
};
