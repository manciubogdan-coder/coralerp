import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const businessDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? value : formatInTimeZone(new Date(value), 'Europe/Bucharest', 'yyyy-MM-dd');
export const dayBounds = (day: string) => ({
  start: fromZonedTime(`${day}T00:00:00`, 'Europe/Bucharest').toISOString(),
  end: fromZonedTime(`${day}T23:59:59.999`, 'Europe/Bucharest').toISOString(),
});
export const materialKey = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
export const materialQuantity = (quantity: unknown, unit?: string) => {
  const q = Number(quantity) || 0;
  const u = (unit || '').toLowerCase();
  return ['g', 'gr', 'grame'].includes(u) ? q / 1000 : ['t', 'tone'].includes(u) ? q * 1000 : q;
};
export async function readPages(build: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await build().range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

// Transfer quantity includes transport packaging; only net quantity leaves stock.
export function transferStockQuantity(item: any, inventoryUnit?: string) {
  return materialQuantity(item.net_quantity ?? item.quantity, item.unit || inventoryUnit);
}

export const isProductionDestination = (destination: string | null | undefined) => materialKey(destination || '').includes('produc');

// An absent product row is not proof of zero stock or snapshot completeness.
export function aggregateSnapshots(rows: any[], resolveKey: (row: any) => string | undefined) {
  const totals: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const key = resolveKey(row);
    if (!key) continue;
    const day = businessDay(row.snapshot_date);
    const dates = totals[key] ||= {};
    dates[day] = (dates[day] || 0) + materialQuantity(row.quantity, row.unit);
  }
  return totals;
}

// Commitments remain visible after delivery; they are never treated as actual receipts.
export function historicalCommitments(orders: any[]) {
  const result: Record<string, Record<string, number>> = {};
  for (const o of orders) {
    const day = o.expected_delivery_date?.slice(0, 10);
    if (!o.product_id || !day || ['cancelled', 'canceled'].includes(o.status)) continue;
    const schedule = result[o.product_id] ||= {};
    schedule[day] = (schedule[day] || 0) + (Number(o.quantity_ordered) || 0);
  }
  return result;
}

export interface ProductionUsage {
  key: string; name: string; day: string; targetDay: string | null; orderId: string;
  product: string; client: string; quantity: number; advance: boolean; otherDay: boolean;
}
export function sessionUsage(sessions: any[], orders: any[], customs: any[]): ProductionUsage[] {
  const byId = new Map(orders.map(o => [o.id, o]));
  return sessions.flatMap(s => {
    const o = byId.get(s.comanda_id);
    if (!o || !s.ora_sfarsit || !['finalizata', 'partial'].includes(s.status)) return [];
    const day = businessDay(s.ora_sfarsit);
    const targetDay = o.data_productie?.slice(0, 10) || null;
    const own = customs.filter(i => i.comanda_id === o.id);
    const recipes = o.productie_produse?.productie_retete || [];
    const ingredients = own.length ? own : (recipes.find((r: any) => r.activa)?.productie_retete_ingrediente || []);
    return ingredients.map((i: any) => {
      const name = i.ingredient_custom_nume || i.productie_ingrediente?.nume || 'Necunoscut';
      return { key: materialKey(name), name, day, targetDay, orderId: o.id,
        product: o.productie_produse?.nume || '', client: o.magazin || '',
        quantity: materialQuantity(Number(i.cantitate_necesara) * Number(s.cantitate_produsa || 0), i.unitate_masura),
        advance: o.tip_comanda === 'PRODUCTIE_AVANS' || o.magazin === 'PRODUCTIE_AVANS',
        otherDay: !!targetDay && targetDay !== day };
    });
  });
}
export function stockVariance(opening: number | null, closing: number | null, receipts: number, outbound: number) {
  // Signed residual: returns, inventory corrections, timing and unmapped movements, NOT proven loss.
  return opening === null || closing === null ? null : closing - (opening + receipts - outbound);
}

const isAdvanceOrder = (o: any) => o.tip_comanda === 'PRODUCTIE_AVANS' || o.magazin === 'PRODUCTIE_AVANS';

/**
 * Order quantities that drive raw-material consumption for their production day.
 * Firm orders count fully; same-day advance plans only add the part not already
 * covered by firm orders of the same product (max(firm, advance) per product/day).
 */
