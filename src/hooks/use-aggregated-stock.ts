
import { useState, useMemo } from 'react';
import { InventoryItem } from '@/types';

interface AggregatedStock extends InventoryItem {
  total_pallets?: number;
  total_crates?: number;
  items?: InventoryItem[];
}

export const useAggregatedStock = (inventory: InventoryItem[]) => {
  const [groupBy, setGroupBy] = useState<'product' | 'supplier' | 'manufacturer'>('product');

  const aggregatedData = useMemo(() => {
    const grouped = new Map<string, AggregatedStock>();

    inventory.forEach(item => {
      let key: string;
      
      if (groupBy === 'product') {
        key = `${item.product_id || item.name}`;
      } else if (groupBy === 'supplier') {
        key = `${item.supplier_id || item.supplier || 'Unknown'}`;
      } else {
        key = `${item.manufacturer_id || item.manufacturer || 'Unknown'}`;
      }

      if (!grouped.has(key)) {
        // Create base group with first item's data but reset quantities
        grouped.set(key, {
          ...item,
          quantity: 0,
          net_quantity: 0,
          total_pallets: 0,
          total_crates: 0,
          items: [],
          isHeader: true
        });
      }

      const group = grouped.get(key)!;
      // Use net_quantity with fallback to quantity, same as other parts of the app
      const itemQuantity = item.net_quantity || item.quantity || 0;
      
      // Aggregate quantities correctly
      group.quantity = (group.quantity || 0) + itemQuantity;
      group.net_quantity = (group.net_quantity || 0) + itemQuantity;
      group.total_pallets = (group.total_pallets || 0) + 1;
      group.total_crates = (group.total_crates || 0) + (item.crate_count || 0);
      group.items?.push(item);
      
      // Update the group name to use the product name from relations if available
      if (groupBy === 'product' && item.products?.name) {
        group.name = item.products.name;
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
