import { describe, expect, test } from "bun:test";
import { mirrorLine, targetCost } from "./partnerMirrorMath";

const sheet = { unitsPerCase: 1, minPrice: 4, feePct: 20, clientFeePerPiece: 0, perPiece: { clientPrice: 6, factoryGate: 3.4 } };

describe("partner mirror", () => {
  test("loss at the real price, profit at the proposed price", () => {
    // 100 pcs sold at 4.50: fees 0.90, minimum 4 → -0.40/pc; proposed 6: fees 1.20 → +0.80/pc.
    const m = mirrorLine(sheet, 100, 450);
    expect(m.actualProfit).toBeCloseTo(-40);
    expect(m.proposedProfit).toBeCloseTo(80);
    expect(m.gap).toBeCloseTo(120);
  });
  test("target cost keeps 15% margin + 5% profit at the imposed price", () => {
    // 5 lei with 20% fees: 5 × 0.8 × 0.8 = 3.20 lei maximum production + distribution cost.
    expect(targetCost(5, 20, 15, 5)).toBeCloseTo(3.2);
  });
});

import { palletDensity } from "./partnerMirrorMath";
test("denser pallet cuts distribution per piece", () => {
  // 0.62 lei/buc at 720 buc/palet = 446.4 lei/palet; at 960 buc → 0.465 lei/buc, saving 0.155.
  const d = palletDensity(0.62, 720, 960, 15, 5);
  expect(d.perPallet).toBeCloseTo(446.4);
  expect(d.newDistPerPiece).toBeCloseTo(0.465);
  expect(d.saving).toBeCloseTo(0.155);
  expect(d.profitGain).toBeCloseTo(0.155 * 0.95 / 0.8);
});

import { currentPrice, groupPartners, lastMonthStart, periodMonths, projectLine } from "./partnerMirrorMath";
describe("future projection", () => {
  test("3 past months, 3 future months at the last month's price", () => {
    // 300 pcs in 3 months → 100/month → 300 projected. Last month 90 pcs for 405 lei = 4.50/pc.
    // Profit at 4.50: 4.50 − 0.90 fees − 4 minimum = −0.40/pc → −120 lei.
    const p = projectLine(sheet, { qty: 300, value: 1500, lastQty: 90, lastValue: 405 }, 3, 3, "last");
    expect(p.monthlyQty).toBeCloseTo(100);
    expect(p.qty).toBeCloseTo(300);
    expect(p.price).toBeCloseTo(4.5);
    expect(p.profit).toBeCloseTo(-120);
  });
  test("period average price, 6 future months", () => {
    // 5.00/pc over the period: 5 − 1 fee − 4 = 0 profit per piece; 600 pcs projected.
    const p = projectLine(sheet, { qty: 300, value: 1500, lastQty: 90, lastValue: 405 }, 3, 6, "period");
    expect(p.qty).toBeCloseTo(600);
    expect(p.price).toBeCloseTo(5);
    expect(p.profit).toBeCloseTo(0);
  });
  test("no sales in the last month falls back to the period price", () => {
    const p = projectLine(sheet, { qty: 100, value: 600, lastQty: 0, lastValue: 0 }, 1, 1, "last");
    expect(p.priceFrom).toBe("period");
    expect(p.price).toBeCloseTo(6);
  });
  test("latest invoice price beats the averages (Metro crocantă: 7.70 until 05.11, 7.80 since 06.11)", () => {
    // Period 22296 pcs × 7.70 + 3036 × 7.80; the current price must be 7.80, not the 7.71 average.
    const sale = { qty: 25332, value: 171679.2 + 23680.8, lastQty: 3036, lastValue: 23680.8, latestPrice: 7.8 };
    const p = projectLine(sheet, sale, 3, 1, "latest");
    expect(p.priceFrom).toBe("latest");
    expect(p.price).toBe(7.8);
    expect(currentPrice(sale, "period").price).toBeCloseTo(7.712, 3);
  });
  test("no latest price falls back to the last month, then to the period", () => {
    expect(currentPrice({ qty: 300, value: 1500, lastQty: 90, lastValue: 405, latestPrice: null }, "latest")).toEqual({ price: 4.5, from: "last" });
    expect(currentPrice({ qty: 100, value: 600, lastQty: 0, lastValue: 0 }, "latest")).toEqual({ price: 6, from: "period" });
  });
  test("period length and last-month window", () => {
    expect(periodMonths("2026-08-21", "2026-11-21")).toBeCloseTo(92 / 30.4375);
    expect(lastMonthStart("2026-08-21", "2026-11-21")).toBe("2026-10-21");
    expect(lastMonthStart("2026-11-10", "2026-11-21")).toBe("2026-11-10");
  });
  test("partners grouped by Subgrupa then subgrupa 2, unclassified last", () => {
    const g = groupPartners([
      { name: "SIMPLIS TRADE SRL", group: "HORECA", subgroup: "DISTRIBUITORI" },
      { name: "HONEST FOOD SRL", group: "HORECA", subgroup: "MIRCEA" },
      { name: "ABATORUL PERIS S.A.", group: "HORECA", subgroup: null },
      { name: "LIDL DISCOUNT SRL", group: "HYPERMARKET", subgroup: null },
      { name: "Azienda Agricola", group: null, subgroup: null },
      { name: "METRO CASH & CARRY ROMANIA SRL", group: "CASH & CARRY", subgroup: null },
    ]);
    expect(g.map((x) => x.group)).toEqual(["CASH & CARRY", "HORECA", "HYPERMARKET", null]);
    expect(g[1].subgroups.map((s) => s.subgroup)).toEqual([null, "DISTRIBUITORI", "MIRCEA"]);
  });
});
