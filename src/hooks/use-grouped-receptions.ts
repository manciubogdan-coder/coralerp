
import { useMemo } from 'react';

interface ReceptionItem {
  id: string;
  entry_number: number;
  receipt_date: string;
  name: string;
  quantity: number;
  unit: string;
  document_number: string;
  lot_number: string;
  suppliers?: { name: string };
  manufacturers?: { name: string };
  products?: { name: string; cod_produs: string };
}

type GroupingMode = 'none' | 'product' | 'supplier' | 'lot';

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
        case 'supplier':
          groupKey = item.suppliers?.name || 'Fără furnizor';
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
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const groupHeader: ReceptionItem = {
        id: `group-${groupName}`,
        entry_number: 0,
        receipt_date: '',
        name: `${groupName} (${items.length} intrări, ${totalQuantity.toFixed(2)} ${items[0]?.unit || ''})`,
        quantity: totalQuantity,
        unit: items[0]?.unit || '',
        document_number: '',
        lot_number: '',
        isGroupHeader: true
      } as ReceptionItem & { isGroupHeader: boolean };
      
      result.push(groupHeader);
      result.push(...items);
    });

    return result;
  }, [receptions, groupBy]);

  return groupedData;
};
