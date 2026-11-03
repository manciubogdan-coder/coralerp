export type CartonComponent = { produs_id: string; nume: string; units: number; gramaj?: number | null };
export type MixedCarton = { produs_id: string; denumire: string; aliases: string[]; components: CartonComponent[]; enabled: boolean };
export const cartonName = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function findCarton(rows: MixedCarton[], id?: string | null, name?: string) {
  if (id) { const exact = rows.find(r => r.produs_id === id && r.enabled); if (exact) return exact; }
  const key = cartonName(name);
  const matches = rows.filter(r => r.enabled && [r.denumire, ...r.aliases].some(n => key && cartonName(n) === key));
  if (matches.length > 1) throw new Error(`Denumirea ${name} corespunde mai multor baxuri. Verifică denumirile de import.`);
  return matches[0];
}
export function validateCarton(row: MixedCarton, rows: MixedCarton[] = []) {
  if (!row.denumire.trim() || row.components.length < 2) throw new Error('Alege cel puțin două produse componente.');
  const ids = new Set<string>();
  for (const c of row.components) {
    if (!c.produs_id || c.produs_id === row.produs_id || ids.has(c.produs_id) || !Number.isSafeInteger(c.units) || c.units <= 0 || c.units > 10000) throw new Error('Produsele trebuie să fie distincte, cu bucăți întregi pozitive.');
    if (rows.some(r => r.enabled && r.produs_id === c.produs_id)) throw new Error('Un bax mixt nu poate conține alt bax mixt.');
    ids.add(c.produs_id);
  }
  if (rows.some(r => r.enabled && r.produs_id !== row.produs_id && r.components.some(c => c.produs_id === row.produs_id))) throw new Error('Produsul este deja componenta altui bax.');
  const names = [row.denumire, ...row.aliases].map(cartonName);
  if (row.enabled && rows.some(r => r.enabled && r.produs_id !== row.produs_id && [r.denumire, ...r.aliases].some(n => names.includes(cartonName(n))))) throw new Error('O denumire de import este folosită deja de alt bax.');
}
export function expandCarton(row: MixedCarton, quantity: number, unit: 'bax' | 'buc' = 'bax') {
  validateCarton(row);
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Cantitate de baxuri invalidă.');
  const total = row.components.reduce((s, c) => s + c.units, 0);
  const cartons = unit === 'buc' ? quantity / total : quantity;
  if (!Number.isSafeInteger(cartons)) throw new Error('Cantitatea nu reprezintă baxuri complete; verifică unitatea bax/buc.');
  return row.components.map(c => ({ ...c, quantity: cartons * c.units, cartons }));
}
export function cartonReady(row: MixedCarton, produced: Record<string, number>) {
  return Math.min(...row.components.map(c => Math.floor(Math.max(0, produced[c.produs_id] ?? 0) / c.units)));
}