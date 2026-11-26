// Read-only traceability: candidates by exact product/store and actual Bucharest work day, never proof of fault.
export interface ProductionWork {
  sessionId: string; orderId: string; order: string; day: string; product: string;
  store: string; point: string; operator: string; line: string; quantity: number;
  start: string; end: string | null; employees: number;
}
const normalized = (v: string) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
export const productionDay = (refusalDay: string) => new Date(Date.parse(refusalDay + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
export function createProductionMatcher(work: ProductionWork[]) {
  const index = new Map<string, ProductionWork[]>(), seen = new Set<string>();
  const key = (day: string, product: string, store: string) => JSON.stringify([day, normalized(product), normalized(store)]);
  for (const w of work) {
    if (!(w.quantity > 0) || seen.has(w.sessionId)) continue;
    seen.add(w.sessionId);
    const stores = [w.store];
    if (normalized(w.point) && normalized(w.point) !== 'STANDARD') stores.push(`${w.store} - ${w.point}`);
    for (const store of new Set(stores)) {
      const k = key(w.day, w.product, store);
      index.set(k, [...(index.get(k) ?? []), w]);
    }
  }
  return (row: { day: string; art: string; partner: string }) => index.get(key(productionDay(row.day), row.art, row.partner)) ?? [];
}
export function matchProduction(row: { day: string; art: string; partner: string }, work: ProductionWork[]): ProductionWork[] {
  return createProductionMatcher(work)(row);
}