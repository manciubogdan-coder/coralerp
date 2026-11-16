import { describe, expect, it } from "vitest";
import { distributionCheck, supplyCheck } from "./transportCheck";

describe("transport check", () => {
  it("supply lei/palet is cost per truck ÷ pallets per truck, and equals lei/kg × the average pallet kg, not × 220", () => {
    const c = supplyCheck({ supplyTotal: "10924.65", supplyPallets: "18", supplyKg: "5040" });
    expect(c.perPallet).toBeCloseTo(606.925, 3);
    expect(c.perKg).toBeCloseTo(2.1676, 4);
    expect(c.avgPalletKg).toBe(280);
    expect(c.perKg! * c.avgPalletKg!).toBeCloseTo(c.perPallet!, 6);
    expect(c.leafPalletByKg).toBeCloseTo(476.87, 2);
  });
  it("distribution lei/palet is lei/cursă ÷ paleți/cursă", () => {
    const d = distributionCheck({ distributionTotal: "98550.88", distributionTrips: "19", distributionPalletsPerTrip: "7.5362" });
    expect(d.perTrip).toBeCloseTo(5186.89, 2);
    expect(d.perPallet).toBeCloseTo(688.26, 1);
  });
  it("client average without trips is cost ÷ pallets", () => {
    expect(distributionCheck({ distributionTotal: "1000", distributionPallets: "4" }).perPallet).toBe(250);
  });
});
