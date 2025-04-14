
import { InventoryItem } from "@/types";
import { utils, writeFile } from "xlsx";

export function exportToExcel(inventory: InventoryItem[]) {
  const formattedData = inventory.map(item => ({
    'Produs': item.name,
    'Cantitate': item.quantity,
    'Unitate': item.unit,
    'Ultima actualizare': formatTimestamp(item.updated_at)
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

// Helper function to format timestamp consistently
function formatTimestamp(timestamp: string | { seconds: number; nanoseconds: number; } | undefined): string {
  if (!timestamp) return 'N/A';
  
  if (typeof timestamp === 'string') {
    return new Date(timestamp).toLocaleString('ro-RO');
  }
  
  if (timestamp && 'seconds' in timestamp) {
    return new Date(timestamp.seconds * 1000).toLocaleString('ro-RO');
  }
  
  return 'N/A';
}
