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
