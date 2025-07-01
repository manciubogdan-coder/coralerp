
import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], filename: string = "inventory.xlsx") => {
  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Create a workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  
  // Generate Excel file with custom filename
  XLSX.writeFile(workbook, filename);
};
