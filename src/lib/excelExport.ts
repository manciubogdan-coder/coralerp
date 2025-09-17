
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
  console.log('exportToExcel called with data length:', data.length);
  console.log('Sample data:', data.slice(0, 2));
  
  if (!data || data.length === 0) {
    console.error('No data provided to exportToExcel');
    return;
  }
  
  // Procesează datele - păstrează doar formatarea necesară pentru afișare
  const processedData = data.map(row => {
    const processedRow: any = {};
    Object.keys(row).forEach(key => {
      const value = row[key];
      
      // Păstrează valorile exact cum sunt afișate în aplicație
      if (value === null || value === undefined) {
        processedRow[key] = '';
      } else if (typeof value === 'number') {
        // Pentru numerele care reprezintă cantități, păstrează 2 decimale
        if (key.toLowerCase().includes('cantitate') || key.toLowerCase().includes('cant')) {
          processedRow[key] = Math.round(value * 100) / 100;
        } else {
          processedRow[key] = value;
        }
      } else {
        processedRow[key] = value;
      }
    });
    return processedRow;
  });

  console.log('Processed data length:', processedData.length);

  // Creează headerul cu informații despre raport (fără timestamp automat)
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
          // Formatează numerele cu 2 zecimale (rămân numere, nu text)
          cell.z = '0.00';
          cell.t = 'n';
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
