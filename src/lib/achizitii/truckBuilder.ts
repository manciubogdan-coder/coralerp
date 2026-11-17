// Truck composer (raw materials from Italy). Loading Mon–Sat, 1 day transit → arrivals Tue–Sun (no Sunday loading,
// so no Monday arrival). Goods that arrive on a day are used in production the next day, so each arrival covers the
// production days after it up to and including the next arrival day: Sunday's truck covers Monday and Tuesday,
// Saturday's truck covers Sunday only. Need per production day = what the forecast projection lacks to keep the buffer
// (sequential, no double count). Perishables (leaf salads, herbs) never move; only sturdy goods (heads 400 kg/pal,
// radicchio 500 kg/pal) are pulled at most LOOK_DAYS earlier to fill a truck or pushed one truck earlier on overflow.
// Tiny days (< TINY pallets) merge into the previous truck instead of running an almost empty truck.
// One truck per day: a truck over the maximum first sends goods back onto the earlier trucks that still have room
// (heads/radicchio up to MAX_AGE_STURDY days before use, leaves/herbs only one truck earlier and never older than the
// Saturday→Tuesday goods), and only what still does not fit needs a second truck.
import { project, addDays, isoWeekday, type RadarRow } from './truckRadar';
import { palletKgFor, sequentialOrderPlan } from '../forecastGroups';

export const TRUCK_MIN = 22;
export const TRUCK_MAX = 26;
/** Below this many pallets a day gets no own truck (merged into the previous one). */
export const TINY = 3;
/** Sturdy goods may arrive at most this many days before they are needed. */
export const LOOK_DAYS = 2;
const EPS = 0.05;
/** Max days between arrival and production when a full truck sends goods earlier (Saturday → Tuesday = 3). */
export const MAX_AGE_PERISHABLE = 3;
export const MAX_AGE_STURDY = 5;
/** Days shown in the truck plan (two weeks ahead). */
export const HORIZON = 14;

/** Trucks from Italy load Mon–Sat and arrive the next day: Tuesday to Sunday (no Monday arrival). */
export const isArrivalDay = (d: string) => isoWeekday(d) !== 1;
/** Truck that must bring the goods for production on `day`: the last arrival before that day. */
export function arrivalFor(day: string, isArrival: (d: string) => boolean = isArrivalDay): string {
  let d = addDays(day, -1);
  for (let i = 0; i < 7 && !isArrival(d); i++) d = addDays(d, -1);
  return d;
}

/** Only heads (400 kg/pal) and radicchio (500 kg/pal) last long enough to arrive early. */
export const isSturdy = (name: string) => (palletKgFor(name) ?? 0) >= 400;

export interface TruckItem {
  key: string; name: string; kg: number; per: number; sturdy: boolean;
  /** Already ordered at the supplier for this day (not moved except when a tiny day is merged). */
  ordered: boolean;
  /** Production day the goods are needed for (delivery day for goods already ordered). */
  due: string;
  /** Truck day the goods were moved from (fill / overflow suggestions). */
  movedFrom?: string;
}
export type MoveKind = 'fill' | 'overflow' | 'merge' | 'level';
export interface TruckMove { id: string; kind: MoveKind; from: string; to: string; pallets: number; kg: number; names: string[] }
export type TruckStatus = 'full' | 'under' | 'over' | 'merged' | 'empty';
export interface TruckDay {
  day: string; items: TruckItem[]; pallets: number; perishable: number; sturdy: number; ordered: number;
  trucks: number; status: TruckStatus; missing: number; over: number; mergedInto?: string;
  movesIn: TruckMove[]; movesOut: TruckMove[]; noNorm: string[];
}

const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));
const pal = (items: TruckItem[], f: (i: TruckItem) => boolean = () => true) => items.reduce((s, i) => s + (f(i) ? i.kg / i.per : 0), 0);
const movable = (i: TruckItem) => i.sturdy && !i.ordered;
/** Last day the supplier order for a truck can still be changed: one day before loading (arrival − 2). */
export const orderDeadline = (arrival: string) => addDays(arrival, -2);
/** Totals and status of one truck day from its items (also used after the buyer edits a truck). */
export function summarizeTruck(items: TruckItem[], merged = false, min = TRUCK_MIN, max = TRUCK_MAX) {
  const pallets = pal(items);
  const trucks = merged || pallets <= EPS ? 0 : Math.max(1, Math.ceil((pallets - EPS) / max));
  const status: TruckStatus = merged ? 'merged' : pallets <= EPS ? 'empty' : pallets < min - EPS ? 'under' : pallets > max + EPS ? 'over' : 'full';
  return {
    pallets, trucks, status,
    perishable: pal(items, (i) => !i.sturdy), sturdy: pal(items, (i) => i.sturdy), ordered: pal(items, (i) => i.ordered),
    missing: status === 'under' ? min - pallets : 0, over: status === 'over' ? pallets - max : 0,
  };
}
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

export interface DailyPlanStep {
  day: string;
  /** Projected closing stock of the day with the orders already placed, before any new suggestion. */
  closing: number;
  /** Already covered by suggestions for earlier delivery days. */
  earlier: number;
  /** Stock the day must end with (buffer). */
  target: number;
  /** Quantity to bring on this day. */
  qty: number;
}

