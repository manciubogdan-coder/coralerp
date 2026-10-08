import XLSXStyle from 'xlsx-js-style';
import { sheetTable, type OrderSheet, type SheetCell } from './orderSheets';

export function orderWorksheet(sheet: OrderSheet, delivery: string) {
  const table = sheetTable(sheet);
  const n = table.headers.length;
  const nrs = [...new Set(sheet.lines.map(l => l.nr_comanda).filter(Boolean))].join(', ');
  const aoa: (string | number)[][] = [[`COMANDA   ${sheet.title}`], [sheet.client], [`Data livrare: ${delivery}`], [`Comanda Nr. ${nrs}`], [], table.headers];
  table.rows.forEach(r => aoa.push(r.cells.map(c => c.value)));
  aoa.push([], ['TOTAL BAX'], ['TOTAL BUC']);
  if (table.pallets !== null) aoa.push(['Nr. Paleți']);
  sheet.notes.forEach(note => aoa.push([note]));
  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
  const merges = [0, 1, 2, 3].map(r => ({ s: { r, c: 0 }, e: { r, c: n - 1 } }));
  const col = (c: number, r: number) => XLSXStyle.utils.encode_cell({ c, r });
  const setFormula = (c: number, r: number, f: string, v: number) => { ws[col(c, r)] = { t: 'n', f, v, z: '0.##' }; };
  const finalRef = (cells: SheetCell[], original: number, modified: number, row: number) => `IF(${col(modified, row)}="",${col(original, row)},${col(modified, row)})`;
  table.rows.forEach((row, idx) => {
    const r = idx + 6;
    const perCase = col(table.headers.indexOf('Buc / Bax'), r);
    row.cells.forEach((cell, c) => {
      if (cell.rowSpan === 2) merges.push({ s: { r, c }, e: { r: r + 1, c } });
      if (cell.kind !== 'cases') return;
      if (table.headers[c] === 'Total BAX') {
        const refs = sheet.warehouses.map((_, i) => col(5 + i * 3, r));
        setFormula(c, r, `SUM(${refs.join(',')})`, Number(cell.value) || 0);
      } else {
        const original = sheet.pivot ? c + 1 : table.headers.indexOf('Nr. Bucăți');
        const modified = original + 1;
        const expr = (rr: number) => `IFERROR(ROUNDUP(${finalRef(row.cells, original, modified, rr)}/${col(table.headers.indexOf('Buc / Bax'), rr)},0),0)`;
        setFormula(c, r, cell.rowSpan === 2 ? `MAX(${expr(r)},${expr(r + 1)})` : expr(r), Number(cell.value) || 0);
      }
    });
    if (sheet.pivot) {
      const c = table.headers.indexOf('Total BUC');
      setFormula(c, r, sheet.warehouses.map((_, i) => finalRef(row.cells, 6 + i * 3, 7 + i * 3, r)).join('+'), Number(row.cells[c]?.value) || 0);
    }
  });
  const totalRow = 7 + table.rows.length;
  const caseCol = table.headers.indexOf(sheet.pivot ? 'Total BAX' : 'Nr. BAX');
  setFormula(caseCol, totalRow, `SUM(${col(caseCol, 6)}:${col(caseCol, 5 + table.rows.length)})`, table.totalCases);
  const unitCol = sheet.pivot ? table.headers.indexOf('Total BUC') : table.headers.indexOf('Nr. Bucăți');
  const unitFormula = sheet.pivot ? `SUM(${col(unitCol, 6)}:${col(unitCol, 5 + table.rows.length)})` : table.rows.map((r, i) => finalRef(r.cells, unitCol, unitCol + 1, i + 6)).join('+');
  setFormula(unitCol, totalRow + 1, unitFormula || '0', table.totalUnits);
  if (table.pallets !== null) {
    if (sheet.mixed) setFormula(caseCol, totalRow + 2, `${col(caseCol, totalRow)}/80`, table.pallets);
    else {
      const parts = table.rows.flatMap((r, i) => sheet.pivot ? sheet.warehouses.map((_, d) => `${col(5 + d * 3, i + 6)}/${r.line.gramaj === 500 ? 40 : 72}`) : [`${col(caseCol, i + 6)}/${r.line.gramaj === 500 ? 40 : 72}`]);
      setFormula(caseCol, totalRow + 2, parts.join('+') || '0', table.pallets);
    }
  }
  const notesStart = totalRow + (table.pallets === null ? 2 : 3);
  sheet.notes.forEach((_, i) => merges.push({ s: { r: notesStart + i, c: 0 }, e: { r: notesStart + i, c: n - 1 } }));
  ws['!merges'] = merges;
  ws['!cols'] = table.headers.map(h => ({ wch: h.includes('DENUMIRE') ? 34 : h.includes('terțiar') ? 32 : h.includes('primar') ? 23 : h.includes('comandă') ? 22 : h.includes('Depozit') ? 20 : h.includes('Modificată') ? 18 : 12 }));
  ws['!rows'] = aoa.map((_, r) => ({ hpt: r === 0 ? 30 : r === 5 ? 42 : r >= notesStart ? 32 : 25 }));
  const b = { style: 'thin', color: { rgb: 'B5B5B5' } };
  Object.keys(ws).filter(k => !k.startsWith('!')).forEach(k => {
    const { r, c } = XLSXStyle.utils.decode_cell(k);
    const role = table.rows[r - 6]?.cells[c]?.kind;
    const color = role === 'modified' || role === 'original' ? 'E2F0D9' : sheet.pivot && c >= 5 && c < 5 + sheet.warehouses.length * 3 ? ['DDEBF7', 'FFF2CC', 'FCE4EC'][Math.floor((c - 5) / 3) % 3] : 'FFFFFF';
    ws[k].s = { font: { name: 'Arial', sz: r === 0 ? 16 : 11, bold: r < 6 || r >= totalRow }, alignment: { wrapText: true, vertical: 'center', horizontal: typeof ws[k].v === 'number' ? 'right' : r === 0 ? 'center' : 'left' }, ...(r >= 5 && r < 6 + table.rows.length ? { border: { top: b, bottom: b, left: b, right: b }, fill: { fgColor: { rgb: r === 5 ? 'D9E1F2' : color } } } : {}) };
  });
  ws['!printHeader'] = [1, 6];
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