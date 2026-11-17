// Excel export of the planned trucks: one sheet per truck, quantities as numbers, pallets as formulas.
import XLSX from 'xlsx-js-style';
import { isoWeekday } from './truckRadar';
import type { TruckLine } from './truckBuilder';

const WD = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
const label = (d: string) => `${WD[isoWeekday(d) - 1]} ${d.slice(8, 10)}.${d.slice(5, 7)}`;

export interface TruckSheet { day: string; covers: string; deadline: string; lines: TruckLine[]; noNorm: string[]; edited: boolean }

const border = { top: { style: 'thin', color: { rgb: 'BFBFBF' } }, bottom: { style: 'thin', color: { rgb: 'BFBFBF' } },
  left: { style: 'thin', color: { rgb: 'BFBFBF' } }, right: { style: 'thin', color: { rgb: 'BFBFBF' } } };
const font = { name: 'Arial', sz: 10 };

export function truckSheet(t: TruckSheet) {
  const head = ['Produs', 'Tip', 'Pentru producția din', 'Comandat deja (kg)', 'De comandat (kg)', 'Total (kg)', 'kg/palet', 'Paleți'];
  const aoa: any[][] = [
    [`Camion ${label(t.day)} · pentru ${t.covers}`],
    [`Comanda se poate modifica până pe ${label(t.deadline)}${t.edited ? ' · modificat manual' : ''}`],
    [],
    head,
  ];
  const first = aoa.length + 1;
  t.lines.forEach((l, i) => {
    const r = first + i;
    aoa.push([l.name, l.sturdy ? 'Rezistent' : 'Perisabil', l.dues.map(label).join(', '), Math.round(l.ordered), Math.round(l.toOrder),
      { t: 'n', f: `D${r}+E${r}`, v: Math.round(l.ordered) + Math.round(l.toOrder) }, l.per,
      { t: 'n', f: `F${r}/G${r}`, v: (Math.round(l.ordered) + Math.round(l.toOrder)) / l.per }]);
  });
  const last = first + t.lines.length - 1;
  const sum = (c: string, v: number) => (t.lines.length ? { t: 'n', f: `SUM(${c}${first}:${c}${last})`, v } : 0);
  aoa.push(['TOTAL', '', '',
    sum('D', t.lines.reduce((s, l) => s + Math.round(l.ordered), 0)), sum('E', t.lines.reduce((s, l) => s + Math.round(l.toOrder), 0)),
    sum('F', t.lines.reduce((s, l) => s + Math.round(l.ordered) + Math.round(l.toOrder), 0)), '',
    sum('H', t.lines.reduce((s, l) => s + (Math.round(l.ordered) + Math.round(l.toOrder)) / l.per, 0))]);
  if (t.noNorm.length) { aoa.push([]); aoa.push([`Fără normă de palet (nu intră în paleți): ${t.noNorm.join(', ')}`]); }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const totalRow = first + t.lines.length - 1; // 0-based index of the TOTAL row
  Object.keys(ws).filter((k) => !k.startsWith('!')).forEach((k) => {
    const { r, c } = XLSX.utils.decode_cell(k);
    const cell = ws[k];
    if (r === 0) cell.s = { font: { ...font, bold: true, sz: 14 } };
    else if (r === 3) cell.s = { font: { ...font, bold: true }, fill: { fgColor: { rgb: 'D9E1F2' } }, border, alignment: { wrapText: true, vertical: 'center' } };
    else if (r >= 4 && r <= totalRow) {
      cell.s = { font: { ...font, bold: r === totalRow }, border, ...(r === totalRow ? { fill: { fgColor: { rgb: 'F2F2F2' } } } : {}) };
      if (c >= 3 && c <= 6) cell.z = '#,##0';
      if (c === 7) cell.z = '#,##0.0';
    } else cell.s = { font };
  });
  ws['!cols'] = [
    { wch: Math.max(18, ...t.lines.map((l) => l.name.length + 2)) }, { wch: 11 },
    { wch: Math.max(20, ...t.lines.map((l) => l.dues.length * 9)) }, { wch: 17 }, { wch: 16 }, { wch: 11 }, { wch: 9 }, { wch: 9 },
  ];
  ws['!rows'] = [{ hpt: 20 }, {}, {}, { hpt: 28 }];
  return ws;
}

export function exportTrucks(trucks: TruckSheet[], filename: string) {
  const wb = XLSX.utils.book_new();
  trucks.forEach((t) => XLSX.utils.book_append_sheet(wb, truckSheet(t), label(t.day)));
  XLSX.writeFile(wb, filename);
}
