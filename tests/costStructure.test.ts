import { describe, expect, test } from "bun:test";
import { partnerContributions, partnerResults, structureOf, breakEvenPricePct, gamaOf, recipeLossValue, type SaleLine } from "../src/lib/argus/costStructure";
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
    // B: revenue 400, fees 40, variable = 5 − 0,75 fix (regie 0,5 + manoperă 0,25; distribuția pleacă cu clientul) = 4,25/buc × 100 = 425 → contribution −65
    expect(all - without).toBeCloseTo(-65);
    expect(partnerContributions(two).find((p) => p.partner === "B")!.dropDelta).toBeCloseTo(65);
  });
  test("real loss % is added on raw material even when the sheet loss is 0", () => {
    expect(structureOf(lines, { name: "x", pct: {}, pricePct: 0, volumePct: 0, feeDelta: 0, lossPct: 20 }).costs.pierderi).toBeCloseTo(40);
  });
  test("sale below the sheet minimum price is counted as loss", () => {
    const c = partnerContributions([{ ...lines[0], value: 450, minPiece: 5 }])[0];
    // net 4,5 × 0,9 = 4,05 < 5 → 0,95 lei/buc × 100
    expect(c.belowQty).toBe(100); expect(c.belowLoss).toBeCloseTo(95);
  });
  test("recipe loss is split out of raw material", () => {
    expect(recipeLossValue([{ kind: "mp", qty: 0.75, lossPct: 25, price: 10 }])).toBeCloseTo(2.5);
  });
  test("volume −50% keeps fixed overhead whole", () => {
    expect(structureOf(lines, { name: "x", pct: {}, pricePct: 0, volumePct: -50, feeDelta: 0 }).costs.regie).toBeCloseTo(50);
  });
  test("price change for one client moves only that client's revenue", () => {
    const s = structureOf(two, { name: "x", pct: {}, pricePct: 0, volumePct: 0, feeDelta: 0, partnerPricePct: { B: 10 } });
    expect(s.revenue).toBeCloseTo(1440);
  });
  test("dropped client's fixed costs land on the others; per-client results add up to the company", () => {
    const sc = { name: "x", pct: {}, pricePct: 0, volumePct: 0, feeDelta: 0, dropPartners: ["B"] };
    const r = partnerResults(two, sc);
    const a = r.find((x) => x.partner === "A")!;
    // B leaves 0,75 lei/buc × 100 fixed = 75 lei, all on A: 400 − 75
    expect(a.result).toBeCloseTo(325);
    expect(r.reduce((t, x) => t + x.result, 0)).toBeCloseTo(structureOf(two, sc).profit);
  });
});

describe("product scenarios", () => {
  const cost = { mp: 1, ambalaje: 0, manopera: 0, regie: 0, pierderi: 0, aprovizionare: 0, distributie: 0, marja: 0 } as any;
  const ls = [
    { partner: "A", product: "X", gama: "g", qty: 10, value: 100, feePct: 0, cost },
    { partner: "B", product: "Y", gama: "g", qty: 10, value: 50, feePct: 0, cost },
  ];
  test("dropping a product removes its sales and variable costs", () => {
    const s = structureOf(ls as any, { name: "s", pct: {}, pricePct: 0, volumePct: 0, feeDelta: 0, dropProducts: ["X"] });
    expect(s.revenue).toBe(50); expect(s.totalCost).toBe(10);
  });
  test("product price change applies only to that product", () => {
    expect(structureOf(ls as any, { name: "s", pct: {}, pricePct: 0, volumePct: 0, feeDelta: 0, productPricePct: { Y: 10 } }).revenue).toBeCloseTo(155);
  });
});
