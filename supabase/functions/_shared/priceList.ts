// Pure rules for client price lists: latest-cost window, client-average cursă and real profit at the current selling price.

/** Default gross margin of a new price list (editable by the user). */
export const DEFAULT_MARGIN_PCT = 15;
/** Pseudo-cursă: pallet-weighted average of the cursă costs of every store of the central partner. */
export const CLIENT_AVERAGE_ROUTE = "MEDIE CLIENT";
/** Transport tariffs use the latest invoices, not annual or closed-month averages. */
export const LATEST_COST_DAYS = 30;
/** Loads (pallets per truck / per cursă) come from a longer period: pallet NIRs and carrier invoices are not booked on the same days. */
export const LOAD_DAYS = 90;

type Route = { route: string; trips: number; total: number; qty: number; pmin: number; pmax: number; pallets: number; missingLines: number; perPallet: number | null; perTrip: number | null; palletsPerTrip: number | null; unitPrice: number | null; country: string; points: Array<{ name: string; pallets: number }>; pool?: { routes: string[] } };
/** Shared tariff of a cursă pair served by the same truck: latest cost per trip of both ÷ pallets per trip of both. */
export type RoutePool = { routes: string[]; total: number; trips: number; perTrip: number; pallets: number; loadTrips: number; palletsPerTrip: number; perPallet: number };
/** Latest cursă tariff: average trip cost of the last 30 days ÷ average pallets per trip of the last 90 days.
 * A cursă without trips in the last 30 days keeps its 90-day trip cost and is flagged.
 * Paired curse (same truck, Reguli de calcul) share one tariff: Σ latest cost ÷ Σ trips, ÷ (Σ 90-day pallets ÷ Σ 90-day trips). */
export function latestRoutes<R extends Route>(latest: R[], load: R[]) {
  const by = new Map(latest.map((r) => [r.route, r]));
  const rows = load.map((l) => {
    const r = by.get(l.route);
    const recent = !!r && r.trips > 0;
    const perTrip = recent ? r!.total / r!.trips : l.perTrip;
    const ppt = l.trips > 0 && l.pallets > 0 ? l.pallets / l.trips : null;
    return {
      ...l, ...(recent ? { trips: r!.trips, total: r!.total, qty: r!.qty, pmin: r!.pmin, pmax: r!.pmax, unitPrice: r!.unitPrice } : {}),
      loadTrips: l.trips, loadPallets: l.pallets, perTrip, palletsPerTrip: ppt, perPallet: perTrip != null && ppt ? perTrip / ppt : null, recent,
      pool: undefined as RoutePool | undefined,
    };
  });
  const groups = new Map<string, typeof rows>();
  for (const r of rows) if (load.find((l) => l.route === r.route)?.pool?.routes?.length) {
    const key = [...load.find((l) => l.route === r.route)!.pool!.routes].sort().join("+");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const g of groups.values()) {
    const total = g.reduce((s, r) => s + r.total, 0), trips = g.reduce((s, r) => s + r.trips, 0);
    const pallets = g.reduce((s, r) => s + r.loadPallets, 0), loadTrips = g.reduce((s, r) => s + r.loadTrips, 0);
    if (g.length < 2 || trips <= 0 || loadTrips <= 0 || pallets <= 0) continue;
    const pool: RoutePool = { routes: g.map((r) => r.route), total, trips, perTrip: total / trips, pallets, loadTrips, palletsPerTrip: pallets / loadTrips, perPallet: total / trips / (pallets / loadTrips) };
    for (const r of g) { r.pool = pool; r.perPallet = pool.perPallet; }
  }
  return rows.sort((a, b) => b.total - a.total);
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const ym = (d: Date) => d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;

/** Latest-invoice window ending at the (exclusive) price end day; book months are widened by one month on each side
 * so invoices dated in the window are found whatever accounting month they were booked in. */
export function latestCostWindow(endDay: string, days = LATEST_COST_DAYS) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDay)) throw new Error("Dată invalidă.");
  const end = new Date(`${endDay}T00:00:00Z`);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - days);
  const last = new Date(end); last.setUTCDate(last.getUTCDate() - 1);
  const before = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  const after = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1));
  return { start: day(start), end: endDay, days, bookFrom: ym(before), bookTo: ym(after) };
}

export type StoreRoute = { pid: number; name: string; route: string | null; pallets: number };
/** Client average distribution cost per pallet: Σ(store pallets × its cursă lei/palet) ÷ Σ store pallets.
 * Without deliveries in the window, the plain average of the stores' cursă tariffs (labelled unweighted). */
export function clientAverageRoute(stores: StoreRoute[], perPallet: Record<string, number | null | undefined>) {
  const priced = stores.filter((s) => s.route && (perPallet[s.route] ?? 0) > 0);
  const missing = stores.filter((s) => !s.route || !((perPallet[s.route] ?? 0) > 0)).map((s) => s.name);
  if (!priced.length) return null;
  const pallets = priced.reduce((t, s) => t + Math.max(s.pallets, 0), 0);
  if (pallets > 0) {
    const allocated = priced.reduce((t, s) => t + Math.max(s.pallets, 0) * (perPallet[s.route!] ?? 0), 0);
    return { perPallet: allocated / pallets, allocated, pallets, weighted: true, stores: priced.length, missing };
  }
  const avg = priced.reduce((t, s) => t + (perPallet[s.route!] ?? 0), 0) / priced.length;
  return { perPallet: avg, allocated: null, pallets: 0, weighted: false, stores: priced.length, missing };
}

/** Real profitability per piece at a selling price: price − network fees (percent of price + fixed) − minimum price
 * (production cost + distribution + gross margin, the margin being a factory cost). % is of the minimum price, the same base
 * as the target profit: 0% at the minimum price + fees, the target % at the proposed price, negative below. */
export function profitAt(s: { unitsPerCase: number; minPrice: number; feePct: number; clientFeePerPiece: number }, pricePerPiece: number) {
  const n = s.unitsPerCase > 0 ? s.unitsPerCase : 1;
  const fees = (pricePerPiece * (s.feePct || 0)) / 100 + (s.clientFeePerPiece || 0);
  const cost = s.minPrice / n;
  const profit = pricePerPiece - fees - cost;
  const net = pricePerPiece - fees;
  // % of the selling price without fees, same base as the target profit.
  return { fees, cost, profit, pct: net > 0 ? (profit / net) * 100 : null };
}
