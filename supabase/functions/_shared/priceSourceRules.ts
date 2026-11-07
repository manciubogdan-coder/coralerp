/** Audited Senior custom packaging relation: Coef for selling-unit 28 is pieces/pallet,
 * regardless of UM_ID_Corespondent (which is PALET on the audited article). */
export const PALLET_RELATION = `SELECT Articol_ID,MIN(CAST(Coef AS float)) coef FROM dbo.D_Articole_UM_Relatii WITH (NOLOCK) WHERE Articol_UM_Vanzare_ID=28 AND Coef>0 GROUP BY Articol_ID HAVING MIN(Coef)=MAX(Coef)`;
/** Legacy country aggregate of a journal subject / carrier line. */
export function transportRoute(subject: string): string | null {
  const s = subject.trim().toUpperCase();
  if (s === 'TRANSPORT DIST BULGARIA') return 'Bulgaria';
  if (s === 'TRANSPORT DIST MOLDOVA ICS') return 'Moldova';
  if (/^TRANSPORT DIST (BUCURESTI|CRAIOVA|FOCSANI|HORECA|LUGOJ|PLOIESTI|ROMAN|TIMISOARA|TURDA|TURDA-IERNUT)$/.test(s)) return 'România';
  return null;
}
/** Senior carrier invoices (FF on 624.02/624.06) name each trip "TRANSPORT DIST <CURSĂ>"; the cursă is the route key. */
export function routeKey(line: string): string | null {
  const m = line.trim().toUpperCase().match(/^TRANSPORT DIST\s+(.+)$/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}
export const LEGACY_ROUTES = ['România', 'Bulgaria', 'Moldova'] as const;
export function routeCountry(key: string): string {
  if (key === 'BULGARIA') return 'Bulgaria';
  if (key.startsWith('MOLDOVA')) return 'Moldova';
  return 'România';
}
const plain = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const CITY_ROUTES: Array<[RegExp, string]> = [
  [/\bIERNUT\b/, 'TURDA-IERNUT'], [/\bTURDA\b/, 'TURDA'], [/\bLUGOJ\b/, 'LUGOJ'], [/\bROMAN\b/, 'ROMAN'], [/\bCRAIOVA\b/, 'CRAIOVA'],
  [/\bTIMISOARA\b/, 'TIMISOARA'], [/\bPLOIESTI\b/, 'PLOIESTI'], [/\bFOCSANI\b/, 'FOCSANI'], [/\bBUCURESTI\b/, 'BUCURESTI'],
];
const COUNTY_ROUTES: Record<string, string> = {
  BUCURESTI: 'BUCURESTI', ILFOV: 'BUCURESTI', GIURGIU: 'BUCURESTI', PRAHOVA: 'PLOIESTI', NEAMT: 'ROMAN', MURES: 'TURDA-IERNUT',
  CLUJ: 'TURDA', TIMIS: 'TIMISOARA', DOLJ: 'CRAIOVA', VRANCEA: 'FOCSANI',
};
/** Route proposed for a delivery point: country, then the store suffix after " - " (e.g. "MEGA IMAGE SRL - ROMAN"), then county.
 * A proposal only: Senior carrier invoices are not linked to individual deliveries. */
export function deliveryRoute(p: { name?: unknown; judet?: unknown; country?: unknown }): string | null {
  const country = plain(p.country), name = plain(p.name), county = plain(p.judet);
  if (country.includes('BULG')) return 'BULGARIA';
  if (country.includes('MOLD') || county.includes('CHISINAU')) return 'MOLDOVA ICS';
  if (country && !country.includes('ROM')) return null;
  const suffix = name.includes(' - ') ? name.slice(name.indexOf(' - ') + 3) : '';
  for (const [re, route] of CITY_ROUTES) if (re.test(suffix)) return route;
  return COUNTY_ROUTES[county] ?? null;
}
export function historicalFeePct(discounts: number, sales: number): number | null {
  return sales > 0 && discounts >= 0 && discounts < sales ? discounts / sales * 100 : null;
}
export type OrderedPalletRow = { name: string; unit: string; kg: number; kgPerPallet: number | null; pallets: number };
/** Supply pallets from supplier orders (Coral Achiziții): ordered kg ÷ configured kg/palet per product range. Products without a norm or not in kg are listed, never guessed. */
/** Standard truck capacity used only to split one supplier's delivery day into trucks. */
export const TRUCK_PALLETS = 33;
export type OrderedLoad = { supplier: string; day: string; pallets: number; trucks: number };
export function orderedPallets(orders: Array<{ name: string; unit?: string | null; qty: number; supplier?: string | null; day?: string | null }>) {
  const by = new Map<string, OrderedPalletRow>();
  const loadsBy = new Map<string, OrderedLoad>();
  for (const o of orders) {
    const unit = String(o.unit ?? "kg").trim().toLowerCase() || "kg";
    const key = `${o.name}|${unit}`;
    const norm = unit === "kg" ? configuredRawPalletKg(o.name) ?? null : null;
    const row = by.get(key) ?? { name: o.name, unit, kg: 0, kgPerPallet: norm, pallets: 0 };
    row.kg += Number(o.qty) || 0;
    row.pallets = norm ? row.kg / norm : 0;
    by.set(key, row);
    if (norm && o.day) {
      const supplier = String(o.supplier ?? "fără furnizor"), day = String(o.day).slice(0, 10);
      const lk = `${supplier}|${day}`;
      const load = loadsBy.get(lk) ?? { supplier, day, pallets: 0, trucks: 0 };
      load.pallets += (Number(o.qty) || 0) / norm;
      load.trucks = Math.max(1, Math.ceil(load.pallets / TRUCK_PALLETS - 1e-9));
      loadsBy.set(lk, load);
    }
  }
  const rows = [...by.values()].sort((a, b) => b.pallets - a.pallets || b.kg - a.kg);
  const counted = rows.filter((r) => r.kgPerPallet);
  const loads = [...loadsBy.values()].sort((a, b) => b.day.localeCompare(a.day) || a.supplier.localeCompare(b.supplier));
  return {
    rows, loads, pallets: counted.reduce((s, r) => s + r.pallets, 0), kg: counted.reduce((s, r) => s + r.kg, 0),
    trucks: loads.reduce((s, l) => s + l.trucks, 0), skipped: rows.filter((r) => !r.kgPerPallet),
  };
}
export function configuredRawPalletKg(name: string): number | undefined {
  if (/radic|radich/i.test(name)) return 500;
  if (/iceberg|pan di|indivi|scarola|varz/i.test(name)) return 400;
  if (/spanac|rucola|valerian|latuga|salat|baby|mizuna|tsatsoi|blood|chard|busuioc|marar|patrunjel|menta|cimbru|coriandru|rozmarin|oregano|tarhon|chivas/i.test(name)) return 220;
  return undefined;
}

export type RoutePoint = {
  pid: number; name: string; judet: string; pallets: number; missing: number; route: string | null;
  /** Route chosen by the user (store or county), not proposed from the address. */
  manual: boolean;
  /** Pallets of lines without a Senior pieces/pallet coefficient, estimated from the average pieces per pallet of all deliveries. */
  estimatedPallets: number; knownQty: number; missingQty: number;
};
export type RouteStat = {
  route: string; country: string; trips: number; total: number; qty: number; pmin: number; pmax: number;
  pallets: number; missingLines: number; estimatedPallets: number; perPallet: number | null; perTrip: number | null; palletsPerTrip: number | null;
  /** Carrier billed per unit (e.g. HORECA 4.72 lei × units), not per trip. */
  unitPrice: number | null; points: Array<{ name: string; pallets: number }>;
  /** Paired cursă pooled with this one (same truck, short or long run). */
  pool?: { routes: string[]; total: number; pallets: number; trips: number };
};
/** Cursă pairs served by the same truck: the long run also delivers the short run's points. */
export const ROUTE_PAIRS: Array<[string, string]> = [['TURDA', 'TURDA-IERNUT'], ['TIMISOARA', 'LUGOJ']];
export type RouteOverrides = Record<string, string>;
export const countyKey = (judet: unknown) => plain(judet);
/** User route choices: "p:<partner id>" for one store or "j:<COUNTY>" for every point of a county without its own choice. */
export function validRouteOverrides(raw: unknown): RouteOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: RouteOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 300)) {
    if (/^(p:\d{1,9}|j:[A-Z0-9 .\-]{1,40})$/.test(k) && typeof v === 'string' && /^[A-Z0-9][A-Z0-9 .\-]{0,59}$/.test(v)) out[k] = v;
  }
  return out;
}
/** Route of a delivery point: the user's store choice, then the user's county choice, then the address proposal. */
export function pointRoute(p: { pid?: unknown; name?: unknown; judet?: unknown; country?: unknown }, overrides: RouteOverrides = {}) {
  const manual = overrides[`p:${Number(p.pid)}`] ?? overrides[`j:${countyKey(p.judet)}`];
  return manual ? { route: manual, manual: true } : { route: deliveryRoute(p), manual: false };
}
/** Route tariffs: carrier trips of the cursă ÷ pallets invoiced to the delivery points mapped to it. */
export function buildRoutes(pointRows: any[], tripRows: any[], overrides: RouteOverrides = {}) {
  const n = (v: unknown) => Number(v) || 0;
  // Lines without a Senior pallet coefficient mix KG and BUC of different products: they are counted and reported, never converted into estimated pallets.
  const points: RoutePoint[] = pointRows.map((r) => {
    const est = 0;
    const pr = pointRoute(r, overrides);
    return { pid: n(r.pid), name: String(r.name ?? '').trim(), judet: String(r.judet ?? '').trim(), pallets: n(r.pallets) + est, missing: n(r.missing), route: pr.route, manual: pr.manual,
      estimatedPallets: est, knownQty: n(r.knownQty), missingQty: n(r.missingQty) };
  });
  const routes = new Map<string, RouteStat>();
  for (const t of tripRows) {
    const key = routeKey(String(t.line ?? ''));
    if (!key) continue;
    const r = routes.get(key) ?? { route: key, country: routeCountry(key), trips: 0, total: 0, qty: 0, pmin: Infinity, pmax: 0, pallets: 0, missingLines: 0, estimatedPallets: 0, perPallet: null, perTrip: null, palletsPerTrip: null, unitPrice: null, points: [] };
    r.trips += n(t.trips); r.total += n(t.total); r.qty += n(t.qty); r.pmin = Math.min(r.pmin, n(t.pmin)); r.pmax = Math.max(r.pmax, n(t.pmax));
    routes.set(key, r);
  }
  const unassigned: RoutePoint[] = [];
  for (const p of points) {
    const r = p.route ? routes.get(p.route) : undefined;
    if (!r) { if (p.pallets > 0) unassigned.push(p); continue; }
    r.pallets += p.pallets; r.missingLines += p.missing; r.estimatedPallets += p.estimatedPallets;
    if (p.pallets > 0) r.points.push({ name: p.name, pallets: p.pallets });
  }
  for (const r of routes.values()) {
    if (!Number.isFinite(r.pmin)) r.pmin = 0;
    r.points.sort((a, b) => b.pallets - a.pallets);
    r.perTrip = r.trips > 0 ? r.total / r.trips : null;
    r.perPallet = r.pallets > 0 ? r.total / r.pallets : null;
    r.palletsPerTrip = r.pallets > 0 && r.trips > 0 ? r.pallets / r.trips : null;
    r.unitPrice = r.qty > r.trips * 1.5 && r.qty > 0 ? r.total / r.qty : null;
  }
  // Paired trips: the same truck runs either the short cursă or the long one that also covers the short one's points
  // (TURDA = Cluj only, TURDA-IERNUT = Cluj + Iernut; LUGOJ / TIMISOARA likewise). Their costs and pallets are pooled.
  for (const [a, b] of ROUTE_PAIRS) {
    const x = routes.get(a), y = routes.get(b);
    if (!x || !y) continue;
    const total = x.total + y.total, pallets = x.pallets + y.pallets, trips = x.trips + y.trips;
    for (const r of [x, y]) {
      r.pool = { routes: [a, b], total, pallets, trips };
      r.perPallet = pallets > 0 ? total / pallets : null;
      r.palletsPerTrip = pallets > 0 && trips > 0 ? pallets / trips : null;
    }
  }
  const list = [...routes.values()].sort((a, b) => b.total - a.total);
  return { routes: list, points, unassigned: unassigned.sort((a, b) => b.pallets - a.pallets), piecesPerPallet: null };
}

/** Delivery points without a cursă, grouped by county so the user can assign a whole county at once. */
export function unassignedByCounty(points: RoutePoint[]) {
  const by = new Map<string, { county: string; judet: string; pallets: number; points: number; names: string[] }>();
  for (const p of points) {
    const k = countyKey(p.judet) || 'FARA JUDET';
    const g = by.get(k) ?? { county: k, judet: p.judet || 'fără județ', pallets: 0, points: 0, names: [] };
    g.pallets += p.pallets; g.points += 1; if (g.names.length < 4) g.names.push(p.name);
    by.set(k, g);
  }
  return [...by.values()].sort((a, b) => b.pallets - a.pallets);
}
