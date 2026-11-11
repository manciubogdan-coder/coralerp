import { describe, expect, test } from "bun:test";
import { structureOf, breakEvenPricePct, gamaOf, type SaleLine } from "../src/lib/argus/costStructure";
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
});
