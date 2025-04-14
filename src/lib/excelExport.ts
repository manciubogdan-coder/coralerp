
import * as XLSX from 'xlsx';
import { InventoryItem } from '@/types';

interface ExportItem {
  Nume: string;
  Cantitate: number;
  Unitate: string;
}

export const exportToExcel = (inventory: InventoryItem[]) => {
  // Aggregate inventory by product name
  const aggregatedInventory = inventory.reduce<Record<string, ExportItem>>((acc, item) => {
    const productName = item.name;
    if (!acc[productName]) {
      acc[productName] = {
        Nume: productName,
        Cantitate: 0,
        Unitate: item.unit
      };
    }
    acc[productName].Cantitate += item.quantity;
    return acc;
  }, {});

  // Convert to array and filter out zero quantity items
  const exportData = Object.values(aggregatedInventory)
    .filter(item => item.Cantitate > 0)
    .map(item => ({
      ...item,
      Cantitate: Number(item.Cantitate.toFixed(2))
    }));
  
  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  // Create a workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  
  // Generate Excel file
  XLSX.writeFile(workbook, "inventory.xlsx");
};
