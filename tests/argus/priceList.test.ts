import { expect, it } from "bun:test";
import { clientAverageRoute, DEFAULT_MARGIN_PCT, latestCostWindow, latestRoutes, profitAt } from "../../supabase/functions/_shared/priceList";
import { computeSheet } from "../../supabase/functions/_shared/priceSheet";

it("new price lists start at 15% gross margin", () => {
  expect(DEFAULT_MARGIN_PCT).toBe(15);
});

it("transport uses the latest 30 days of invoices, not the annual or closed-month average", () => {
  const w = latestCostWindow("2026-11-08");
  expect(w.start).toBe("2026-10-09");
  expect(w.end).toBe("2026-11-08");
  // Booking months widened so invoices dated in the window are always found.
  expect(w.bookFrom).toBe(202609);
  expect(w.bookTo).toBe(202612);
});

it("client average weights each store's cursă by the pallets delivered to it", () => {
  const avg = clientAverageRoute([
    { pid: 1, name: "MEGA - ROMAN", route: "ROMAN", pallets: 10 },
    { pid: 2, name: "MEGA - BUCURESTI", route: "BUCURESTI", pallets: 30 },
    { pid: 3, name: "MEGA - NECUNOSCUT", route: null, pallets: 5 },
  ], { ROMAN: 450, BUCURESTI: 290 });
  // (10 × 450 + 30 × 290) ÷ 40 = 330
  expect(avg?.perPallet).toBeCloseTo(330, 6);
  expect(avg?.weighted).toBe(true);
  expect(avg?.missing).toEqual(["MEGA - NECUNOSCUT"]);
});

it("without deliveries in the window the client average is the plain average, labelled unweighted", () => {
  const avg = clientAverageRoute([{ pid: 1, name: "A", route: "ROMAN", pallets: 0 }, { pid: 2, name: "B", route: "TURDA", pallets: 0 }], { ROMAN: 400, TURDA: 200 });
  expect(avg?.perPallet).toBe(300);
  expect(avg?.weighted).toBe(false);
});

const sheet = (profitPct?: number) => computeSheet({ unitsPerCase: 10, components: [{ id: 1, name: "Spanac", qty: 1, unit: "KG", kind: "mp", price: 8.5, priceSource: "NIR", lossPct: 0, kgPerPallet: 220 }], rates: {
  labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: 5, eurBufferPct: 0, techLossPct: 0,
  marginPct: 15, profitPct, supplyPerPallet: 0, distributionPerPallet: 300, piecesPerPallet: 1000, feePct: 10, supplyBasis: "pallet",
} });
it("gross margin is 15% of production cost + distribution; minimum price = that cost + margin, without network fees", () => {
  const s = sheet(5);
  // Production 8.5 + distribution 3 = 11.5 lei/bax; margin 15% = 1.725; minimum 13.225 lei/bax (fees not included).
  expect(s.grossMargin).toBeCloseTo(1.725, 4);
  expect(s.perPiece.grossMargin).toBeCloseTo(0.1725, 4);
  expect(s.minPrice).toBeCloseTo(13.225, 4);
  expect(s.perPiece.minPrice).toBeCloseTo(1.3225, 4);
});
it("proposed price = (minimum price + 5% of it) with the 10% network fee added last on the final price", () => {
  const s = sheet(5);
  // 13.225 × 1.05 = 13.88625; ÷ (1 − 10%) = 15.429167 lei/bax; the fee is 10% of the proposed price.
  expect(s.profit).toBeCloseTo(0.66125, 4);
  expect(s.delivered).toBeCloseTo(13.88625, 4);
  expect(s.clientPrice).toBeCloseTo(15.429167, 3);
  expect(s.clientFees).toBeCloseTo(s.clientPrice * 0.1, 3);
  expect(profitAt(s, s.perPiece.clientPrice).pct).toBeCloseTo(5, 1);
});
it("real profitability = (price − network fees − minimum price) ÷ minimum price, negative below break-even", () => {
  const s = sheet(5);
  // 1.50 − 0.15 fees − 1.3225 = 0.0275 lei/buc = 2.08% of the minimum price.
  expect(profitAt(s, 1.5).profit).toBeCloseTo(0.0275, 4);
  expect(profitAt(s, 1.5).pct).toBeCloseTo(2.0794, 2);
  // Break-even with fees: 1.3225 ÷ 0.9 = 1.4694 lei/buc.
  expect(profitAt(s, 1.3225 / 0.9).profit).toBeCloseTo(0, 4);
  expect(profitAt(s, 1.4).profit).toBeLessThan(0);
});

const rs = (route: string, trips: number, total: number, pallets: number) => ({ route, trips, total, qty: trips, pmin: 0, pmax: 0, pallets, missingLines: 0, perPallet: null, perTrip: trips ? total / trips : null, palletsPerTrip: null, unitPrice: null, country: "RO", points: [] });
it("cursă tariff = latest 30-day cost per trip ÷ 90-day pallets per trip", () => {
  const [r] = latestRoutes([rs("BUCURESTI", 10, 20000, 30)], [rs("BUCURESTI", 30, 45000, 210)]);
  expect(r.perTrip).toBe(2000);
  expect(r.palletsPerTrip).toBe(7);
  expect(r.perPallet).toBeCloseTo(2000 / 7, 6);
  expect(r.recent).toBe(true);
});
it("a cursă without trips in the last 30 days keeps its 90-day trip cost and is flagged", () => {
  const [r] = latestRoutes([], [rs("CRAIOVA", 20, 18000, 40)]);
  expect(r.perTrip).toBe(900);
  expect(r.perPallet).toBe(450);
  expect(r.recent).toBe(false);
});
