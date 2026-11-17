// Truck composer (raw materials, one truck from Italy every day Mon–Sat).
// Each product's need per day = what the forecast projection lacks to keep the buffer (sequential, no double count).
// Perishables (leaf salads, herbs, anything without a 400/500 kg pallet norm) always travel on the truck of the day
// they are needed; Sunday's need rides on Saturday. Only sturdy goods (heads 400 kg/pal, radicchio 500 kg/pal) move:
// pulled at most LOOK_DAYS earlier to fill a truck under the minimum, or pushed one truck earlier when a day overflows.
// Tiny days (< TINY pallets) merge into the previous truck instead of running an almost empty truck.
import { project, addDays, isoWeekday, type RadarRow } from './truckRadar';
import { palletKgFor, sequentialOrderPlan } from '../forecastGroups';

export const TRUCK_MIN = 22;
export const TRUCK_MAX = 26;
/** Below this many pallets a day gets no own truck (merged into the previous one). */
export const TINY = 3;
/** Sturdy goods may arrive at most this many days before they are needed. */
export const LOOK_DAYS = 2;
const EPS = 0.05;
/** Days shown in the truck plan (two weeks ahead). */
export const HORIZON = 14;

/** Only heads (400 kg/pal) and radicchio (500 kg/pal) last long enough to arrive early. */
export const isSturdy = (name: string) => (palletKgFor(name) ?? 0) >= 400;

export interface TruckItem {
  key: string; name: string; kg: number; per: number; sturdy: boolean;
  /** Already ordered at the supplier for this day (not moved except when a tiny day is merged). */
  ordered: boolean;
  /** Day the goods are needed. */
  due: string;
  /** Truck day the goods were moved from (fill / overflow suggestions). */
  movedFrom?: string;
}
export type MoveKind = 'fill' | 'overflow' | 'merge';
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
  loadingDay?: (d: string) => boolean;
}

export function composeWeek(rows: RadarRow[], today: string, opts: ComposeOptions = {}): TruckDay[] {
  const { horizon = HORIZON, min = TRUCK_MIN, max = TRUCK_MAX, refused = new Set<string>(), loadingDay = (d) => isoWeekday(d) !== 7 } = opts;
  const days = range(today, horizon + LOOK_DAYS + 2);
  const loading = days.filter(loadingDay);
  if (!loading.length) return [];
  const slotOf = (d: string) => [...loading].reverse().find((l) => l <= d) ?? loading[0];
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
      const slot = slotOf(d);
      const ord = r.orderedPerDate?.[d] || 0;
      if (!per) { if (plan[i] > 0 || ord > 0) noNorm.get(slot)!.add(r.name); return; }
      const base = { key: r.key, name: r.name, per, sturdy: isSturdy(r.name), due: d };
      if (ord > 0) add(slot, { ...base, kg: ord, ordered: true });
      if (plan[i] > 0) add(slot, { ...base, kg: Math.ceil(plan[i]), ordered: false });
    });
  });

  const moves: TruckMove[] = [];
  const merged = new Map<string, string>();
  /** Move up to `pallets` of sturdy, not yet ordered goods (earliest need first) from one truck to another. */
  const shift = (from: string, to: string, pallets: number, kind: MoveKind, id: string) => {
    let left = pallets; let kg = 0; let moved = 0; const names = new Set<string>();
    const src = bucket.get(from)!;
    const cand = src.filter(movable).sort((a, b) => a.due.localeCompare(b.due) || b.per - a.per || b.kg - a.kg);
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

  // 2. Trucks under the minimum take sturdy goods from the next trucks, without pushing those under the minimum.
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

  // 3. Trucks over the maximum send sturdy goods one truck earlier when that one has room.
  visible.forEach((d, k) => {
    if (merged.has(d)) return;
    const p = pal(bucket.get(d)!);
    const prev = visible[k - 1];
    if (p <= max + EPS || !prev || merged.has(prev)) return;
    const id = `over:${d}>${prev}`;
    if (refused.has(id)) return;
    const take = Math.min(p - max, max - pal(bucket.get(prev)!), pal(bucket.get(d)!, movable));
    if (take > EPS) shift(d, prev, take, 'overflow', id);
  });

  return visible.map((day) => {
    const items = bucket.get(day)!.sort((a, b) => b.kg / b.per - a.kg / a.per);
    const pallets = pal(items);
    const trucks = merged.has(day) || pallets <= EPS ? 0 : Math.max(1, Math.ceil((pallets - EPS) / max));
    const status: TruckStatus = merged.has(day) ? 'merged' : pallets <= EPS ? 'empty' : pallets < min - EPS ? 'under' : pallets > max + EPS ? 'over' : 'full';
    return {
      day, items, pallets, trucks, status, mergedInto: merged.get(day),
      perishable: pal(items, (i) => !i.sturdy), sturdy: pal(items, (i) => i.sturdy), ordered: pal(items, (i) => i.ordered),
      missing: status === 'under' ? min - pallets : 0, over: status === 'over' ? pallets - max : 0,
      movesIn: moves.filter((m) => m.to === day), movesOut: moves.filter((m) => m.from === day),
      noNorm: [...noNorm.get(day)!],
    };
  });
}
