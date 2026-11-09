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
