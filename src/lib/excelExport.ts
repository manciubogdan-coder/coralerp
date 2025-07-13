
import * as XLSX from 'xlsx';

interface ExcelExportOptions {
  reportTitle?: string;
  date?: string;
  filters?: string;
  additionalInfo?: string;
}

export const exportToExcel = (
  data: any[], 
  filename: string = "raport.xlsx", 
  options?: ExcelExportOptions
) => {
  // Formatează numerele să folosească virgula în loc de punct
  const formatNumber = (value: any): any => {
    if (typeof value === 'number') {
      return value.toString().replace('.', ',');
    }
    if (typeof value === 'string' && !isNaN(parseFloat(value))) {
      return parseFloat(value).toString().replace('.', ',');
    }
    return value;
  };

  // Procesează datele pentru a formata numerele
  const formattedData = data.map(row => {
    const formattedRow: any = {};
    Object.keys(row).forEach(key => {
      formattedRow[key] = formatNumber(row[key]);
    });
    return formattedRow;
  });

  // Creează headerul cu informații despre raport
  const headerData: any[] = [];
  
  if (options?.reportTitle) {
    headerData.push({ '': `RAPORT: ${options.reportTitle}` });
  }
  
  if (options?.date) {
    headerData.push({ '': `DATA: ${options.date}` });
  }
  
  if (options?.filters) {
    headerData.push({ '': `FILTRE: ${options.filters}` });
  }
  
  if (options?.additionalInfo) {
    headerData.push({ '': `INFO: ${options.additionalInfo}` });
  }
  
  headerData.push({ '': `GENERAT LA: ${new Date().toLocaleString('ro-RO')}` });
  headerData.push({ '': '' }); // Linie goală

  // Combină headerul cu datele
  const allData = [...headerData, ...formattedData];

  // Convertește datele în worksheet
  const worksheet = XLSX.utils.json_to_sheet(allData);
  
  // Setează lățimea coloanelor automat
  const cols = [];
  if (formattedData.length > 0) {
    Object.keys(formattedData[0]).forEach(key => {
      const maxLength = Math.max(
        key.length,
        ...formattedData.map(row => String(row[key] || '').length)
      );
      cols.push({ wch: Math.min(maxLength + 2, 50) });
    });
    worksheet['!cols'] = cols;
  }

  // Creează workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Raport");
  
  // Generează fișierul Excel
  XLSX.writeFile(workbook, filename);
};
