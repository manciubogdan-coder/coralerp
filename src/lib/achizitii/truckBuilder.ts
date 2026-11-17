// Truck composer (raw materials): what to order per delivery day so each truck is full enough.
// Per product the day's order = what the projection lacks to keep the buffer (sequential, no double count);
// when a day's truck is under the minimum, sturdy goods (not leaf salads) are pulled forward from later days.
import { project, addDays, type RadarRow } from './truckRadar';
import { palletKgFor, sequentialOrderPlan } from '../forecastGroups';
import { isLeafSalad } from '../leafStockAge';

export const TRUCK_MIN = 22;
export const TRUCK_MAX = 26;

export interface TruckItem { key: string; name: string; kg: number; pallets: number; sturdy: boolean; fromDay?: string }
export interface TruckDay {
  day: string; orderedPallets: number; items: TruckItem[]; pallets: number; trucks: number;
  /** Pallets missing until the minimum of the last truck (0 when full). */
  missing: number; pullForward: TruckItem[]; noNorm: string[];
}

const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

/** Per-day order plan of each product (kg), same projection as the forecast. */
export function dailyOrders(row: RadarRow, days: string[], today: string): number[] {
  const proj = project(row, days, today, row.orderedPerDate);
  const closings = proj.map((p) => p.closing ?? 0);
  return sequentialOrderPlan(closings, days.map(() => row.buffer || 0)).map((q) => q || 0);
}

export function composeTrucks(rows: RadarRow[], today: string, horizon = 7, lookAhead = 3,
  min = TRUCK_MIN, max = TRUCK_MAX, loadingDay: (d: string) => boolean = () => true): TruckDay[] {
  const days = range(today, horizon + lookAhead);
  const plans = rows.filter((r) => r.productId && (r.unit || 'kg').toLowerCase() === 'kg').map((r) => ({ r, plan: dailyOrders(r, days, today), per: palletKgFor(r.name) }));
  const out: TruckDay[] = [];
  days.slice(0, horizon).forEach((day, k) => {
    if (!loadingDay(day)) return;
    const items: TruckItem[] = []; const noNorm: string[] = []; let orderedPallets = 0;
    plans.forEach(({ r, plan, per }) => {
      if (!per) { if (plan[k] > 0) noNorm.push(r.name); return; }
      orderedPallets += (r.orderedPerDate[day] || 0) / per;
      if (plan[k] > 0) items.push({ key: r.key, name: r.name, kg: plan[k], pallets: plan[k] / per, sturdy: !isLeafSalad(r.name) });
    });
    const pallets = orderedPallets + items.reduce((s, i) => s + i.pallets, 0);
    const trucks = Math.max(1, Math.ceil(pallets / max - 1e-9));
    const rest = pallets - (trucks - 1) * max;
    const missing = pallets > 0 && rest < min ? min - rest : 0;
    const pullForward: TruckItem[] = [];
    if (missing > 0) {
      let left = missing;
      for (let j = k + 1; j <= k + lookAhead && j < days.length && left > 1e-9; j++) {
        for (const { r, plan, per } of plans) {
          if (!per || isLeafSalad(r.name) || plan[j] <= 0 || left <= 1e-9) continue;
          const take = Math.min(plan[j] / per, left);
          pullForward.push({ key: r.key, name: r.name, kg: take * per, pallets: take, sturdy: true, fromDay: days[j] });
          left -= take;
        }
      }
    }
    out.push({ day, orderedPallets, items: items.sort((a, b) => b.pallets - a.pallets), pallets, trucks, missing, pullForward, noNorm });
  });
  return out;
}
