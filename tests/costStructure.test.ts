import { describe, expect, test } from "bun:test";
import { partnerContributions, structureOf, breakEvenPricePct, gamaOf, type SaleLine } from "../src/lib/argus/costStructure";
const cost = { mp: 2, ambalaje: 1, manopera: 0.5, regie: 0.5, pierderi: 0, aprovizionare: 0.5, distributie: 0.5 };
const lines: SaleLine[] = [{ partner: "A", product: "Mix", gama: "Mixte", qty: 100, value: 1000, feePct: 10, cost }];
describe("cost structure", () => {
  test("profit = revenue − fees − weighted costs", () => {
    const s = structureOf(lines);
    expect(s.totalCost).toBe(500); expect(s.fees).toBe(100); expect(s.profit).toBe(400);
  });
  test("MP +10% raises only raw material", () => {
    expect(structureOf(lines, { name: "x", pct: { mp: 10 }, pricePct: 0, volumePct: 0, feeDelta: 0 }).costs.mp).toBeCloseTo(220);
  });
  test("break-even price", () => { expect(breakEvenPricePct(lines, { name: "x", pct: {}, pricePct: 0, volumePct: 0, feeDelta: 0 })).toBeCloseTo((500 / 900 - 1) * 100); });
  test("bio baby spanac is traded goods", () => { expect(gamaOf("Bio Baby Spanac 125g")).toBe("Marfă revândută"); });
  const two: SaleLine[] = [lines[0], { ...lines[0], partner: "B", value: 400 }];
  test("dropping a partner keeps overhead: profit falls by its contribution, not its full profit", () => {
    const all = structureOf(two).profit;
    const without = structureOf(two, { name: "x", pct: {}, pricePct: 0, volumePct: 0, feeDelta: 0, dropPartners: ["B"] }).profit;
    // B: revenue 400, fees 40, variable = 5 − 1,05 fix (regie 0,5 + manoperă 0,25 + distribuție 0,3) = 3,95/buc × 100 = 395 → contribution −35
    expect(all - without).toBeCloseTo(-35);
    expect(partnerContributions(two).find((p) => p.partner === "B")!.dropDelta).toBeCloseTo(35);
  });
  test("real loss % is added on raw material even when the sheet loss is 0", () => {
    expect(structureOf(lines, { name: "x", pct: {}, pricePct: 0, volumePct: 0, feeDelta: 0, lossPct: 20 }).costs.pierderi).toBeCloseTo(40);
  });
  test("volume −50% keeps fixed overhead whole", () => {
    expect(structureOf(lines, { name: "x", pct: {}, pricePct: 0, volumePct: -50, feeDelta: 0 }).costs.regie).toBeCloseTo(50);
  });
});
