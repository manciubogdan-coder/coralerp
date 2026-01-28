import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface PurchaseOrderItem {
  product_code: string | null;
  product_name: string;
  quantity: number;
  unit: string;
  expected_delivery_date: Date | null;
}

interface PurchaseOrderData {
  supplier_name: string;
  items: PurchaseOrderItem[];
  order_date?: Date;
}

// Configurație firmă - Coral Biogreens
const COMPANY_INFO = {
  name: "SC Coral Biogreens SRL",
  cui: "RO22867705",
  terms: "Atenție a se livra la data specificată."
};

// Generează număr de comandă unic
const generateOrderNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CMD-${year}${month}${day}-${random}`;
};

export const exportPurchaseOrder = (data: PurchaseOrderData, inventoryType: string) => {
  const orderNumber = generateOrderNumber();
  const orderDate = data.order_date || new Date();
  
  // Calculăm data de livrare dorită (prima dată de livrare din items sau +7 zile)
  const deliveryDates = data.items
    .map(i => i.expected_delivery_date)
    .filter(Boolean) as Date[];
  
  const earliestDelivery = deliveryDates.length > 0 
    ? new Date(Math.min(...deliveryDates.map(d => d.getTime())))
    : new Date(orderDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Creăm workbook
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `Comandă Achiziție - ${data.supplier_name}`,
    Author: COMPANY_INFO.name,
    Company: COMPANY_INFO.name
  };

  // Construim datele pentru sheet
  const sheetData: any[][] = [];

  // Header - Titlu
  sheetData.push([]);
  sheetData.push(["", "", "COMANDĂ DE ACHIZIȚIE", "", "", ""]);
  sheetData.push([]);

  // Număr comandă și dată
  sheetData.push(["Nr. Comandă:", orderNumber, "", "Data:", format(orderDate, "dd.MM.yyyy")]);
  sheetData.push([]);

  // Informații cumpărător
  sheetData.push(["CUMPĂRĂTOR:"]);
  sheetData.push(["Denumire:", COMPANY_INFO.name]);
  sheetData.push(["CUI:", COMPANY_INFO.cui]);
  sheetData.push([]);

  // Informații furnizor
  sheetData.push(["FURNIZOR:"]);
  sheetData.push(["Denumire:", data.supplier_name]);
  sheetData.push([]);

  // Data livrare dorită
  sheetData.push(["DATA LIVRARE DORITĂ:", format(earliestDelivery, "dd.MM.yyyy")]);
  sheetData.push([]);

  // Separator
  sheetData.push([]);

  // Header tabel produse
  const tableHeaderRow = sheetData.length;
  sheetData.push(["Nr.", "Cod Produs", "Denumire Produs", "Cantitate", "U.M.", "Data Livrare"]);

  // Produse
  data.items.forEach((item, index) => {
    sheetData.push([
      index + 1,
      item.product_code || "-",
      item.product_name,
      item.quantity,
      item.unit,
      item.expected_delivery_date ? format(item.expected_delivery_date, "dd.MM.yyyy") : format(earliestDelivery, "dd.MM.yyyy")
    ]);
  });

  // Total produse
  const totalRow = sheetData.length;
  sheetData.push([]);
  sheetData.push(["", "", "TOTAL PRODUSE:", data.items.length, "", ""]);
  sheetData.push([]);

  // Termeni și condiții
  sheetData.push(["TERMENI ȘI CONDIȚII:"]);
  sheetData.push([COMPANY_INFO.terms]);
  sheetData.push([]);
  sheetData.push([]);

  // Semnături
  sheetData.push(["CUMPĂRĂTOR", "", "", "", "FURNIZOR", ""]);
  sheetData.push([]);
  sheetData.push(["Semnătură:", "_____________________", "", "", "Semnătură:", "_____________________"]);
  sheetData.push([]);
  sheetData.push(["Data:", "_____________________", "", "", "Data:", "_____________________"]);
  sheetData.push([]);
  sheetData.push(["Ștampila:", "", "", "", "Ștampila:", ""]);

  // Creăm sheet-ul
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Stilizare coloane
  ws['!cols'] = [
    { wch: 6 },   // Nr.
    { wch: 15 },  // Cod Produs
    { wch: 40 },  // Denumire Produs
    { wch: 12 },  // Cantitate
    { wch: 8 },   // U.M.
    { wch: 14 }   // Data Livrare
  ];

  // Merge cells pentru titlu
  ws['!merges'] = [
    { s: { r: 1, c: 2 }, e: { r: 1, c: 4 } }, // Titlu "COMANDĂ DE ACHIZIȚIE"
  ];

  // Asigură formatarea numerică pentru cantități
  const dataStartRow = tableHeaderRow + 1;
  const dataEndRow = totalRow - 1;
  
  for (let r = dataStartRow; r < dataEndRow; r++) {
    const cellAddr = XLSX.utils.encode_cell({ r, c: 3 }); // Coloana Cantitate
    if (ws[cellAddr] && typeof ws[cellAddr].v === 'number') {
      ws[cellAddr].t = 'n';
      ws[cellAddr].z = '#,##0';
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Comandă");

  // Generează numele fișierului
  const inventoryLabel = inventoryType === "materii-prime" ? "MP" 
    : inventoryType === "ambalaje" ? "AMB" : "ETI";
  
  const supplierClean = data.supplier_name.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Comanda_${supplierClean}_${inventoryLabel}_${format(orderDate, "yyyyMMdd")}.xlsx`;

  // Salvează fișierul
  XLSX.writeFile(wb, filename);

  return orderNumber;
};
