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
