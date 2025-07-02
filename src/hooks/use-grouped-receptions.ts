
import { useMemo } from 'react';

interface ReceptionItem {
  id: string;
  entry_number: number;
  receipt_date: string;
  name: string;
  quantity: number;
  gross_quantity: number;
  net_quantity: number;
  unit: string;
  document_number: string;
  lot_number: string;
  suppliers?: { name: string };
  manufacturers?: { name: string };
  crate_types?: { name: string; weight: number };
  products?: { name: string; cod_produs: string };
  crate_count: number;
}

type GroupingMode = 'none' | 'product' | 'article' | 'lot';

export const useGroupedReceptions = (
  receptions: ReceptionItem[],
  groupBy: GroupingMode
) => {
  const groupedData = useMemo(() => {
    if (groupBy === 'none') {
      return receptions;
    }

    const groups: { [key: string]: ReceptionItem[] } = {};

    receptions.forEach(item => {
      let groupKey = '';
      
      switch (groupBy) {
        case 'product':
          groupKey = item.name;
          break;
        case 'article':
          groupKey = item.products?.cod_produs || 'Fără cod';
          break;
        case 'lot':
          groupKey = item.lot_number || 'Fără lot';
          break;
        default:
          groupKey = 'Toate';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    // Convert to flat array with group headers
    const result: ReceptionItem[] = [];
    Object.entries(groups).forEach(([groupName, items]) => {
      // Add a virtual group header item
      const totalNetQuantity = items.reduce((sum, item) => sum + (item.net_quantity || item.quantity), 0);
      const groupHeader: ReceptionItem = {
        id: `group-${groupName}`,
        entry_number: 0,
        receipt_date: '',
        name: `${groupName} (${items.length} intrări, ${totalNetQuantity.toFixed(2)} ${items[0]?.unit || ''})`,
        quantity: totalNetQuantity,
        gross_quantity: 0,
        net_quantity: totalNetQuantity,
        unit: items[0]?.unit || '',
        document_number: '',
        lot_number: '',
        crate_count: 0,
        isGroupHeader: true
      } as ReceptionItem & { isGroupHeader: boolean };
      
      result.push(groupHeader);
      result.push(...items);
    });

    return result;
  }, [receptions, groupBy]);

  return groupedData;
};
