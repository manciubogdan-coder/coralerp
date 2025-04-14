
import * as XLSX from 'xlsx';
import { InventoryItem } from '@/types';

interface ExportItem {
  Nume: string;
  Cantitate: number;
  Unitate: string;
  [key: string]: string | number; // Allow additional properties
}

/**
 * Export inventory data to Excel
 * Can handle both InventoryItem[] and pre-formatted export data
 */
export const exportToExcel = (inventory: InventoryItem[] | Record<string, any>[]) => {
  let exportData: Record<string, any>[];
  
  // Check if the data is already formatted for export
  if (inventory.length > 0 && 'Nume' in inventory[0]) {
    // Data is already formatted for export
    exportData = inventory as Record<string, any>[];
  } else {
    // Data needs formatting - aggregate inventory by product name
    const aggregatedInventory = (inventory as InventoryItem[]).reduce<Record<string, ExportItem>>((acc, item) => {
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
    exportData = Object.values(aggregatedInventory)
      .filter(item => item.Cantitate > 0)
      .map(item => ({
        ...item,
        Cantitate: Number(item.Cantitate.toFixed(2))
      }));
  }
  
  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  // Create a workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  
  // Generate Excel file
  XLSX.writeFile(workbook, "inventory.xlsx");
};
