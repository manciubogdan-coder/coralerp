// One deterministic daily projection for Achiziții and Argus; no React, SDK or runtime dependencies.
export const projectionMaterialKey = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
export const projectionQuantity = (quantity: unknown, unit?: string) => {
  const q = Number(quantity) || 0, u = (unit || '').toLowerCase();
  return ['g', 'gr', 'grame'].includes(u) ? q / 1000 : ['t', 'tone'].includes(u) ? q * 1000 : q;
};
export const projectionTransferQuantity = (item: {net_quantity?: unknown; quantity?: unknown; unit?: string}, unit?: string) => projectionQuantity(item.net_quantity ?? item.quantity, item.unit || unit);
export const projectionConsumptionDestination = (destination?: string | null) => {
  const name = projectionMaterialKey(destination || ''); return name.includes('produc') || name.includes('picking');
};
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

/** Seven completed Bucharest calendar days, using the same actual consumption as the projection. */
export function sevenDayBuffer(consumption: Record<string, number>, today: string) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(today, i - 7);
    return { day, quantity: consumption[day] || 0 };
  });
  const total = days.reduce((sum, d) => sum + d.quantity, 0);
  return { days, total, average: total / 7 };
}
/**
 * Supplier deliveries still to come, per delivery day: today and later count exactly as ordered.
 * Each day stands alone — a day with a receipt counts the receipt (see reconcileProjection),
 * a day without one counts its order. Receipts of earlier days never cancel later orders.
 */
export function netPendingDeliveries(input: {
  ordered: Record<string, number>; received?: Record<string, number>;
  commitments?: Record<string, number>; today: string;
}) {
  const result: Record<string, number> = {};
  for (const [day, qty] of Object.entries(input.ordered)) if (day >= input.today) result[day] = qty || 0;
  return result;
}

export function reconcileProjection(input: {
  dates: string[]; today: string; anchor: number | null;
  snapshots: Record<string, number>; ordered: Record<string, number>;
  received: Record<string, number>; outbound: Record<string, number>; returned?: Record<string, number>;
  /** Consumption per day from client orders × recipes (estimated average where no orders exist). */
  demand: number[];
  /** Future days (after today) carry a negative balance instead of restarting from zero (packaging/labels requirement view). */
  allowNegative?: boolean;
}) {
  let running: number | null = input.anchor;
  return input.dates.map((day, i) => {
    const historical = day < input.today;
    const observed = input.snapshots[day] ?? null;
    const carryNegative = !!input.allowNegative && day > input.today;
    // Anchor once; subsequent days carry the calculated closing, not a different snapshot.
    // Preserve unknown historical openings; restart from a dated observation if no balance exists.
    const opening: number | null = i > 0 && running !== null ? (carryNegative ? running : Math.max(running, 0))
      : historical ? observed
      : day === input.today ? Math.max(observed ?? 0, 0)
      : Math.max(running ?? 0, 0);
    const hasReceipt = Object.prototype.hasOwnProperty.call(input.received, day);
    const incoming = (hasReceipt ? input.received[day] || 0 : historical ? 0 : input.ordered[day] || 0)
      + (input.returned?.[day] || 0);
    const consumption = input.demand[i] || 0;
    const closing = opening === null ? null : opening + incoming - consumption;
    const nextDay = new Date(`${day}T12:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextSnapshot = input.snapshots[nextDay.toISOString().slice(0, 10)] ?? null;
    // Ledger check against real warehouse issues, independent of order-based consumption.
    const residual = historical ? (opening === null || nextSnapshot === null ? null : nextSnapshot - (opening + incoming - (input.outbound[day] || 0))) : null;
    running = closing;
    return { opening, closing, observed, incoming, consumption, residual };
  });
}

export function projectionDemand(actual: Record<string, number>, averages: number[], day: string, today: string) {
  const index = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  const average = averages[index] || 0;
  return day < today ? actual[day] || 0 : day === today ? Math.max(average, actual[day] || 0) : average;
}

export function requiresPurchasingProjection(question: string) {
  const q = projectionMaterialKey(question);
  // Explicit accounting/finished-goods questions need their own read tools, not a raw-material lookup.
  const warehouse = /materi[ae]prim|ambalaj|etichet|forecast|proiect|achizitii/.test(q);
  const application = warehouse || /aplicatie|fizic|depozit/.test(q);
  if (/senior|contabil|gestiuneerp/.test(q) && !application) return false;
  if (/produsefinit|produsfinit|marfafinal|restoc|picking/.test(q) && !warehouse) return false;
  return /stoc|ajung|ajunc|cat.*tine|consum.*medi|medi.*consum/.test(q);
}

/** Enforce source selection on the first model step, not just in prose instructions. */
export function purchasingProjectionStep(question: string, stepNumber: number) {
  return stepNumber === 0 && requiresPurchasingProjection(question)
    ? { toolChoice: { type: 'tool' as const, toolName: 'stoc_si_proiectie_achizitii' as const } }
    : undefined;
}