export function effectiveOrderQuantities<T extends { produs_id?: string | null; data_productie?: string | null; cantitate?: unknown; status?: string; tip_comanda?: string; magazin?: string }>(orders: T[]) {
  const live = orders.filter(o => o.produs_id && o.data_productie && o.status !== 'canceled_by_erp');
  const firmTotals = new Map<string, number>(), advanceTotals = new Map<string, number>();
  const keyOf = (o: T) => `${o.produs_id}|${String(o.data_productie).slice(0, 10)}`;
  for (const o of live) {
    const m = isAdvanceOrder(o) ? advanceTotals : firmTotals;
    m.set(keyOf(o), (m.get(keyOf(o)) || 0) + (Number(o.cantitate) || 0));
  }
  return live.map(o => {
    const qty = Number(o.cantitate) || 0;
    if (!isAdvanceOrder(o)) return { order: o, quantity: qty, advance: false };
    const advance = advanceTotals.get(keyOf(o)) || 0, firm = firmTotals.get(keyOf(o)) || 0;
    const share = advance > 0 ? qty / advance : 0;
    return { order: o, quantity: Math.max(0, advance - firm) * share, advance: true };
  }).filter(r => r.quantity > 0);
}

/** Weekday average over every reference day (days without orders count as zero). */
export function weekdayAverages(totals: Record<string, number>, days: string[]) {
  const sums = [0, 0, 0, 0, 0, 0, 0], counts = [0, 0, 0, 0, 0, 0, 0];
  for (const day of days) {
    const w = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
    counts[w] += 1; sums[w] += totals[day] || 0;
  }
  return sums.map((s, i) => counts[i] ? s / counts[i] : 0);
}

const shiftDay = (day: string, delta: number) => {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10);
};
/**
 * Pending supplier deliveries minus goods already received for them (early, late or today),
 * so a reception is never added on top of the order it fulfils.
 * Receipts of the last `lookback` days not explained by commitments due that same day
 * (plus today's surplus over today's order) cancel the earliest pending quantities.
 */
export function netPendingDeliveries(input: {
  ordered: Record<string, number>; received: Record<string, number>;
  commitments: Record<string, number>; today: string; lookback?: number;
}) {
  const lookback = input.lookback ?? 3;
  let pool = 0;
  for (let i = lookback; i >= 1; i--) {
    const d = shiftDay(input.today, -i);
    pool += Math.max(0, (input.received[d] || 0) - (input.commitments[d] || 0));
  }
  const result: Record<string, number> = {};
  const hasToday = Object.prototype.hasOwnProperty.call(input.received, input.today);
  if (hasToday) pool += Math.max(0, (input.received[input.today] || 0) - (input.ordered[input.today] || 0));
  for (const day of Object.keys(input.ordered).sort()) {
    const qty = input.ordered[day] || 0;
    if (day < input.today) continue;
    if (day === input.today && hasToday) { result[day] = qty; continue; }
    const used = Math.min(pool, qty); pool -= used;
    result[day] = qty - used;
  }
  return result;
}

