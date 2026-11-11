/** Weighted cost structure of real sales and what-if scenarios on top of it. */
export const COST_KEYS = ["mp", "ambalaje", "manopera", "regie", "pierderi", "aprovizionare", "distributie", "marja"] as const;
export type CostKey = typeof COST_KEYS[number];
export const COST_LABEL: Record<CostKey | "taxe" | "profit", string> = {
  mp: "Materie primă", ambalaje: "Ambalaje & etichete", manopera: "Manoperă directă", regie: "Regie / utilități",
  pierderi: "Pierderi tehnologice", aprovizionare: "Transport aprovizionare", distributie: "Transport distribuție", marja: "Marjă brută (acoperă cheltuielile firmei)",
  taxe: "Taxe rețea client", profit: "Rezultat (profit operațional)",
};
export type PieceCost = Record<CostKey, number>;
export type SaleLine = { partner: string; product: string; gama: string; qty: number; value: number; feePct: number; cost: PieceCost;
  /** Minimum selling price per piece from the price sheet (cost + gross margin), before network fees. */
  minPiece?: number };
export type Structure = { qty: number; revenue: number; fees: number; costs: PieceCost; totalCost: number; profit: number };
export type Scenario = {
  name: string; pct: Partial<Record<CostKey, number>>; pricePct: number; volumePct: number; feeDelta: number;
  /** Partners removed from the portfolio: their sales and variable costs go, their share of fixed costs stays. */
  dropPartners?: string[];
  /** Real technological loss, as % of raw material processed, added on top of the sheet loss. */
  lossPct?: number;
  /** Share of each cost line that does not move with volume (rent, indirect staff, trucks already paid). */
  fixedPct?: Partial<Record<CostKey, number>>;
};
/** Default fixed share per cost line: overhead is fixed, labour and distribution partly (minimum crews, shared trucks). */
export const DEFAULT_FIXED: Record<CostKey, number> = { mp: 0, ambalaje: 0, manopera: 50, regie: 100, pierderi: 0, aprovizionare: 0, distributie: 0, marja: 100 };
/** Dedicated retail trucks go with the client, so distribution is variable by default; the gross margin is overhead the sheet charges. */
export const fixedOf = (sc: Scenario, k: CostKey) => Math.min(100, Math.max(0, sc.fixedPct?.[k] ?? DEFAULT_FIXED[k])) / 100;
export const BASE: Scenario = { name: "Realitate", pct: {}, pricePct: 0, volumePct: 0, feeDelta: 0 };

/** Product range from the name: what the user calls "gamă". */
export function gamaOf(name: string): string {
  const n = name.toLowerCase();
  if (/spanac.*bio|bio.*spanac/.test(n)) return "Marfă revândută";
  if (/mix|misticanza|trio|duo|salata .* si |prestigio|lupino|amorino/.test(n)) return "Mixte";
  if (/baby|rucola|valeriana|spanac|mizuna|leaf/.test(n)) return "Baby leaf / frunze";
  if (/iceberg|lollo|romana|capatan|căpățân|salata verde|batavia/.test(n)) return "Căpățâni";
  if (/radicchio|trevis|treviso|scarola|cicoare|endiv/.test(n)) return "Radicchio / cicorii";
  if (/patrunjel|pătrunjel|marar|mărar|menta|mentă|busuioc|aromat|cimbru|coriandru|leustean|ceapa verde/.test(n)) return "Aromate";
  return "Altele";
}

/**
 * Fixed parts are taken from the whole selection and never shrink with volume or dropped partners:
 * they are re-absorbed by the remaining pieces. Variable parts follow the pieces actually kept.
 */
export function structureOf(lines: SaleLine[], sc: Scenario = BASE): Structure {
  const costs = Object.fromEntries(COST_KEYS.map((k) => [k, 0])) as PieceCost;
  let qty = 0, revenue = 0, fees = 0;
  const vol = 1 + sc.volumePct / 100, price = 1 + sc.pricePct / 100;
  const drop = new Set(sc.dropPartners ?? []);
  for (const l of lines) {
    for (const k of COST_KEYS) costs[k] += (l.cost[k] ?? 0) * fixedOf(sc, k) * l.qty * (1 + (sc.pct[k] ?? 0) / 100);
    if (drop.has(l.partner)) continue;
    const q = l.qty * vol, v = l.value * vol * price;
    qty += q; revenue += v;
    fees += v * Math.max(0, l.feePct + sc.feeDelta) / 100;
    for (const k of COST_KEYS) costs[k] += (l.cost[k] ?? 0) * (1 - fixedOf(sc, k)) * (1 + (sc.pct[k] ?? 0) / 100) * q;
  }
  costs.pierderi += costs.mp * Math.max(0, sc.lossPct ?? 0) / 100;
  const totalCost = COST_KEYS.reduce((t, k) => t + costs[k], 0);
  return { qty, revenue, fees, costs, totalCost, profit: revenue - fees - totalCost };
}