/**
 * Per-day order plan of each product, arrival day by arrival day (kg), same projection as the forecast.
 * Shared by the truck panel and the forecast table so both always show the same quantity.
 */
export function dailyPlan(row: RadarRow, days: string[], today: string): DailyPlanStep[] {
  const proj = project(row, days, today, row.orderedPerDate);
  const closings = proj.map((p) => p.closing ?? 0);
  const target = row.buffer || 0;
  const plan = sequentialOrderPlan(closings, days.map(() => target));
  let earlier = 0;
  return days.map((day, i) => {
    const qty = plan[i] || 0;
    const step = { day, closing: closings[i], earlier, target, qty };
    earlier += qty;
    return step;
  });
}

export function dailyOrders(row: RadarRow, days: string[], today: string): number[] {
  return dailyPlan(row, days, today).map((s) => s.qty);
}

export interface ComposeOptions {
  horizon?: number; min?: number; max?: number;
  /** Move ids the buyer turned down ("Nu muta"). */
  refused?: Set<string>;
  arrivalDay?: (d: string) => boolean;
}

export function composeWeek(rows: RadarRow[], today: string, opts: ComposeOptions = {}): TruckDay[] {
  const { horizon = HORIZON, min = TRUCK_MIN, max = TRUCK_MAX, refused = new Set<string>(), arrivalDay = isArrivalDay } = opts;
  const days = range(today, horizon + LOOK_DAYS + 5);
  const loading = days.filter(arrivalDay);
  if (!loading.length) return [];
  /** Truck of goods already ordered for delivery on `d`. */
  const slotOf = (d: string) => [...loading].reverse().find((l) => l <= d) ?? loading[0];
  /** Truck that must bring the need of production day `d` (late needs go on the first truck). */
  const needSlot = (d: string) => { const a = arrivalFor(d, arrivalDay); return a >= loading[0] ? slotOf(a) : loading[0]; };
  const bucket = new Map<string, TruckItem[]>(loading.map((l) => [l, []]));
  const noNorm = new Map<string, Set<string>>(loading.map((l) => [l, new Set()]));
  const add = (slot: string, it: TruckItem) => {
    const list = bucket.get(slot)!;
    const same = list.find((x) => x.key === it.key && x.ordered === it.ordered && !x.movedFrom && !it.movedFrom);
    if (same) { same.kg += it.kg; if (it.due < same.due) same.due = it.due; } else list.push(it);
  };

  rows.filter((r) => r.productId && (r.unit || 'kg').toLowerCase() === 'kg').forEach((r) => {
    const per = palletKgFor(r.name);
    const plan = dailyOrders(r, days, today);
    days.forEach((d, i) => {
      const ord = r.orderedPerDate?.[d] || 0;
      if (!per) {
        if (ord > 0) noNorm.get(slotOf(d))!.add(r.name);
        if (plan[i] > 0) noNorm.get(needSlot(d))!.add(r.name);
        return;
      }
      const base = { key: r.key, name: r.name, per, sturdy: isSturdy(r.name), due: d };
      if (ord > 0) add(slotOf(d), { ...base, kg: ord, ordered: true });
      if (plan[i] > 0) add(needSlot(d), { ...base, kg: Math.ceil(plan[i]), ordered: false });
    });
  });

  const moves: TruckMove[] = [];
  const merged = new Map<string, string>();
  /** Move up to `pallets` of sturdy, not yet ordered goods (earliest need first) from one truck to another. */
  const byNeed = (a: TruckItem, b: TruckItem) => a.due.localeCompare(b.due) || b.per - a.per || b.kg - a.kg;
  const shift = (from: string, to: string, pallets: number, kind: MoveKind, id: string,
    pick: (i: TruckItem) => boolean = movable, order: (a: TruckItem, b: TruckItem) => number = byNeed) => {
    let left = pallets; let kg = 0; let moved = 0; const names = new Set<string>();
    const src = bucket.get(from)!;
    const cand = src.filter(pick).sort(order);
    for (const it of cand) {
      if (left <= EPS) break;
      const take = Math.min(it.kg, Math.round(left * it.per));
      if (take <= 0) continue;
      it.kg -= take; left -= take / it.per; kg += take; moved += take / it.per; names.add(it.name);
      bucket.get(to)!.push({ ...it, kg: take, movedFrom: from });
    }
    bucket.set(from, src.filter((i) => i.kg > 0));
    if (moved > EPS) moves.push({ id, kind, from, to, pallets: moved, kg, names: [...names] });
  };

  const visible = loading.filter((d) => d < addDays(today, horizon));

  // 1. Tiny days ride on the previous truck (perishables arrive at most one truck earlier).
  visible.forEach((d, k) => {
    const p = pal(bucket.get(d)!);
    const prev = visible[k - 1];
    const id = `merge:${d}>${prev}`;
    if (p <= EPS || p >= TINY || !prev || merged.has(prev) || refused.has(id) || dayDiff(prev, d) > 2) return;
    // No room on the previous truck: first make room by sending its sturdy goods one truck earlier.
    const excess = pal(bucket.get(prev)!) + p - max;
    const before = visible[k - 2];
    const roomId = `over:${prev}>${before}`;
    if (excess > EPS && before && !merged.has(before) && !refused.has(roomId) && dayDiff(before, prev) <= LOOK_DAYS) {
      const room = max - pal(bucket.get(before)!);
      if (Math.min(room, pal(bucket.get(prev)!, movable)) >= excess - EPS) shift(prev, before, excess, 'overflow', roomId);
    }
    if (pal(bucket.get(prev)!) + p > max + EPS) return;
    const items = bucket.get(d)!;
    bucket.get(prev)!.push(...items.map((i) => ({ ...i, movedFrom: d })));
    moves.push({ id, kind: 'merge', from: d, to: prev, pallets: p, kg: items.reduce((s, i) => s + i.kg, 0), names: [...new Set(items.map((i) => i.name))] });
    bucket.set(d, []);
    const nn = noNorm.get(d)!; nn.forEach((n) => noNorm.get(prev)!.add(n)); nn.clear();
    merged.set(d, prev);
  });

  // 2. One truck per day: a truck over the maximum sends goods back onto earlier trucks with room, closest first.
  // Heads/radicchio first, then leaves/herbs needed soonest (only to the truck right before, at most 3 days old).
  // Trucks arriving today or tomorrow are already loaded/closed and take nothing more.
  const closed = addDays(today, 1);
  const sturdyFirst = (a: TruckItem, b: TruckItem) => Number(b.sturdy) - Number(a.sturdy) || byNeed(a, b);
  visible.forEach((d, k) => {
    if (merged.has(d)) return;
    for (let j = k - 1; j >= 0; j--) {
      const excess = pal(bucket.get(d)!) - max;
      if (excess <= EPS) break;
      const t = visible[j];
      if (t <= closed) break;
      if (merged.has(t)) continue;
      const id = `level:${d}>${t}`;
      if (refused.has(id)) continue;
      const room = max - pal(bucket.get(t)!);
      if (room <= EPS) continue;
      const nextTruck = visible.slice(j + 1, k).every((x) => merged.has(x));
      const pick = (i: TruckItem) => !i.ordered && (i.sturdy
        ? dayDiff(t, i.due) <= MAX_AGE_STURDY
        : nextTruck && dayDiff(t, i.due) <= MAX_AGE_PERISHABLE);
      shift(d, t, Math.min(excess, room), 'level', id, pick, sturdyFirst);
    }
  });

  // 3. Trucks under the minimum take sturdy goods from the next trucks, without pushing those under the minimum.
  visible.forEach((d) => {
    if (merged.has(d)) return;
    const p = pal(bucket.get(d)!);
    if (p <= EPS || p >= min - EPS) return;
    let need = min - p;
    for (const j of loading) {
      if (need <= EPS) break;
      if (j <= d || merged.has(j) || dayDiff(d, j) > LOOK_DAYS) continue;
      const id = `fill:${j}>${d}`;
      if (refused.has(id)) continue;
      const pj = pal(bucket.get(j)!);
      const take = Math.min(need, pal(bucket.get(j)!, movable), Math.max(0, pj - min));
      if (take <= EPS) continue;
      const before = pal(bucket.get(d)!);
      shift(j, d, take, 'fill', id);
      need -= pal(bucket.get(d)!) - before;
    }
  });

  return visible.map((day) => {
    const items = bucket.get(day)!.sort((a, b) => b.kg / b.per - a.kg / a.per);
    return {
      day, items, ...summarizeTruck(items, merged.has(day), min, max), mergedInto: merged.get(day),
      movesIn: moves.filter((m) => m.to === day), movesOut: moves.filter((m) => m.from === day),
      noNorm: [...noNorm.get(day)!],
    };
  });
}

export interface TruckLine {
  key: string; name: string; sturdy: boolean; per: number;
  /** Already ordered at the supplier / still to order (kg). */
  ordered: number; toOrder: number;
  /** Production days the goods are for, and trucks they were moved from. */
  dues: string[]; from: string[];
}
/** One line per product of a truck (what the panel, the Excel export and the supplier order show). */
export function truckLines(items: TruckItem[]): TruckLine[] {
  const m = new Map<string, TruckLine>();
  items.forEach((i) => {
    const e = m.get(i.key) ?? { key: i.key, name: i.name, sturdy: i.sturdy, per: i.per, ordered: 0, toOrder: 0, dues: [], from: [] };
    if (i.ordered) e.ordered += i.kg; else e.toOrder += i.kg;
    if (!e.dues.includes(i.due)) e.dues.push(i.due);
    if (i.movedFrom && !e.from.includes(i.movedFrom)) e.from.push(i.movedFrom);
    m.set(i.key, e);
  });
  return [...m.values()].map((l) => ({ ...l, dues: l.dues.sort() }))
    .sort((a, b) => (b.ordered + b.toOrder) / b.per - (a.ordered + a.toOrder) / a.per);
}
