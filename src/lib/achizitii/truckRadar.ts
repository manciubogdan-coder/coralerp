// Purchasing control radar: per loading truck, compares what was ordered with what the
// forecast needs now, checks the order was finalised on its order day, and simulates delays.
// Pure rules (no React); consumption follows the same rules as the Achiziții forecast.
import { netPendingDeliveries, reconcileProjection, weekdayAverages } from '@/lib/forecastReconciliation';
import type { RadarSettings, RadarInvType } from '../../../supabase/functions/_shared/truckRadarRules';
export { DEFAULT_RADAR_SETTINGS, DEFAULT_RADAR_BY_TYPE, validRadarSettings, validRadarSettingsByType } from '../../../supabase/functions/_shared/truckRadarRules';
export type { RadarSettings, RadarInvType };
import { FORECAST_GROUP_ORDER, PACK_TYPES } from '../forecastGroups';

export interface RadarRow {
  key: string; name: string; unit: string; productId: string | null;
  snapshots: Record<string, number>; received: Record<string, number>; returned: Record<string, number>;
  outbound: Record<string, number>; commitments: Record<string, number>; orderedPerDate: Record<string, number>;
  transferAvg: number[]; actualConsumption: Record<string, number>; buffer?: number;
  /** Product lead time in days (forecast product settings). */
  leadTime?: number;
  /** Product range from the forecast (Salate, Aromate, Folii, ...). */
  group?: string;
}
export interface RadarOrder { id: string; product_id: string | null; quantity: number; delivery_date: string; order_date: string | null; status: string }
export interface OrderVersion { order_id: string; quantity: number; delivery_date: string | null; status: string | null; seen_at: string }

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
export const isoWeekday = (day: string) => ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const range = (from: string, to: string) => { const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
const CANCELLED = ['cancelled', 'canceled'];
const LIVE = ['pending', 'ordered'];
/** How far back the radar can be replayed: the forecast keeps 4 weeks of stock and consumption history. */
export const REPLAY_DAYS = 21;

/** Same consumption rule as the forecast: past = real transfers, today = max(avg, so far), future = weekday average. */
export function dayDemand(row: RadarRow, day: string, today: string) {
  const avg = row.transferAvg[isoWeekday(day) - 1] || 0;
  if (day < today) return row.actualConsumption[day] || 0;
  if (day === today) return Math.max(avg, row.actualConsumption[day] || 0);
  return avg;
}

/** Projected opening/closing per day with the given deliveries (negative balances kept, to measure shortages). */
export function project(row: RadarRow, dates: string[], today: string, ordered: Record<string, number>) {
  const net = netPendingDeliveries({ ordered, received: row.received, commitments: row.commitments, today });
  return reconcileProjection({
    dates, today, anchor: row.snapshots[today] ?? null, snapshots: row.snapshots, ordered: net,
    received: row.received, returned: row.returned, outbound: row.outbound,
    demand: dates.map((d) => dayDemand(row, d, today)), allowNegative: true,
  });
}

/** Quantity of an order as the radar last saw it on or before `day` (current quantity when never recorded). */
function quantityAt(o: RadarOrder, versions: OrderVersion[] | undefined, day: string) {
  const seen = (versions || []).filter((v) => v.seen_at.slice(0, 10) <= day);
  return seen.length ? Number(seen[seen.length - 1].quantity) || 0 : o.quantity;
}

/**
 * Supplier orders as they stood on the morning of `day`: placed by then (unknown order date counts),
 * not cancelled, quantity from the radar history when it was recorded by then.
 * On the real today this is the live order list.
 */
export function ordersAsOf(orders: RadarOrder[], day: string, today: string, history: OrderVersion[] = []): RadarOrder[] {
  if (day >= today) return orders.filter((o) => LIVE.includes(o.status));
  const byOrder = new Map<string, OrderVersion[]>();
  history.forEach((h) => { const l = byOrder.get(h.order_id) || []; l.push(h); byOrder.set(h.order_id, l); });
  return orders.filter((o) => !CANCELLED.includes(o.status) && (!o.order_date || o.order_date.slice(0, 10) <= day) && o.delivery_date >= day)
    .map((o) => ({ ...o, quantity: quantityAt(o, byOrder.get(o.id), day), status: 'ordered' }));
}

/**
 * A forecast row as known on the morning of a past `day`: stock of that morning, only movements and
 * consumption before it, the weekday average of the 4 weeks before it, and the orders placed by then.
 */
export function rowAsOf(row: RadarRow, day: string, today: string, orders: RadarOrder[]): RadarRow {
  if (day >= today) return row;
  const before = (m: Record<string, number> | undefined) => Object.fromEntries(Object.entries(m || {}).filter(([d]) => d < day));
  const actual = before(row.actualConsumption);
  const orderedPerDate: Record<string, number> = {};
  orders.forEach((o) => { if (o.product_id === row.productId) orderedPerDate[o.delivery_date] = (orderedPerDate[o.delivery_date] || 0) + o.quantity; });
  return {
    ...row, received: before(row.received), returned: before(row.returned), outbound: before(row.outbound),
    commitments: before(row.commitments), actualConsumption: actual, orderedPerDate,
    transferAvg: weekdayAverages(actual, range(addDays(day, -28), addDays(day, -1))),
  };
}

export type Phase = 'inchis' | 'azi' | 'viitor';
export interface Truck { loading: string; arrival: string; orderDay: string; deadline: string; phase: Phase }

const phaseOf = (orderDay: string, today: string, nowTime: string, cutoff: string): Phase =>
  orderDay < today || (orderDay === today && nowTime > cutoff) ? 'inchis' : orderDay === today ? 'azi' : 'viitor';

/** Loadings whose goods arrive from today on, within `horizon` days. */
export function trucks(settings: RadarSettings, today: string, nowTime: string, horizon = 10): Truck[] {
  const out: Truck[] = [];
  for (let i = -settings.transitDays; i <= horizon; i++) {
    const loading = addDays(today, i);
    if (!settings.loadingWeekdays.includes(isoWeekday(loading))) continue;
    const arrival = addDays(loading, settings.transitDays);
    if (arrival < today) continue;
    const orderDay = addDays(loading, -settings.advanceDays);
    out.push({ loading, arrival, orderDay, deadline: `${orderDay} ${settings.cutoff}`, phase: phaseOf(orderDay, today, nowTime, settings.cutoff) });
  }
  return out;
}

export type LineStatus = 'ok' | 'lipsa' | 'surplus';
export interface RadarLine {
  key: string; name: string; unit: string; productId: string | null; group: string;
  arrival: string; ordered: number; need: number; delta: number; status: LineStatus;
  /** Stock at the start of the radar day and expected at the start of the arrival day (earlier deliveries included). */
  stockToday: number | null; stockAtArrival: number;
  /** Order deadline of this line (truck order day, or arrival − product lead time) and its state. */
  orderDay: string; phase: Phase; leadTime: number;
  /** Ordered before the order day: must still be confirmed on the order day. */
  premature: boolean; reviewed: boolean;
  firstQty: number | null; orderIds: string[];
  /** How the need is built: consumption of each day until the next delivery, plus buffer, minus stock at arrival. */
  needDays: { day: string; qty: number }[]; buffer: number;
}

function buildLine(row: RadarRow, mine: RadarOrder[], arrival: string, next: string, settings: RadarSettings, today: string,
  orderDay: string, phase: Phase, byOrder: Map<string, OrderVersion[]>, checkPremature: boolean): RadarLine | null {
  const tol = settings.tolerancePct / 100;
  const ordered = mine.reduce((s, o) => s + o.quantity, 0);
  const dates = range(today, addDays(next, 1));
  const proj = project(row, dates, today, row.orderedPerDate);
  const i = dates.indexOf(arrival);
  const opening = i >= 0 ? proj[i].opening ?? 0 : 0;
  const needDays = range(arrival, addDays(next, -1)).map((d) => ({ day: d, qty: dayDemand(row, d, today) }));
  const consumption = needDays.reduce((s, d) => s + d.qty, 0);
  const need = Math.max(0, consumption + (row.buffer || 0) - Math.max(opening, 0));
  if (need <= 0 && ordered <= 0) return null;
  const delta = ordered - need;
  const short = ordered < need * (1 - tol) - 1e-9;
  const over = ordered > need * (1 + tol) + 1e-9;
  const status: LineStatus = short ? 'lipsa' : over && settings.warnSurplus ? 'surplus' : 'ok';
  const firsts = mine.map((o) => byOrder.get(o.id)?.[0]?.quantity ?? null);
  const firstQty = mine.length && firsts.every((q) => q !== null) ? firsts.reduce((s, q) => s + (q as number), 0) : null;
  const premature = checkPremature && mine.some((o) => !!o.order_date && o.order_date.slice(0, 10) < orderDay);
  const reviewed = checkPremature && mine.some((o) => (o.order_date ?? '').slice(0, 10) >= orderDay
    || (byOrder.get(o.id) || []).some((h, k) => k > 0 && h.seen_at.slice(0, 10) >= orderDay));
  return {
    key: row.key, name: row.name, unit: row.unit, productId: row.productId, group: row.group || OTHER_RANGE, arrival, ordered, need, delta, status,
    stockToday: proj[0]?.opening ?? null, stockAtArrival: opening, orderDay, phase, leadTime: Math.round(row.leadTime ?? 0),
    premature, reviewed, firstQty, orderIds: mine.map((o) => o.id), needDays, buffer: row.buffer || 0,
  };
}

const versionsByOrder = (history: OrderVersion[]) => {
  const m = new Map<string, OrderVersion[]>();
  history.forEach((h) => { const l = m.get(h.order_id) || []; l.push(h); m.set(h.order_id, l); });
  return m;
};
const sortLines = (out: RadarLine[]) => out.sort((a, b) => Math.abs(b.delta) / Math.max(b.need, 1) - Math.abs(a.delta) / Math.max(a.need, 1));

/**
 * Truck rules (raw materials): need of one truck = consumption from its arrival until the next arrival
 * + one day of buffer − stock expected at arrival (with earlier deliveries). Ordered = orders due that day.
 * `orders` must already be the active ones (see ordersAsOf).
 */
export function truckLines(rows: RadarRow[], orders: RadarOrder[], truck: Truck, next: string, settings: RadarSettings,
  today: string, history: OrderVersion[] = []): RadarLine[] {
  const byOrder = versionsByOrder(history);
  const out: RadarLine[] = [];
  for (const row of rows) {
    if (!row.productId) continue;
    const mine = orders.filter((o) => o.product_id === row.productId && o.delivery_date === truck.arrival);
    const line = buildLine(row, mine, truck.arrival, next, settings, today, truck.orderDay, truck.phase, byOrder, true);
    if (line) out.push(line);
  }
  return sortLines(out);
}

/**
 * Product lead-time rules (packaging/labels): each product is checked on every day an order of it arrives
 * and on the first delivery day it runs below its buffer. Need = consumption until its next delivery
 * (or 7 days) + buffer − stock at that day; deadline = that day − the product's own lead time.
 */
export function productLines(rows: RadarRow[], orders: RadarOrder[], settings: RadarSettings, today: string, nowTime: string,
  horizonEnd: string, history: OrderVersion[] = []): RadarLine[] {
  const byOrder = versionsByOrder(history);
  const out: RadarLine[] = [];
  const days = range(today, horizonEnd);
  for (const row of rows) {
    if (!row.productId) continue;
    const lead = Math.max(0, Math.round(row.leadTime ?? 0));
    const mine = orders.filter((o) => o.product_id === row.productId && o.delivery_date >= today && o.delivery_date <= horizonEnd);
    const arrivals = [...new Set(mine.map((o) => o.delivery_date))].sort();
    const proj = project(row, days, today, row.orderedPerDate);
    const firstShort = days.find((d, k) => settings.loadingWeekdays.includes(isoWeekday(d)) && !arrivals.includes(d)
      && (proj[k].closing ?? 0) < (row.buffer || 0) - 1e-9);
    const checkDays = [...arrivals, ...(firstShort ? [firstShort] : [])].sort();
    for (const day of checkDays) {
      const later = arrivals.find((a) => a > day);
      const next = later && later <= addDays(day, 7) ? later : addDays(day, 7);
      const orderDay = addDays(day, -lead);
      const line = buildLine(row, mine.filter((o) => o.delivery_date === day), day, next, settings, today, orderDay,
        phaseOf(orderDay, today, nowTime, settings.cutoff), byOrder, false);
      if (line) out.push(line);
    }
  }
  return sortLines(out);
}

/** Traffic light of one truck/day: red = shortage whose order deadline passed or is today, yellow = anything to review. */
export function truckLight(lines: RadarLine[]): 'rosu' | 'galben' | 'verde' {
  if (lines.some((l) => l.status === 'lipsa' && l.phase !== 'viitor')) return 'rosu';
  if (lines.some((l) => l.status !== 'ok' || (l.phase !== 'inchis' && l.premature && !l.reviewed))) return 'galben';
  return 'verde';
}

export interface DelayImpact { key: string; name: string; unit: string; group: string; shortage: number; firstDay: string }

/** Moves every delivery due `arrival` by `days` and lists products whose stock goes below zero meanwhile. */
export function delayImpact(rows: RadarRow[], arrival: string, days: number, today: string): DelayImpact[] {
  const out: DelayImpact[] = [];
  const dates = range(today, addDays(arrival, days + 1));
  for (const row of rows) {
    const qty = row.orderedPerDate[arrival] || 0;
    if (!qty) continue;
    const moved = { ...row.orderedPerDate, [arrival]: 0 };
    moved[addDays(arrival, days)] = (moved[addDays(arrival, days)] || 0) + qty;
    const base = project(row, dates, today, row.orderedPerDate);
    const sim = project(row, dates, today, moved);
    let worst = 0; let firstDay = '';
    sim.forEach((p, k) => {
      if (dates[k] < arrival) return;
      const short = Math.min(0, p.closing ?? 0) - Math.min(0, base[k].closing ?? 0);
      if (short < -1e-9 && !firstDay) firstDay = dates[k];
      worst = Math.min(worst, short);
    });
    if (worst < -1e-9) out.push({ key: row.key, name: row.name, unit: row.unit, group: row.group || OTHER_RANGE, shortage: -worst, firstDay });
  }
  return out.sort((a, b) => b.shortage - a.shortage);
}

export const OTHER_RANGE = 'Altele';
/** Groups items by product range in the same order as the Achiziții forecast; order inside a range is kept. */
export function byRange<T extends { group: string }>(items: T[], type: RadarInvType): { group: string; items: T[] }[] {
  const base = type === 'materii-prime' ? FORECAST_GROUP_ORDER : PACK_TYPES.map(([g]) => g);
  const present = [...new Set(items.map((i) => i.group))];
  const order = [...base.filter((g) => present.includes(g)),
    ...present.filter((g) => !base.includes(g) && g !== OTHER_RANGE).sort((a, b) => a.localeCompare(b, 'ro')),
    ...(present.includes(OTHER_RANGE) && !base.includes(OTHER_RANGE) ? [OTHER_RANGE] : [])];
  return order.map((g) => ({ group: g, items: items.filter((i) => i.group === g) }));
}
