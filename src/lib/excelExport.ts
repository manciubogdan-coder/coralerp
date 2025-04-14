
import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[]) => {
  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Create a workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  
  // Generate Excel file
  XLSX.writeFile(workbook, "inventory.xlsx");
};
