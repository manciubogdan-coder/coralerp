import { manualRestockPayload } from './manualRestock';

export interface CountRow { id: string; productId: string; units: string; cases: string }
export function countUnits(row: CountRow): number {
  const units = Number(row.units), cases = Number(row.cases);
  if (!Number.isInteger(units) || units <= 0 || !Number.isInteger(cases) || cases < 0) throw new Error('Bucățile/bax trebuie să fie întregi pozitive, iar baxurile întregi, minimum zero.');
  if (!Number.isSafeInteger(units * cases)) throw new Error('Cantitate prea mare.');
  return units * cases;
}
export function buildCount(rows: CountRow[], allowedIds: Set<string>, day: string) {
  manualRestockPayload('date-validation', 1, day);
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.units.trim() && !row.cases.trim()) continue;
    if (!allowedIds.has(row.productId)) throw new Error('Selectează o grupă validă pentru fiecare rând.');
    const quantity = countUnits(row);
    if (quantity > 0) totals.set(row.productId, (totals.get(row.productId) || 0) + quantity);
  }
  return Array.from(totals, ([id, quantity]) => manualRestockPayload(id, quantity, day));
}
export function clearedStockPatch() {
  return { cantitate_surplus: 0, status: 'redistribuit', updated_at: new Date().toISOString() };
}