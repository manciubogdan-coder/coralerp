// Partner mirror: real invoiced profit per partner vs. the profit the calculator's proposed prices would have made,
// plus the reverse target cost at a price the retailer imposes. Pure maths here; Senior reads in partnerMirrorSales.
type Sheet = { unitsPerCase: number; minPrice: number; feePct: number; clientFeePerPiece: number; perPiece: { clientPrice: number; factoryGate: number } };

/** Profit per piece at a selling price: price − network fees − minimum price per piece (cost + gross margin). */
export function profitPerPiece(s: Sheet, price: number) {
  const n = s.unitsPerCase > 0 ? s.unitsPerCase : 1;
  const fees = (price * (s.feePct || 0)) / 100 + (s.clientFeePerPiece || 0);
  return price - fees - s.minPrice / n;
}

/** One product of one partner over the period: what was really earned vs. the mirror at the proposed price. */
export function mirrorLine(s: Sheet, qty: number, value: number) {
  const actualPrice = qty > 0 ? value / qty : 0;
  const proposedPrice = s.perPiece.clientPrice;
  const actualProfit = profitPerPiece(s, actualPrice) * qty;
  const proposedRevenue = proposedPrice * qty;
  const proposedProfit = profitPerPiece(s, proposedPrice) * qty;
  return { qty, value, actualPrice, proposedPrice, actualProfit, proposedRevenue, proposedProfit, gap: proposedProfit - actualProfit };
}

/** Reverse costing: highest production + distribution cost per piece that still keeps margin % and profit % at a price
 * imposed by the client (fees included). price = cost ÷ (1 − m − p) ÷ (1 − fee) ⇒ cost = price × (1 − fee) × (1 − m − p). */
export function targetCost(price: number, feePct: number, marginPct: number, profitPct: number) {
  return price * (1 - feePct / 100) * (1 - (marginPct + profitPct) / 100);
}


/** Pallet density what-if: distribution is paid per pallet, so cost per piece = tariff/pallet ÷ pieces/pallet.
 * Profit per piece rises with the saving grossed up like the minimum price: saving × (1 − p) ÷ (1 − m − p). */
export function palletDensity(distPerPiece: number, piecesPerPallet: number, newPiecesPerPallet: number, marginPct: number, profitPct: number) {
  const perPallet = distPerPiece * piecesPerPallet;
  const newDistPerPiece = newPiecesPerPallet > 0 ? perPallet / newPiecesPerPallet : distPerPiece;
  const saving = distPerPiece - newDistPerPiece;
  const k = 1 - (marginPct + profitPct) / 100;
  return { perPallet, newDistPerPiece, saving, profitGain: k > 0 ? saving * (1 - profitPct / 100) / k : saving };
}

/** Months covered by a [start, end) period, in average calendar months (30.44 days). */
export function periodMonths(start: string, end: string) {
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400_000;
  return days > 0 ? days / (365.25 / 12) : 0;
}

/** Start of the "last month" window of a [start, end) period: one calendar month before end, never before start. */
export function lastMonthStart(start: string, end: string) {
  const d = new Date(`${end}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  const s = d.toISOString().slice(0, 10);
  return s > start ? s : start;
}

export type PriceBasis = "latest" | "last" | "period";
type Sale = { qty: number; value: number; lastQty?: number; lastValue?: number; latestPrice?: number | null };

/** Selling price used as "current": the latest invoice day's price, the average of the period's last month, or of the
 * whole period. A missing basis falls back latest → last month → period. */
export function currentPrice(sale: Sale, basis: PriceBasis): { price: number; from: PriceBasis } {
  if (basis === "latest" && (sale.latestPrice ?? 0) > 0) return { price: sale.latestPrice as number, from: "latest" };
  if (basis !== "period" && (sale.lastQty ?? 0) > 0) return { price: (sale.lastValue ?? 0) / (sale.lastQty as number), from: "last" };
  return { price: sale.qty > 0 ? sale.value / sale.qty : 0, from: "period" };
}

/** Future projection of one product: the same average monthly quantity as the past period, sold at the current price
 * (`currentPrice`), costed with today's sheet. Profit = (price − fees − minimum price) × projected quantity. */
export function projectLine(s: Sheet, sale: Sale, pastMonths: number, futureMonths: number, basis: PriceBasis) {
  const monthlyQty = pastMonths > 0 ? sale.qty / pastMonths : 0;
  const qty = monthlyQty * Math.max(0, futureMonths);
  const { price, from } = currentPrice(sale, basis);
  return { monthlyQty, qty, price, priceFrom: from, revenue: price * qty, profit: profitPerPiece(s, price) * qty };
}

export type Grouped<P> = { group: string | null; subgroups: Array<{ subgroup: string | null; partners: P[] }> };

/** Partners as in Senior's classification: "Subgrupa" → "subgrupa 2" → central partner. Named groups alphabetical,
 * unclassified last; inside a group the partners without "subgrupa 2" come first; partners alphabetical. */
export function groupPartners<P extends { name: string; group?: string | null; subgroup?: string | null }>(partners: P[]): Grouped<P>[] {
  const by = new Map<string, Map<string, P[]>>();
  for (const p of partners) {
    const g = p.group || "", sg = p.subgroup || "";
    const m = by.get(g) ?? new Map<string, P[]>();
    m.set(sg, [...(m.get(sg) ?? []), p]);
    by.set(g, m);
  }
  const order = (a: string, b: string) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "ro"));
  return [...by.keys()].sort(order).map((g) => ({
    group: g || null,
    subgroups: [...by.get(g)!.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, "ro")))
      .map((sg) => ({ subgroup: sg || null, partners: [...by.get(g)!.get(sg)!].sort((a, b) => a.name.localeCompare(b.name, "ro")) })),
  }));
}
