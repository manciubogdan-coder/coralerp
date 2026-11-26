// Pure rules for the client returns report (Senior AEC negative lines). No React.
import type { ProductionWork } from '../../../supabase/functions/_shared/returnsProduction';
export interface ReturnLine { id: number | string; day: string; doc: string; partner: string; art: string; q: number; v: number; reason: string; production?: ProductionWork[] }
export interface ShippedRow { partner: string; art: string; q: number; v: number }
export interface ShippedDay { day: string; q: number; v: number }

export const REASON_CATEGORIES = ['Calitate', 'Lipsă marfă / materie primă', 'Etichetare / ambalare / baxare', 'Transport / nelivrat', 'Greșeli documente / comandă', 'Altele', 'Fără motiv scris'] as const;
export type ReasonCategory = typeof REASON_CATEGORIES[number];

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

/** Groups the free-text reason written by colleagues on the Senior line into a few business categories. */
export function reasonCategory(reason: string): ReasonCategory {
  const r = norm(reason ?? '');
  if (!r || /^AV\d/.test(r)) return 'Fără motiv scris';
  if (/CALITAT|REFUZ/.test(r)) return 'Calitate';
  if (/GRESIT|COD DE BARE|ARTICOL/.test(r) && !/BAXARE/.test(r)) return 'Greșeli documente / comandă';
  if (/ETICHET|AMBALAJ|BAX|FOLIE|MARKER/.test(r) && !/TRANSPORT/.test(r)) return 'Etichetare / ambalare / baxare';
  if (/LIPSA|MATRIE|MATERIE|GRAMAJ/.test(r)) return 'Lipsă marfă / materie primă';
  if (/TRANSPORT|NELIVRAT|TRIMIS|RAMAS|PUS /.test(r)) return 'Transport / nelivrat';
  return 'Altele';
}

/** "LIDL DISCOUNT SRL - ROMAN" → client "LIDL DISCOUNT SRL", store "ROMAN". */
export function splitPartner(name: string): { client: string; store: string } {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim();
  const i = s.search(/\s*-\s+|\s+-\s*/);
  if (i <= 0) return { client: s, store: s };
  return { client: s.slice(0, i).trim(), store: s.slice(i).replace(/^\s*-\s*/, '').trim() || s };
}

/** Compatibility field: this is production/dispatch day, not client delivery day (which equals refusal day). */
export function deliveryDay(returnDay: string, lag: number): string {
  return new Date(Date.parse(returnDay + 'T00:00:00Z') - lag * 86400000).toISOString().slice(0, 10);
}

export interface EnrichedReturn extends ReturnLine { client: string; store: string; category: ReasonCategory; delivered: string; reasonText: string }
export function enrich(lines: ReturnLine[], lag: number): EnrichedReturn[] {
  return lines.map((l) => {
    const { client, store } = splitPartner(l.partner);
    const reasonText = (l.reason ?? '').trim() || '(nescris)';
    return { ...l, q: Number(l.q) || 0, v: Number(l.v) || 0, client, store, category: reasonCategory(l.reason), delivered: deliveryDay(l.day, lag), reasonText };
  });
}

export interface Group { key: string; q: number; v: number; n: number; shippedQ: number; shippedV: number; rateV: number | null }
/** Every reason uses the same filtered shipped value, so contributions sum to the total return rate. */
export function returnRateBreakdown(lines: EnrichedReturn[], shippedValue: number, key: (l: EnrichedReturn) => string = (l) => l.category) {
  const total = lines.reduce((sum, l) => sum + l.v, 0);
  return groupBy(lines, key).map((g) => ({
    ...g,
    shippedV: shippedValue,
    rateV: shippedValue > 0 ? g.v / shippedValue : null,
    shareV: total > 0 ? g.v / total : null,
  }));
}
/** Sums returns by a key; shipped totals by the same key give the return rate (value returned ÷ value shipped). */
export function groupBy(lines: EnrichedReturn[], key: (l: EnrichedReturn) => string, shipped?: Map<string, { q: number; v: number }>): Group[] {
  const m = new Map<string, Group>();
  for (const l of lines) {
    const k = key(l);
    const g = m.get(k) ?? { key: k, q: 0, v: 0, n: 0, shippedQ: 0, shippedV: 0, rateV: null };
    g.q += l.q; g.v += l.v; g.n += 1; m.set(k, g);
  }
  for (const g of m.values()) {
    const s = shipped?.get(g.key);
    if (s) { g.shippedQ = s.q; g.shippedV = s.v; g.rateV = s.v > 0 ? g.v / s.v : null; }
  }
  return [...m.values()].sort((a, b) => b.v - a.v);
}

export function shippedBy(rows: ShippedRow[], key: (r: ShippedRow & { client: string; store: string }) => string) {
  const m = new Map<string, { q: number; v: number }>();
  for (const r of rows) {
    const k = key({ ...r, ...splitPartner(r.partner) });
    const s = m.get(k) ?? { q: 0, v: 0 };
    s.q += Number(r.q) || 0; s.v += Number(r.v) || 0; m.set(k, s);
  }
  return m;
}
