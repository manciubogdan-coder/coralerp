import XLSXStyle from 'xlsx-js-style';
import { type OrderSheet } from './orderSheets';
import { orderDocument, referenceStyles } from './orderDocument';

export function orderWorksheet(sheet: OrderSheet, delivery: string) {
  const document = orderDocument(sheet, delivery);
  const ws = XLSXStyle.utils.aoa_to_sheet(document.rows.map(row => row.map(c => c.value)));
  document.rows.forEach((row, r) => row.forEach((cell, c) => {
    const address = XLSXStyle.utils.encode_cell({ r, c });
    ws[address] = { t: typeof cell.value === 'number' ? 'n' : 's', v: cell.value, s: referenceStyles[cell.style], ...(cell.formula ? { f: cell.formula } : {}), ...(typeof cell.value === 'number' ? { z: r > document.header && String(document.rows[r][0]?.value).includes('Paleți') ? '0.00' : '0.##' } : {}) };
  }));
  ws['!merges'] = document.merges;
  ws['!cols'] = document.excelWidths.map(width => ({ width }));
  ws['!rows'] = document.heights.map(hpt => ({ hpt }));
  ws['!printHeader'] = [1, document.header + 1];
  return ws;
}

export function orderWorkbook(sheets: OrderSheet[], delivery: string) {
  const wb = XLSXStyle.utils.book_new();
  const used = new Set<string>();
  sheets.forEach(sheet => {
    const base = sheet.title.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31);
    let name = base, i = 1;
    while (used.has(name)) { const suffix = ` ${++i}`; name = base.slice(0, 31 - suffix.length) + suffix; }
    used.add(name);
    XLSXStyle.utils.book_append_sheet(wb, orderWorksheet(sheet, delivery), name);
  });
  return wb;
}