export function reconcileProjection(input: {
  dates: string[]; today: string; anchor: number | null;
  snapshots: Record<string, number>; ordered: Record<string, number>;
  received: Record<string, number>; outbound: Record<string, number>; returned?: Record<string, number>;
  /** Consumption per day from client orders × recipes (estimated average where no orders exist). */
  demand: number[];
}) {
  let running: number | null = input.anchor;
  return input.dates.map((day, i) => {
    const historical = day < input.today;
    const observed = input.snapshots[day] ?? null;
    const opening = day <= input.today ? observed : running;
    const hasReceipt = Object.prototype.hasOwnProperty.call(input.received, day);
    const incoming = (hasReceipt ? input.received[day] || 0 : historical ? 0 : input.ordered[day] || 0)
      + (input.returned?.[day] || 0);
    const consumption = input.demand[i] || 0;
    const closing = opening === null ? null : opening + incoming - consumption;
    const nextDay = new Date(`${day}T12:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextSnapshot = input.snapshots[nextDay.toISOString().slice(0, 10)] ?? null;
    // Ledger check against real warehouse issues, independent of order-based consumption.
    const residual = historical ? stockVariance(opening, nextSnapshot, incoming, input.outbound[day] || 0) : null;
    running = closing;
    return { opening, closing, observed, incoming, consumption, residual };
  });
}
export interface StockGapDay {
  day: string; opening: number | null; ordered: number; received: number; returned: number;
  outbound: number; planned: number; advances: number; otherDays: number; qualityLoss: number;
}
// Exact decomposition of today's observed stock versus the plan made on the first day:
// expected = start + ordered − planned; actual − expected = (received − ordered) + returns − (outbound − planned) + unexplained.
export function explainStockGap(input: {
  dates: string[]; today: string; snapshots: Record<string, number>;
  ordered: Record<string, number>; received: Record<string, number>; returned: Record<string, number>;
  outbound: Record<string, number>; planned: Record<string, number>;
  advances: Record<string, number>; otherDays: Record<string, number>; qualityLoss: Record<string, number>;
}) {
  const days: StockGapDay[] = input.dates.filter(d => d < input.today).map(day => ({
    day, opening: input.snapshots[day] ?? null, ordered: input.ordered[day] || 0,
    received: input.received[day] || 0, returned: input.returned[day] || 0,
    outbound: input.outbound[day] || 0, planned: input.planned[day] || 0,
    advances: input.advances[day] || 0, otherDays: input.otherDays[day] || 0, qualityLoss: input.qualityLoss[day] || 0,
  }));
  const sum = (k: keyof Omit<StockGapDay, 'day' | 'opening'>) => days.reduce((s, d) => s + d[k], 0);
  const start = days.length ? days[0].opening : null;
  const actual = input.snapshots[input.today] ?? null;
  const ordered = sum('ordered'), received = sum('received'), returned = sum('returned');
  const outbound = sum('outbound'), planned = sum('planned');
  const expected = start === null ? null : start + ordered - planned;
  const unexplained = start === null || actual === null ? null : actual - (start + received + returned - outbound);
  return {
    days, start, actual, expected, ordered, received, returned, outbound, planned,
    advances: sum('advances'), otherDays: sum('otherDays'), qualityLoss: sum('qualityLoss'),
    receivedVsOrdered: received - ordered, consumedOverPlan: outbound - planned, unexplained,
    gap: expected === null || actual === null ? null : actual - expected,
  };
}

export type StockGap = ReturnType<typeof explainStockGap>;
export type StockGapIssue = { kind: 'received' | 'consumed' | 'unexplained' | 'returned'; value: number; text: string };

/** Problemele semnificative (≥10 unități și ≥5% din stocul așteptat), sortate după impact. */
export function stockGapIssues(gap: StockGap | null, unit = ''): StockGapIssue[] {
  if (!gap || gap.gap === null) return [];
  const limit = Math.max(10, Math.abs(gap.expected ?? 0) * 0.05);
  if (Math.abs(gap.gap) < limit) return [];
  const f = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('ro-RO')} ${unit}`.trim();
  const list: StockGapIssue[] = [
    { kind: 'received', value: gap.receivedVsOrdered, text: gap.receivedVsOrdered < 0 ? `Recepționat cu ${f(gap.receivedVsOrdered)} mai puțin decât s-a comandat` : `Recepționat cu ${f(gap.receivedVsOrdered)} peste comandă` },
    { kind: 'consumed', value: -gap.consumedOverPlan, text: gap.consumedOverPlan > 0 ? `Ieșit din depozit cu ${f(gap.consumedOverPlan)} peste necesarul comenzilor` : `Ieșit din depozit cu ${f(gap.consumedOverPlan)} sub necesarul comenzilor` },
    { kind: 'returned', value: gap.returned, text: `Retururi din producție: ${f(gap.returned)}` },
  ];
  if (gap.unexplained !== null) list.push({ kind: 'unexplained', value: gap.unexplained, text: gap.unexplained < 0
    ? `Stocul scriptic din snapshot are cu ${f(gap.unexplained)} mai puțin decât rezultă din recepții și transferuri (mișcare neînregistrată sau corecție manuală)`
    : `Stocul scriptic din snapshot are cu ${f(gap.unexplained)} mai mult decât rezultă din recepții și transferuri` });
  return list.filter(i => Math.abs(i.value) >= limit).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}
