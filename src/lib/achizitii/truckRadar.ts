// Purchasing control radar: per loading truck, compares what was ordered with what the
// forecast needs now, checks the order was finalised on its order day, and simulates delays.
// Pure rules (no React); consumption follows the same rules as the Achiziții forecast.
import { netPendingDeliveries, reconcileProjection } from '@/lib/forecastReconciliation';
import type { RadarSettings } from '../../../supabase/functions/_shared/truckRadarRules';
export { DEFAULT_RADAR_SETTINGS, validRadarSettings } from '../../../supabase/functions/_shared/truckRadarRules';
export type { RadarSettings };

export interface RadarRow {
  key: string; name: string; unit: string; productId: string | null;
  snapshots: Record<string, number>; received: Record<string, number>; returned: Record<string, number>;
  outbound: Record<string, number>; commitments: Record<string, number>; orderedPerDate: Record<string, number>;
  transferAvg: number[]; actualConsumption: Record<string, number>; buffer?: number;
}
export interface RadarOrder { id: string; product_id: string | null; quantity: number; delivery_date: string; order_date: string | null; status: string }
export interface OrderVersion { order_id: string; quantity: number; delivery_date: string | null; status: string | null; seen_at: string }

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
export const isoWeekday = (day: string) => ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const range = (from: string, to: string) => { const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };

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

export interface Truck { loading: string; arrival: string; orderDay: string; deadline: string; phase: 'inchis' | 'azi' | 'viitor' }

/** Loadings whose goods arrive from today on, within `horizon` days. */
export function trucks(settings: RadarSettings, today: string, nowTime: string, horizon = 10): Truck[] {
  const out: Truck[] = [];
  for (let i = -settings.transitDays; i <= horizon; i++) {
    const loading = addDays(today, i);
    if (!settings.loadingWeekdays.includes(isoWeekday(loading))) continue;
    const arrival = addDays(loading, settings.transitDays);
    if (arrival < today) continue;
    const orderDay = addDays(loading, -settings.advanceDays);
    const closed = orderDay < today || (orderDay === today && nowTime > settings.cutoff);
    out.push({ loading, arrival, orderDay, deadline: `${orderDay} ${settings.cutoff}`, phase: closed ? 'inchis' : orderDay === today ? 'azi' : 'viitor' });
  }
  return out;
}

export type LineStatus = 'ok' | 'lipsa' | 'surplus';
export interface RadarLine {
  key: string; name: string; unit: string; productId: string | null;
  ordered: number; need: number; delta: number; status: LineStatus;
  /** Ordered before the order day: must still be confirmed on the order day. */
  premature: boolean; reviewed: boolean;
  firstQty: number | null; orderIds: string[];
}

/**
 * Need of one truck = consumption from its arrival until the next arrival + one day of buffer
 * − stock expected at arrival (with earlier deliveries). Ordered = supplier orders due that day.
 */
export function truckLines(rows: RadarRow[], orders: RadarOrder[], truck: Truck, next: string, settings: RadarSettings,
  today: string, history: OrderVersion[] = []): RadarLine[] {
  const active = orders.filter((o) => ['pending', 'ordered'].includes(o.status));
  const byOrder = new Map<string, OrderVersion[]>();
  history.forEach((h) => { const l = byOrder.get(h.order_id) || []; l.push(h); byOrder.set(h.order_id, l); });
  const tol = settings.tolerancePct / 100;
  const out: RadarLine[] = [];
  for (const row of rows) {
    if (!row.productId) continue;
    const mine = active.filter((o) => o.product_id === row.productId && o.delivery_date === truck.arrival);
    const ordered = mine.reduce((s, o) => s + o.quantity, 0);
    const dates = range(today, addDays(next, 1));
    const proj = project(row, dates, today, row.orderedPerDate);
    const i = dates.indexOf(truck.arrival);
    const opening = i >= 0 ? proj[i].opening ?? 0 : 0;
    const consumption = range(truck.arrival, addDays(next, -1)).reduce((s, d) => s + dayDemand(row, d, today), 0);
    const need = Math.max(0, consumption + (row.buffer || 0) - Math.max(opening, 0));
    if (need <= 0 && ordered <= 0) continue;
    const delta = ordered - need;
    const status: LineStatus = ordered < need * (1 - tol) - 1e-9 ? 'lipsa' : ordered > need * (1 + tol) + 1e-9 ? 'surplus' : 'ok';
    const firsts = mine.map((o) => byOrder.get(o.id)?.[0]?.quantity ?? null);
    const firstQty = mine.length && firsts.every((q) => q !== null) ? firsts.reduce((s, q) => s + (q as number), 0) : null;
    const premature = mine.some((o) => !!o.order_date && o.order_date.slice(0, 10) < truck.orderDay);
    const reviewed = mine.some((o) => (o.order_date ?? '').slice(0, 10) >= truck.orderDay
      || (byOrder.get(o.id) || []).some((h, k) => k > 0 && h.seen_at.slice(0, 10) >= truck.orderDay));
    out.push({ key: row.key, name: row.name, unit: row.unit, productId: row.productId, ordered, need, delta, status, premature, reviewed, firstQty, orderIds: mine.map((o) => o.id) });
  }
  return out.sort((a, b) => Math.abs(b.delta) / Math.max(b.need, 1) - Math.abs(a.delta) / Math.max(a.need, 1));
}

/** Traffic light of one truck: red = shortage on a closed/today truck, yellow = anything to review. */
export function truckLight(truck: Truck, lines: RadarLine[]): 'rosu' | 'galben' | 'verde' {
  if (lines.some((l) => l.status === 'lipsa') && truck.phase !== 'viitor') return 'rosu';
  if (lines.some((l) => l.status !== 'ok' || (truck.phase !== 'inchis' && l.premature && !l.reviewed))) return 'galben';
  return 'verde';
}

export interface DelayImpact { key: string; name: string; unit: string; shortage: number; firstDay: string }

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
    if (worst < -1e-9) out.push({ key: row.key, name: row.name, unit: row.unit, shortage: -worst, firstDay });
  }
  return out.sort((a, b) => b.shortage - a.shortage);
}
