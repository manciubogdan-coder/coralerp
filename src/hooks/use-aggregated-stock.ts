
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

    inventory.forEach(item => {
      let key: string;
      
      if (groupBy === 'product') {
        key = `${item.product_id || item.name}`;
      } else if (groupBy === 'supplier') {
        key = `${item.supplier_id || item.supplier || 'Unknown'}`;
      } else if (groupBy === 'manufacturer') {
        key = `${item.manufacturer_id || item.manufacturer || 'Unknown'}`;
      } else {
        // Group by lot: product + lot number
        key = `${item.product_id || item.name}-${item.lot_number || 'No_Lot'}`;
      }

      if (!grouped.has(key)) {
        // Create base group with first item's data but reset quantities
        grouped.set(key, {
          ...item,
          quantity: 0,
          total_pallets: 0,
          total_crates: 0,
          items: [],
          isHeader: true
        });
      }

      const group = grouped.get(key)!;
      // Use quantity (net quantity is now the only quantity stored)
      const itemQuantity = item.quantity || 0;
      
      // Debug pentru cantități mari
      if (item.name && (item.name.toLowerCase().includes('rucola') || Math.abs(itemQuantity) > 1000)) {
        console.log(`AGREGARE DEBUG - ${item.name}:`, {
          currentItem: {
            id: item.id,
            quantity: itemQuantity,
            receipt_date: item.receipt_date,
            lot_number: item.lot_number,
            entry_number: item.entry_number
          },
          currentGroupQuantity: group.quantity,
          newTotal: (group.quantity || 0) + itemQuantity
        });
      }
      
      // Aggregate quantities correctly
      group.quantity = (group.quantity || 0) + itemQuantity;
      group.total_pallets = (group.total_pallets || 0) + 1;
      group.total_crates = (group.total_crates || 0) + 0; // No crate_count anymore
      group.items?.push(item);
      
      // Update the group name to use the product name from relations if available
      if (groupBy === 'product' && item.products?.name) {
        group.name = item.products.name;
      } else if (groupBy === 'lot' && item.products?.name) {
        group.name = `${item.products.name} (Lot: ${item.lot_number || 'N/A'})`;
      }
    });

    return Array.from(grouped.values());
  }, [inventory, groupBy]);

  return {
    aggregatedData,
    groupBy,
    setGroupBy
  };
};