export const pctOf = (part: number, s: Structure) => (s.revenue ? (part / s.revenue) * 100 : 0);

/** Price change needed so the scenario reaches zero profit (break-even), in % of current price. */
export function breakEvenPricePct(lines: SaleLine[], sc: Scenario): number | null {
  const s = structureOf(lines, { ...sc, pricePct: 0 });
  const feeShare = s.revenue ? s.fees / s.revenue : 0;
  const net = s.revenue * (1 - feeShare);
  if (!(net > 0)) return null;
  return ((s.totalCost / net) - 1) * 100;
}

export type PartnerContribution = { partner: string; qty: number; revenue: number; fees: number; variable: number; contribution: number; fixedShare: number; fullProfit: number; dropDelta: number;
  /** Sales below the sheet minimum price: pieces and lei lost against cost + margin + fees. */
  belowQty: number; belowLoss: number };
/**
 * Contribution margin per partner: revenue − fees − variable costs. Dropping a partner changes company
 * profit by −contribution (its fixed share stays and lands on the others), not by −fullProfit.
 */
export function partnerContributions(lines: SaleLine[], sc: Scenario = BASE): PartnerContribution[] {
  return [...new Set(lines.map((l) => l.partner))].map((partner) => {
    const own = lines.filter((l) => l.partner === partner);
    const alone = structureOf(own, { ...sc, dropPartners: [] });
    let fixedShare = 0;
    for (const l of own) for (const k of COST_KEYS) fixedShare += (l.cost[k] ?? 0) * fixedOf(sc, k) * l.qty * (1 + (sc.pct[k] ?? 0) / 100);
    const without = structureOf(lines, { ...sc, dropPartners: [...(sc.dropPartners ?? []).filter((p) => p !== partner), partner] });
    const withOthersDropped = structureOf(lines, { ...sc, dropPartners: (sc.dropPartners ?? []).filter((p) => p !== partner) });
    const variable = alone.totalCost - fixedShare;
    let belowQty = 0, belowLoss = 0;
    for (const l of own) {
      if (!(l.minPiece && l.qty > 0)) continue;
      const net = (l.value / l.qty) * (1 - l.feePct / 100);
      if (net < l.minPiece) { belowQty += l.qty; belowLoss += (l.minPiece - net) * l.qty; }
    }
    return { partner, qty: alone.qty, revenue: alone.revenue, fees: alone.fees, variable, contribution: alone.revenue - alone.fees - variable, fixedShare, fullProfit: alone.profit, dropDelta: without.profit - withOthersDropped.profit, belowQty, belowLoss };
  }).sort((a, b) => a.fullProfit - b.fullProfit);
}

/** Senior accounts that hold the real figure of each P&L line (company-wide, accounting journal). */
export const ACCOUNTS: Record<CostKey | "venituri" | "taxe", string[]> = {
  venituri: ["70"], mp: ["601"], ambalaje: ["602"], manopera: ["641", "642", "643", "645", "646"],
  regie: ["605", "611", "612", "613", "614", "628", "635", "666", "681"], pierderi: ["607", "658"],
  aprovizionare: ["624.01"], distributie: ["624.02", "624.03", "624.06"], marja: [], taxe: ["709"],
};
export const accountMatch = (cont: string, prefixes: string[]) => prefixes.some((p) => cont.startsWith(p));

/** Technological loss hidden in the raw material line: effective kg − recipe kg, at the same price. */
export function recipeLossValue(components: Array<{ kind: string; qty: number; lossPct: number; price: number | null }>) {
  let v = 0;
  for (const c of components) if ((c.kind === "mp" || c.kind === "marfa") && c.price) {
    const l = Math.min(Math.max(c.lossPct || 0, 0), 95) / 100;
    v += (c.qty / (1 - l) - c.qty) * c.price;
  }
  return v;
}

/**
 * Last accounting month that is really closed: before the current month and with salaries (641) and
 * state contributions (646) booked at ≥ 60% of the median of earlier months. Later months are left out.
 */
export function lastClosedPeriod(rows: Array<{ period: string; cont: string; exp: number }>, current: string): string | null {
  const by = new Map<string, { sal: number; st: number }>();
  for (const r of rows) {
    if (r.period >= current) continue;
    const m = by.get(r.period) ?? { sal: 0, st: 0 };
    if (r.cont.startsWith("641")) m.sal += r.exp;
    if (r.cont.startsWith("646")) m.st += r.exp;
    by.set(r.period, m);
  }
  const ps = [...by.keys()].sort();
  const med = (xs: number[]) => { const s = xs.filter((x) => x > 0).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  for (let i = ps.length - 1; i >= 0; i--) {
    const prev = ps.slice(0, i).map((p) => by.get(p)!);
    const ms = med(prev.map((x) => x.sal)), mt = med(prev.map((x) => x.st));
    const x = by.get(ps[i])!;
    if (x.sal > 0 && x.st > 0 && (!ms || x.sal >= 0.6 * ms) && (!mt || x.st >= 0.6 * mt)) return ps[i];
  }
  return null;
}
