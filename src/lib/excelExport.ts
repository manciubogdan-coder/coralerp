
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
  // Funcție pentru a converti valori în numere dacă este posibil
  const processValue = (value: any): any => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    // Verifică dacă este un număr sau string care poate fi convertit în număr
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      // Înlocuiește virgula cu punct pentru parsing
      const normalizedValue = value.replace(',', '.');
      const numericValue = parseFloat(normalizedValue);
      
      // Dacă poate fi convertit în număr și nu este NaN
      if (!isNaN(numericValue) && isFinite(numericValue)) {
        return numericValue;
      }
    }
    
    return value;
  };

  // Procesează datele pentru a converti numerele
  const processedData = data.map(row => {
    const processedRow: any = {};
    Object.keys(row).forEach(key => {
      processedRow[key] = processValue(row[key]);
    });
    return processedRow;
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

  // Combină headerul cu datele
  const allData = [...headerData, ...processedData];

  // Convertește datele în worksheet
  const worksheet = XLSX.utils.json_to_sheet(allData);
  
  // Găsește celulele cu numere și setează formatul pentru regiunea România
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  for (let R = headerData.length; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
      const cell = worksheet[cellAddress];
      
      if (cell && typeof cell.v === 'number') {
        // Setează formatul pentru numere cu punct ca separator zecimal (ca în aplicație)
        cell.z = '0.00';
        cell.t = 'n'; // Specifică că este număr
      }
    }
  }
  
  // Setează lățimea coloanelor automat
  const cols = [];
  if (processedData.length > 0) {
    Object.keys(processedData[0]).forEach(key => {
      const maxLength = Math.max(
        key.length,
        ...processedData.map(row => String(row[key] || '').length)
      );
      cols.push({ wch: Math.min(maxLength + 2, 50) });
    });
    worksheet['!cols'] = cols;
  }

  // Creează workbook cu setări locale pentru România
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    ...workbook.Props,
    Application: "Sistem Inventar",
    Company: "Coral Biogreens"
  };
  
  XLSX.utils.book_append_sheet(workbook, worksheet, "Raport");
  
  // Generează fișierul Excel
  XLSX.writeFile(workbook, filename);
};
