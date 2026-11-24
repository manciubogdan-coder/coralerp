/** Supplier price audit: what was billed in Senior vs the agreed list price and vs the cheapest listed supplier. */
export type PriceListItem = { product: string; category: string; prices: Record<string, number> };
export type PriceList = { currency: string; items: PriceListItem[]; suppliers: { name: string; aliases: string[] }[] };
export type InvoiceLine = { id: number | string; day: string; tip: string; doc: string; sup: string; art: string; um: string; q: number; pron: number; vron: number; peur: number | null; pref: number | null; cur: string; rate: number | null };
export type LineStatus = 'ok' | 'peste' | 'sub' | 'fara_pret' | 'necunoscut';
export type AuditLine = InvoiceLine & {
  supplier: string | null; category: string; agreed: number | null; best: number | null; bestSupplier: string | null;
  /** EUR: supplier billed vs its own agreed price (+ = we paid more). */ priceDiff: number;
  /** EUR at list prices: chosen supplier vs cheapest one. */ choiceDiff: number;
  /** EUR: what we paid vs everything at the cheapest list price. */ totalDiff: number;
  paid: number; status: LineStatus;
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
  const item = list.items.find((i) => norm(i.product) === norm(l.art));
  const supplier = matchSupplier(l.sup, list);
  const agreed = supplier ? item?.prices[supplier] ?? null : null;
  const b = cheapest(item);
  const peur = l.peur ?? 0, q = l.q;
  const status: LineStatus = !supplier ? 'necunoscut' : agreed == null ? 'fara_pret'
    : peur - agreed > PRICE_TOLERANCE_EUR ? 'peste' : agreed - peur > PRICE_TOLERANCE_EUR ? 'sub' : 'ok';
  return {
    ...l, supplier, category: item?.category ?? '', agreed, best: b?.price ?? null, bestSupplier: b?.supplier ?? null,
    paid: q * peur,
    priceDiff: agreed != null ? q * (peur - agreed) : 0,
    choiceDiff: b ? q * ((agreed ?? peur) - b.price) : 0,
    totalDiff: b ? q * (peur - b.price) : 0,
    status,
  };
}

export type Totals = { qty: number; paid: number; atAgreed: number; atBest: number; priceDiff: number; choiceDiff: number; totalDiff: number; lines: number; issues: number };
export function totals(lines: AuditLine[]): Totals {
  const t: Totals = { qty: 0, paid: 0, atAgreed: 0, atBest: 0, priceDiff: 0, choiceDiff: 0, totalDiff: 0, lines: lines.length, issues: 0 };
  for (const l of lines) {
    t.qty += l.q; t.paid += l.paid; t.priceDiff += l.priceDiff; t.choiceDiff += l.choiceDiff; t.totalDiff += l.totalDiff;
    t.atAgreed += l.paid - l.priceDiff; t.atBest += l.paid - l.totalDiff;
    if (l.status !== 'ok' && l.status !== 'sub') t.issues += 1;
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
