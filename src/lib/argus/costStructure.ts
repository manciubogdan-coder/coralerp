/** Weighted cost structure of real sales and what-if scenarios on top of it. */
export const COST_KEYS = ["mp", "ambalaje", "manopera", "regie", "pierderi", "aprovizionare", "distributie"] as const;
export type CostKey = typeof COST_KEYS[number];
export const COST_LABEL: Record<CostKey | "taxe" | "profit", string> = {
  mp: "Materie primă", ambalaje: "Ambalaje & etichete", manopera: "Manoperă directă", regie: "Regie / utilități",
  pierderi: "Pierderi tehnologice", aprovizionare: "Transport aprovizionare", distributie: "Transport distribuție",
  taxe: "Taxe rețea client", profit: "Rezultat (profit operațional)",
};
export type PieceCost = Record<CostKey, number>;
export type SaleLine = { partner: string; product: string; gama: string; qty: number; value: number; feePct: number; cost: PieceCost };
export type Structure = { qty: number; revenue: number; fees: number; costs: PieceCost; totalCost: number; profit: number };
export type Scenario = { name: string; pct: Partial<Record<CostKey, number>>; pricePct: number; volumePct: number; feeDelta: number };
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

export function structureOf(lines: SaleLine[], sc: Scenario = BASE): Structure {
  const costs = Object.fromEntries(COST_KEYS.map((k) => [k, 0])) as PieceCost;
  let qty = 0, revenue = 0, fees = 0;
  const vol = 1 + sc.volumePct / 100, price = 1 + sc.pricePct / 100;
  for (const l of lines) {
    const q = l.qty * vol, v = l.value * vol * price;
    qty += q; revenue += v;
    fees += v * Math.max(0, l.feePct + sc.feeDelta) / 100;
    for (const k of COST_KEYS) costs[k] += l.cost[k] * (1 + (sc.pct[k] ?? 0) / 100) * q;
  }
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
