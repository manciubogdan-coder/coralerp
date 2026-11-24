/** Supplier price audit: what was billed in Senior vs the agreed list price and vs the cheapest listed supplier. */
export type PriceListItem = { product: string; category: string; prices: Record<string, number> };
import type { SupplierPricePeriod } from '../../../supabase/functions/_shared/supplierPricePeriods';
export { validatePricePeriods } from '../../../supabase/functions/_shared/supplierPricePeriods';
export type { SupplierPricePeriod } from '../../../supabase/functions/_shared/supplierPricePeriods';
export type PriceList = { currency: string; items: PriceListItem[]; suppliers: { name: string; aliases: string[] }[]; periods?: SupplierPricePeriod[] };
export type InvoiceLine = { id: number | string; day: string; tip: string; doc: string; sup: string; art: string; um: string; q: number; pron: number; vron: number; peur: number | null; pref: number | null; cur: string; rate: number | null };
export type LineStatus = 'ok' | 'peste' | 'sub' | 'fara_pret' | 'necunoscut';
export type AuditLine = InvoiceLine & {
  supplier: string | null; category: string; agreed: number | null; best: number | null; bestSupplier: string | null;
  /** EUR: supplier billed vs its own agreed price (+ = we paid more). */ priceDiff: number;
  /** EUR at list prices: chosen supplier vs cheapest one. */ choiceDiff: number;
  /** EUR: what we paid vs everything at the cheapest list price. */ totalDiff: number;
  /** Was the chosen supplier's list price the lowest valid one that day? null = unknown. */ isCheapest: boolean | null;
  paid: number; status: LineStatus; validFrom: string | null; validTo: string | null;
};

export const PRICE_TOLERANCE_EUR = 0.005;
const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Short list name of a Senior partner: exact alias, or every word of the short name found in the partner name. */
export function matchSupplier(partner: string, list: PriceList): string | null {
  const p = norm(partner), words = new Set(p.split(' '));
  for (const s of list.suppliers) if (s.aliases.some((a) => norm(a) === p)) return s.name;
  for (const s of list.suppliers) { const w = norm(s.name).split(' ').filter(Boolean); if (w.length && w.every((x) => words.has(x))) return s.name; }
  return null;
}

export function cheapest(item: PriceListItem | undefined): { supplier: string; price: number } | null {
  let best: { supplier: string; price: number } | null = null;
  for (const [supplier, price] of Object.entries(item?.prices ?? {})) if (price > 0 && (!best || price < best.price)) best = { supplier, price };
  return best;
}

export function auditLine(l: InvoiceLine, list: PriceList): AuditLine {
  const dated = (list.periods?.length ?? 0) > 0;
  const active = (list.periods ?? []).filter((p) => p.validFrom <= l.day && p.validTo >= l.day);
  const prices: Record<string, number> = {};
  let category = '';
  for (const p of active) {
    const row = p.items.find((i) => norm(i.product) === norm(l.art));
    if (row) { prices[p.supplier] = row.price; category = row.category; }
  }
  const item = dated ? { product: l.art, category, prices } : list.items.find((i) => norm(i.product) === norm(l.art));
  const supplier = matchSupplier(l.sup, list);
  const period = active.find((p) => p.supplier === supplier && p.items.some((i) => norm(i.product) === norm(l.art)));
  const agreed = supplier ? item?.prices[supplier] ?? null : null;
  const b = cheapest(item);
  const peur = l.peur ?? 0, q = l.q;
  const status: LineStatus = !supplier ? 'necunoscut' : agreed == null ? 'fara_pret'
    : peur - agreed > PRICE_TOLERANCE_EUR ? 'peste' : agreed - peur > PRICE_TOLERANCE_EUR ? 'sub' : 'ok';
  return {
    ...l, supplier, category: item?.category ?? '', agreed, best: b?.price ?? null, bestSupplier: b?.supplier ?? null,
    validFrom: period?.validFrom ?? null, validTo: period?.validTo ?? null,
    paid: q * peur,
    priceDiff: agreed != null ? q * (peur - agreed) : 0,
    choiceDiff: b && agreed != null ? q * (agreed - b.price) : 0,
    totalDiff: b ? q * (peur - b.price) : 0,
    isCheapest: b && agreed != null ? agreed - b.price <= PRICE_TOLERANCE_EUR : null,
    status,
  };
}

export type Totals = { qty: number; paid: number; atAgreed: number; atBest: number; priceDiff: number; choiceDiff: number; totalDiff: number; lines: number; issues: number; notCheapest: number; withoutAgreed: number; withoutBest: number };
export function totals(lines: AuditLine[]): Totals {
  const t: Totals = { qty: 0, paid: 0, atAgreed: 0, atBest: 0, priceDiff: 0, choiceDiff: 0, totalDiff: 0, lines: lines.length, issues: 0, notCheapest: 0, withoutAgreed: 0, withoutBest: 0 };
  for (const l of lines) {
    t.qty += l.q; t.paid += l.paid; t.priceDiff += l.priceDiff; t.choiceDiff += l.choiceDiff; t.totalDiff += l.totalDiff;
    if (l.agreed != null) t.atAgreed += l.paid - l.priceDiff; else t.withoutAgreed++;
    if (l.best != null) t.atBest += l.paid - l.totalDiff; else t.withoutBest++;
    if (l.status !== 'ok' && l.status !== 'sub') t.issues += 1;
    if (l.isCheapest === false) t.notCheapest += 1;
  }
  return t;
}

export function groupBy<K extends string>(lines: AuditLine[], key: (l: AuditLine) => K): { key: K; lines: AuditLine[]; t: Totals }[] {
  const m = new Map<K, AuditLine[]>();
  for (const l of lines) { const k = key(l); m.set(k, [...(m.get(k) ?? []), l]); }
  return [...m.entries()].map(([k, ls]) => ({ key: k, lines: ls, t: totals(ls) })).sort((a, b) => b.t.totalDiff - a.t.totalDiff);
}

/** Reads a price-list sheet: header row with "Produs" then one column per supplier (EUR per unit). */
export function parsePriceSheet(rows: unknown[][], category: string): PriceListItem[] {
  const h = rows.findIndex((r) => r.some((c) => norm(String(c ?? '')) === 'PRODUS'));
  if (h < 0) return [];
  const head = rows[h].map((c) => String(c ?? '').trim()), pc = head.findIndex((c) => norm(c) === 'PRODUS');
  return rows.slice(h + 1).filter((r) => String(r[pc] ?? '').trim()).map((r) => {
    const prices: Record<string, number> = {};
    head.forEach((name, i) => { const n = Number(String(r[i] ?? '').replace(',', '.')); if (i !== pc && name && String(r[i] ?? '').trim() !== '' && Number.isFinite(n) && n > 0) prices[name] = n; });
    return { product: String(r[pc]).trim().toUpperCase(), category, prices };
  });
}
