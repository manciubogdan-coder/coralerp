import templates from './orderTemplates.json';

export type OrderLine = {
  id: string; client: string; depozit: string | null; nr_comanda: string | null;
  produs: string; gramaj: number | null; bucati: number; taiat: number;
  buc_bax: number | null; ambalaj_primar: string | null; ambalaj_tertiar: string | null;
};
export const normalize = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const finalQty = (l: OrderLine) => Math.max(0, l.bucati - l.taiat);
const productKey = (l: OrderLine) => `${normalize(l.produs)}|${l.gramaj}`;
const mixedNames = /PRESTIGIO|LUPINO|AMORINO|SILHOUETTE|PRIMAVERA/;
export function templatePack(l: OrderLine) {
  const client = normalize(l.client);
  const ts = templates.filter(t => client.includes('LIDL') ? normalize(t.name).includes('SALATE MIXTE') || normalize(t.name).includes('SALATE MONO') : normalize(t.name).includes(client.split(' ')[0]));
  return ts.flatMap(t => t.products).find(p => normalize(p.produs) === normalize(l.produs) && p.gramaj === l.gramaj);
}
export function withTemplatePack<T extends OrderLine>(l: T): T {
  const p = templatePack(l);
  return { ...l, ambalaj_primar: l.ambalaj_primar || p?.primar || null, ambalaj_tertiar: l.ambalaj_tertiar || p?.tertiar || null, buc_bax: l.buc_bax || p?.bucBax || null };
}
export type OrderSheet = { key: string; client: string; title: string; lines: OrderLine[]; pivot: boolean; mixed: boolean; warehouses: string[]; notes: string[] };
export function makeSheets(lines: OrderLine[]): OrderSheet[] {
  const result: OrderSheet[] = [];
  for (const client of [...new Set(lines.map(l => l.client))].sort()) {
    const all = lines.filter(l => l.client === client).map(withTemplatePack);
    const lidl = normalize(client).includes('LIDL');
    const sets = lidl ? [all.filter(l => !mixedNames.test(normalize(l.produs))), all.filter(l => mixedNames.test(normalize(l.produs)))] : [all];
    sets.forEach((ls, idx) => {
      if (!ls.length) return;
      const mixed = lidl && idx === 1;
      const warehouses = [...new Set(ls.map(l => l.depozit || 'Fără depozit'))];
      const groups = mixed ? warehouses.map(d => ls.filter(l => (l.depozit || 'Fără depozit') === d)) : [ls];
      groups.forEach(group => {
        const title = lidl ? `${client} — SALATE ${mixed ? 'MIXTE' : 'MONO'}${mixed ? ` — ${group[0]?.depozit || 'Fără depozit'}` : ''}` : client;
        const ts = templates.filter(t => lidl ? normalize(t.name).includes(mixed ? 'MIXTE' : 'MONO') : normalize(t.name).includes(normalize(client).split(' ')[0]));
        result.push({ key: title, client, title, lines: group, mixed, pivot: !mixed && (lidl || /KAUFLAND|MEGA/.test(normalize(client))) && warehouses.length > 1, warehouses, notes: [...new Set(ts.flatMap(t => t.notes))] });
      });
    });
  }
  return result;
}
export type SheetCell = { value: string | number; lines?: OrderLine[]; kind?: 'original' | 'modified' | 'cases' | 'total'; rowSpan?: number };
export type SheetRow = { key: string; cells: SheetCell[]; line: OrderLine };
export function sheetTable(sheet: OrderSheet) {
  const headers = ['Nr. crt', ...(sheet.pivot || sheet.mixed ? [] : ['Depozit', 'Nr. comandă']), 'DENUMIRE PRODUS', 'Gramaj (g)'];
  const rows: SheetRow[] = [];
  const groups = sheet.pivot ? [...new Set(sheet.lines.map(productKey))].map(k => sheet.lines.filter(l => productKey(l) === k)) : sheet.lines.map(l => [l]);
  if (sheet.pivot || sheet.mixed) headers.push('Ambalaj primar', 'Buc / Bax');
  if (sheet.pivot) sheet.warehouses.forEach(d => headers.push(`${d} · BAX`, `${d} · BUC`, `${d} · Cant. Modificată`));
  else headers.push('Nr. Bucăți', 'Cant. Modificată');
  if (!sheet.pivot && !sheet.mixed) headers.push('Ambalaj primar', 'Buc / Bax');
  headers.push(sheet.pivot ? 'Total BAX' : 'Nr. BAX', ...(sheet.pivot ? ['Total BUC'] : []), 'Ambalaj terțiar / cutie');
  groups.forEach((ls, idx) => {
    const l = ls[0]; if (!l) return;
    const cells: SheetCell[] = [{ value: idx + 1 }, ...(sheet.pivot || sheet.mixed ? [] : [{ value: l.depozit || '' }, { value: l.nr_comanda || '' }]), { value: l.produs }, { value: l.gramaj ?? '' }];
    const qty = (xs: OrderLine[]) => xs.reduce((s, x) => s + finalQty(x), 0);
    const cases = (xs: OrderLine[]) => xs.reduce((s, x) => s + (x.buc_bax ? Math.ceil(finalQty(x) / x.buc_bax) : 0), 0);
    const quantityCells = (xs: OrderLine[]): SheetCell[] => [{ value: xs.reduce((s, x) => s + x.bucati, 0), lines: xs, kind: 'original' }, { value: xs.some(x => x.taiat !== 0) ? qty(xs) : '', lines: xs, kind: 'modified' }];
    if (sheet.pivot || sheet.mixed) cells.push({ value: l.ambalaj_primar || '' }, { value: l.buc_bax || '' });
    if (sheet.pivot) sheet.warehouses.forEach(d => { const xs = ls.filter(x => (x.depozit || 'Fără depozit') === d); cells.push({ value: cases(xs), kind: 'cases', lines: xs }, ...quantityCells(xs)); });
    else cells.push(...quantityCells(ls));
    if (!sheet.pivot && !sheet.mixed) cells.push({ value: l.ambalaj_primar || '' }, { value: l.buc_bax || '' });
    cells.push({ value: cases(ls), kind: 'cases', lines: ls }, ...(sheet.pivot ? [{ value: qty(ls), kind: 'total' as const }] : []), { value: l.ambalaj_tertiar || '' });
    rows.push({ key: l.id, cells, line: l });
  });
  // One shared carton for each 6+2 assortment: never add both product carton counts.
  if (sheet.mixed) {
    for (const names of [['LUPINO', 'AMORINO'], ['SILHOUETTE', 'PRIMAVERA']]) {
      const pair = rows.filter(r => names.some(n => normalize(r.line.produs).includes(n)));
      if (pair.length !== 2) continue;
      const first = pair[0], second = pair[1]; if (!first || !second) continue;
      const caseCol = headers.indexOf('Nr. BAX');
      const shared = Math.max(Number(first.cells[caseCol]?.value) || 0, Number(second.cells[caseCol]?.value) || 0);
      first.cells[caseCol] = { value: shared, rowSpan: 2, kind: 'cases', lines: pair.map(r => r.line) };
      second.cells[caseCol] = { value: '', rowSpan: 0 };
      const index = rows.indexOf(first); rows.splice(rows.indexOf(second), 1); rows.splice(index + 1, 0, second);
    }
  }
  const caseCol = headers.indexOf(sheet.pivot ? 'Total BAX' : 'Nr. BAX');
  const totalCases = rows.reduce((s, r) => s + (Number(r.cells[caseCol]?.value) || 0), 0);
  const totalUnits = sheet.lines.reduce((s, l) => s + finalQty(l), 0);
  const pallets = sheet.mixed ? totalCases / 80 : normalize(sheet.client).includes('LIDL') ? sheet.warehouses.reduce((s, d) => s + sheet.lines.filter(l => (l.depozit || 'Fără depozit') === d).reduce((t, l) => t + (l.buc_bax ? Math.ceil(finalQty(l) / l.buc_bax) / (l.gramaj === 500 ? 40 : 72) : 0), 0), 0) : null;
  return { headers, rows, totalCases, totalUnits, pallets };
}