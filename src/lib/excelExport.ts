
import { InventoryItem } from "@/types";
import { utils, writeFile } from "xlsx";

export function exportToExcel(inventory: InventoryItem[]) {
  const formattedData = inventory.map(item => ({
    'Produs': item.name,
    'Cantitate': item.quantity,
    'Unitate': item.unit,
    'Ultima actualizare': item.updated_at 
      ? new Date(item.updated_at.seconds * 1000).toLocaleString('ro-RO') 
      : 'N/A'
  }));
  
  const worksheet = utils.json_to_sheet(formattedData);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Stoc");
  
  // Set column widths
  const colWidths = [
    { wch: 30 }, // Produs
    { wch: 10 }, // Cantitate
    { wch: 10 }, // Unitate
    { wch: 20 }, // Data
  ];
  
  worksheet['!cols'] = colWidths;
  
  // Generate filename with current date
  const date = new Date();
  const dateStr = date.toLocaleDateString('ro-RO').replace(/\//g, '-');
  const filename = `Stoc_Coral_Bio_Greens_${dateStr}.xlsx`;
  
  writeFile(workbook, filename);
}
