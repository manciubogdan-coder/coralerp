
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
  
  // Coerciție numerică pentru coloanele de tip Cantitate (ex: "Cantitate", "Cantitate Netă", "Cant.")
  const range2 = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const numericCols2: number[] = [];

  const normalize = (s: any) =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  for (let C = range2.s.c; C <= range2.e.c; ++C) {
    const headerAddr2 = XLSX.utils.encode_cell({ c: C, r: 0 });
    const headerCell2 = worksheet[headerAddr2];
    const headerText2 = normalize(headerCell2?.v);
    if (headerText2.includes('cant')) {
      numericCols2.push(C);
    }
  }

  const startRow2 = 1 + headerData.length; // sari peste rândul de antet + rândurile de headerData
  for (let R = startRow2; R <= range2.e.r; ++R) {
    for (const C of numericCols2) {
      const addr2 = XLSX.utils.encode_cell({ c: C, r: R });
      const cell2 = worksheet[addr2];
      if (!cell2 || cell2.v === undefined || cell2.v === null || cell2.v === '') continue;

      let raw = String(cell2.v).replace(/\s/g, '');
      // Dacă format RO: 1.234,56 -> 1234.56
      if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(raw)) {
        raw = raw.replace(/\./g, '').replace(',', '.');
      } else {
        raw = raw.replace(',', '.');
      }

      const parsed = typeof cell2.v === 'number' ? cell2.v : parseFloat(raw);
      if (!isNaN(parsed)) {
        const num2 = Math.round(parsed * 100) / 100;
        cell2.v = num2;
        cell2.t = 'n';
        cell2.z = '0.00';
      }
    }
  }
  
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
