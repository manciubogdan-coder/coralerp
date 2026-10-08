import reference from './orderReference.json';
import { finalQty, normalize, type OrderLine, type OrderSheet } from './orderSheets';

export type DocumentCell = { value: string | number; style: number; formula?: string; lines?: OrderLine[]; field?: keyof OrderLine | 'final'; rowSpan?: number; colSpan?: number; hidden?: boolean };
type Range = { s: { r: number; c: number }; e: { r: number; c: number } };
type ReferenceTemplate = { name: string; rows: { v: string; s: number }[][]; header: number; products: { row: number; product: string; weight: number; warehouse?: string }[]; merges: Range[]; widths: number[]; excelWidths?: number[]; heights: number[]; landscape: boolean };
const templates = reference.templates as unknown as ReferenceTemplate[];
export const referenceStyles = reference.styles;
const clean = (v: string) => normalize(v).replace(/\b(SALATA|SALATE|MIX|FRESHFUL|BY)\b/g, '').replace(/\s+/g, ' ').trim();
const sameProduct = (a: string, b: string) => clean(a) === clean(b);
const warehouseName = (s: string) => normalize(s).replace(/DEPOZIT|PLATFORMA|ARICESTII|ARICESTI/g, s.includes('ARIC') ? 'ARICESTI' : '').trim();
export function selectReference(sheet: OrderSheet) {
  const client = normalize(sheet.client);
  const all = templates;
  if (client.includes('LIDL')) {
    if (!sheet.mixed) return all.find(t => t.name.includes('Mono')) || all[0];
    const codes: Record<string, string> = { ARICESTI: 'ARI', CHIAJNA: 'CHI', FUNDENI: 'FUN', ROMAN: 'ROM', IERNUT: 'IER', LUGOJ: 'LUG', BOGLAR: 'BOG', CRAIOVA: 'CRA' };
    const warehouse = normalize(sheet.lines[0]?.depozit);
    const code = Object.entries(codes).find(([name]) => warehouse.includes(name))?.[1];
    return all.find(t => t.name === `Salate Mixte ${code}`) || all.find(t => t.name.includes('Mixte')) || all[0];
  }
  if (client.includes('MEGA') || client.includes('PROFI')) {
    const profi = client.includes('PROFI') || sheet.lines.some(l => /MAMMAMIA|ARMONIA/.test(normalize(l.produs)));
    return all.find(t => t.name.includes(profi ? 'Image-Profi' : 'Stefanesti')) || all[0];
  }
  return all.find(t => normalize(t.name).includes(client.split(' ')[0])) || (client.includes('FRESHFUL') ? all.find(t => t.name.includes('EMAG')) : null) || all[0];
}
const ref = (r: number, c: number) => { let n = c + 1, name = ''; while (n > 0) { n--; name = String.fromCharCode(65 + n % 26) + name; n = Math.floor(n / 26); } return `${name}${r + 1}`; };

export function orderDocument(sheet: OrderSheet, delivery: string) {
  const template = selectReference(sheet);
  let header = template.header;
  let widths = [...template.widths];
  // Older template metadata only stored pixel widths; keep those templates usable.
  let excelWidths = widths.map((width, column) => {
    const original = Array.isArray(template.excelWidths) ? template.excelWidths[column] : undefined;
    return typeof original === 'number' && Number.isFinite(original) && original > 0
      ? original
      : Math.max(1, (width - 5) / 7);
  });
  let heights = [...template.heights];
  let rows: DocumentCell[][] = template.rows.map(row => row.map(c => ({ value: c.v, style: c.s })));
  let merges: Range[] = template.merges.map(m => ({ s: { ...m.s }, e: { ...m.e } }));
  let products = template.products.map(p => ({ ...p }));
  const titles = () => rows[header].map(c => normalize(c.value));
  let labels = titles();
  let productCol = labels.findIndex(v => v.includes('DENUMIRE'));
  const weightCol = labels.findIndex(v => v.includes('GRAMAJ'));
  const primaryCol = labels.findIndex(v => v.includes('AMBALAJ PRIMAR'));
  const tertiaryCol = labels.findIndex(v => v.includes('AMBALAJ TERTIAR'));
  const perCaseCol = labels.findIndex(v => v === 'BUC BAX');
  let warehouseCols = labels.map((v, i) => (v === 'BAX' || v === 'BUC' || v === 'BUCATI') && i >= 5 && i < tertiaryCol ? i : -1).filter(i => i >= 0);
  const pivot = warehouseCols.length >= 4;
  const firstWarehouse = warehouseCols[0] ?? -1;
  const slots = pivot ? warehouseCols.length / 2 : 0;
  const warehouseLabels = pivot ? Array.from({ length: slots }, (_, i) => String(rows[header - 1]?.[firstWarehouse + i * 2]?.value || '')) : [];
  const warehouses = [...new Set(sheet.lines.map(l => l.depozit || 'Fără depozit'))];
  const assigned: (string | null)[] = warehouseLabels.map(name => warehouses.find(w => warehouseName(w) === warehouseName(name) || (warehouseName(w).length > 2 && warehouseName(name).includes(warehouseName(w)))) || null);
  const remaining = warehouses.filter(w => !assigned.includes(w));
  assigned.forEach((w, i) => { if (!w && remaining.length) assigned[i] = remaining.shift() || null; });
  // Extend the original two-column warehouse blocks only when live orders need more slots.
  if (pivot && remaining.length) {
    const insert = firstWarehouse + slots * 2;
    const extra = remaining.length * 2;
    rows = rows.map((row, r) => [...row.slice(0, insert), ...remaining.flatMap(() => row.slice(firstWarehouse, firstWarehouse + 2).map(c => ({ ...c, value: r === header ? c.value : '' }))), ...row.slice(insert)]);
    widths.splice(insert, 0, ...remaining.flatMap(() => widths.slice(firstWarehouse, firstWarehouse + 2)));
    excelWidths.splice(insert, 0, ...remaining.flatMap(() => excelWidths.slice(firstWarehouse, firstWarehouse + 2)));
    merges = merges.map(m => ({ s: { r: m.s.r, c: m.s.c >= insert ? m.s.c + extra : m.s.c }, e: { r: m.e.r, c: m.e.c >= insert ? m.e.c + extra : m.e.c } }));
    remaining.forEach((w, i) => { assigned.push(w); merges.push({ s: { r: header - 1, c: insert + i * 2 }, e: { r: header - 1, c: insert + i * 2 + 1 } }); });
  }
  labels = titles(); productCol = labels.findIndex(v => v.includes('DENUMIRE'));
  const endCol = labels.findIndex(v => v.includes('AMBALAJ TERTIAR'));
  if (pivot) assigned.forEach((w, i) => { if (w) rows[header - 1][firstWarehouse + i * 2].value = w; });
  else if (sheet.mixed && rows[header - 1]?.[5]) rows[header - 1][5].value = warehouses.join(', ');
  const allNrs = [...new Set(sheet.lines.map(l => l.nr_comanda).filter(Boolean))].join(', ');
  const dateCol = template.name.includes('Mono') ? 9 : template.name.includes('Mixte') ? 6 : merges.find(m => m.s.r === 1 && m.e.c === template.widths.length - 1)?.s.c ?? Math.max(0, widths.length - 2);
  rows[1][dateCol].value = `Data livrare: ${delivery}${allNrs && template.name.includes('METRO') ? `\nComanda Nr. ${allNrs}` : ''}`;
  if (/Mono|Mixte|EMAG/.test(template.name)) rows[2][dateCol].value = `Nr. Comandă: ${allNrs}`;
  const used = new Set<string>();
  const candidates = products.map(p => ({ p, lines: sheet.lines.filter(l => !used.has(l.id) && l.gramaj === p.weight && sameProduct(l.produs, p.product) && (!p.warehouse || warehouseName(l.depozit || '') === warehouseName(p.warehouse))) }));
  candidates.forEach(({ lines }) => lines.forEach(l => used.add(l.id)));
  const unknown = sheet.lines.filter(l => !used.has(l.id));
  const extraGroups = [...new Set(unknown.map(l => `${normalize(l.produs)}|${l.gramaj}`))].map(k => unknown.filter(l => `${normalize(l.produs)}|${l.gramaj}` === k));
  let last = Math.max(...products.map(p => p.row));
  extraGroups.forEach(lines => {
    const first = lines[0]; if (!first) return;
    const at = last + 1;
    const row = rows[last].map(c => ({ ...c, value: '' }));
    rows.splice(at, 0, row); heights.splice(at, 0, heights[last]);
    merges = merges.map(m => ({ s: { ...m.s, r: m.s.r >= at ? m.s.r + 1 : m.s.r }, e: { ...m.e, r: m.e.r >= at ? m.e.r + 1 : m.e.r } }));
    const p = { row: at, product: first.produs, weight: first.gramaj || 0, warehouse: first.depozit || '' }; products.push(p); candidates.push({ p, lines }); last = at;
  });
  const casesRefs: string[] = [], unitRefs: string[] = [];
  const qty = (ls: OrderLine[]) => ls.reduce((s, l) => s + finalQty(l), 0);
  const cases = (ls: OrderLine[]) => ls.reduce((s, l) => s + (l.buc_bax ? Math.ceil(finalQty(l) / l.buc_bax) : 0), 0);
  const formula = (r: number, c: number, f: string, value: number) => { rows[r][c] = { ...rows[r][c], value, formula: f }; };
  let sequence = 0;
  candidates.forEach(({ p, lines }) => {
    const r = p.row, row = rows[r], first = lines[0];
    row[productCol].value = first?.produs || p.product;
    row[weightCol].value = first?.gramaj || p.weight;
    if (first) {
      row[productCol] = { ...row[productCol], lines, field: 'produs' };
      row[weightCol] = { ...row[weightCol], lines, field: 'gramaj' };
    }
    const nrCol = labels.findIndex(v => v.includes('NR COMANDA'));
    if (nrCol >= 0) row[nrCol].value = [...new Set(lines.map(l => l.nr_comanda).filter(Boolean))].join(', ');
    const indexMerge = merges.find(m => m.s.c === 0 && m.s.r <= r && m.e.r >= r && m.e.c === 0);
    if (template.name.includes('Image-Profi')) row[0].value = p.warehouse;
    else if (!indexMerge || indexMerge.s.r === r) row[0].value = ++sequence;
    if (first) {
      [[primaryCol, 'ambalaj_primar'], [endCol, 'ambalaj_tertiar'], [perCaseCol, 'buc_bax']].forEach(([c, field]) => {
        const col = Number(c), key = field as keyof OrderLine;
        if (col >= 0) row[col] = { ...row[col], value: first[key] ?? '', lines, field: key };
      });
    }
    const unitCell = (col: number, ls: OrderLine[], modified: number) => {
      row[col] = { ...row[col], value: ls.length ? ls.reduce((s, l) => s + l.bucati, 0) : '', lines: ls, field: modified >= 0 ? 'bucati' : 'final' };
      if (modified >= 0) row[modified] = { ...row[modified], value: ls.some(l => l.taiat !== 0) ? qty(ls) : '', lines: ls, field: 'final' };
      const result = modified >= 0 ? `IF(${ref(r, modified)}="",${ref(r, col)},${ref(r, modified)})` : ref(r, col);
      if (modified < 0 && ls.some(l => l.taiat !== 0)) row[col].value = qty(ls);
      return result;
    };
    if (pivot) {
      const caseParts: string[] = [], unitParts: string[] = [];
      assigned.forEach((w, i) => {
        const c = firstWarehouse + i * 2, caseC = labels[c] === 'BAX' ? c : c + 1, unitC = labels[c] === 'BAX' ? c + 1 : c;
        const ls = lines.filter(l => (l.depozit || 'Fără depozit') === w);
        const u = unitCell(unitC, ls, -1);
        formula(r, caseC, `IF(${u}="","",IFERROR(ROUNDUP(${u}/${ref(r, perCaseCol)},0),0))`, cases(ls));
        if (!ls.length) row[caseC].value = '';
        caseParts.push(ref(r, caseC)); unitParts.push(u);
      });
      const totalC = labels.findIndex(v => v === 'TOTAL BAX'), totalU = labels.findIndex(v => v === 'TOTAL BUC');
      formula(r, totalC, `SUM(${caseParts.join(',')})`, cases(lines)); formula(r, totalU, `SUM(${unitParts.join(',')})`, qty(lines));
      if (!lines.length) { row[totalC].value = ''; row[totalU].value = ''; }
      casesRefs.push(ref(r, totalC)); unitRefs.push(ref(r, totalU));
    } else {
      const unitC = labels.findIndex(v => /^(NR BUCATI|BUCATI|BUC)$/.test(v));
      const modified = labels.findIndex(v => v.includes('CANT MODIFICATA'));
      const caseC = labels.findIndex(v => /^(NR BAX|BAX)$/.test(v));
      const u = unitCell(unitC, lines, modified);
      formula(r, caseC, `IF(${u}="","",IFERROR(ROUNDUP(${u}/${ref(r, perCaseCol)},0),0))`, cases(lines));
      if (!lines.length) row[caseC].value = '';
      casesRefs.push(ref(r, caseC)); unitRefs.push(u);
    }
  });
  if (sheet.mixed) {
    for (const names of [['LUPINO', 'AMORINO'], ['SILHOUETTE', 'PRIMAVERA']]) {
      const pair = candidates.filter(({ p }) => names.some(n => normalize(p.product).includes(n)));
      if (pair.length !== 2) continue;
      const [a, b] = pair, c = labels.findIndex(v => v === 'BAX');
      const ac = rows[a.p.row][c], bc = rows[b.p.row][c];
      formula(a.p.row, c, `MAX(${ac.formula},${bc.formula})`, Math.max(Number(ac.value), Number(bc.value)));
      rows[b.p.row][c].value = ''; delete rows[b.p.row][c].formula;
      const i = casesRefs.indexOf(ref(b.p.row, c)); if (i >= 0) casesRefs.splice(i, 1);
    }
  }
  const caseCol = labels.findIndex(v => /^(TOTAL BAX|NR BAX|BAX)$/.test(v) && (pivot ? v === 'TOTAL BAX' : true));
  const totalCases = candidates.reduce((s, { p }) => s + (Number(rows[p.row][caseCol].value) || 0), 0);
  const totalUnits = sheet.lines.reduce((s, l) => s + finalQty(l), 0);
  if (template.name.includes('Image-Profi')) {
    for (let r = last + 1; r < rows.length; r++) {
      const name = String(rows[r][productCol]?.value || '');
      const matching = candidates.filter(({ p }) => sameProduct(p.product, name));
      if (!matching.length) continue;
      const units = labels.findIndex(v => v === 'BUCATI'), boxes = labels.findIndex(v => v === 'BAX');
      formula(r, units, `SUM(${matching.map(({ p }) => ref(p.row, units)).join(',')})`, matching.reduce((s, { lines }) => s + qty(lines), 0));
      formula(r, boxes, `SUM(${matching.map(({ p }) => ref(p.row, boxes)).join(',')})`, matching.reduce((s, { lines }) => s + cases(lines), 0));
    }
  }
  for (let r = last + 1; r < rows.length; r++) {
    if (normalize(rows[r][0]?.value).includes('TOTAL BAX')) {
      formula(r, caseCol, `SUM(${casesRefs.join(',')})`, totalCases);
      const totalText = rows[r].findIndex(c => normalize(c.value).includes('TOTAL BUC'));
      if (totalText >= 0) rows[r][totalText] = { ...rows[r][totalText], value: `TOTAL BUC   ${totalUnits}`, formula: `"TOTAL BUC   "&SUM(${unitRefs.join(',')})` };
    }
    if (normalize(rows[r][0]?.value).includes('NR PALETI')) {
      const palletParts: string[] = [];
      if (pivot) assigned.forEach((_, i) => {
        const c = firstWarehouse + i * 2;
        const parts = candidates.map(({ p }) => `${ref(p.row, c)}/${p.weight === 500 ? 40 : 72}`);
        const value = candidates.reduce((s, { p }) => s + Number(rows[p.row][c].value) / (p.weight === 500 ? 40 : 72), 0);
        formula(r, c, parts.join('+'), value); palletParts.push(ref(r, c));
      });
      formula(r, caseCol, pivot ? `SUM(${palletParts.join(',')})` : `SUM(${casesRefs.join(',')})/80`, pivot ? candidates.reduce((s, { p }) => s + Number(rows[p.row][caseCol].value) / (p.weight === 500 ? 40 : 72), 0) : totalCases / 80);
    }
  }
  merges.forEach(m => {
    const cell = rows[m.s.r]?.[m.s.c]; if (!cell) return;
    cell.rowSpan = m.e.r - m.s.r + 1; cell.colSpan = m.e.c - m.s.c + 1;
    for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) { if (rows[r]?.[c]) rows[r][c].hidden = true; }
  });
  return { rows, widths, excelWidths, heights, merges, header, templateName: template.name, landscape: template.landscape, products: candidates, totalCases, totalUnits };
}