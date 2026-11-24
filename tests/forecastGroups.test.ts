import { describe, it, expect } from "vitest";
import { forecastGroupOf, suggestedOrderFor, summarizePallets } from "../src/lib/forecastGroups";

describe("forecast groups", () => {
  it("vegetables and fruits get their own list", () => {
    expect(forecastGroupOf("Rosii cherry")).toBe("Legume și fructe");
    expect(forecastGroupOf("Rucola")).toBe("Salate");
    expect(forecastGroupOf("Ceapa verde")).toBe("Aromate");
  });
  it("suggested order covers tomorrow plus buffer minus closing without adding PT", () => {
    expect(suggestedOrderFor(50, [20, 30, 40], 0, 25)).toBe(5);
    expect(suggestedOrderFor(10, [20, 30, 40], 0, 25)).toBe(45);
    expect(suggestedOrderFor(10, [20, 30, 40], 0, 25)).not.toBe(48);
  });
});

describe("pallet totals", () => {
  it("sums pallets per pallet weight class", () => {
    const s = summarizePallets([
      { name: "Capatani salata verde", unit: "kg", qty: 600 },
      { name: "Rucola 100 g", unit: "kg", qty: 220 },
    ]);
    expect(s.byClass).toEqual([
      { perPalletKg: 400, kg: 600, pallets: 1.5 },
      { perPalletKg: 220, kg: 220, pallets: 1 },
    ]);
    expect(s.kg).toBe(820);
    expect(s.pallets).toBeCloseTo(2.5, 6);
    expect(s.wholePallets).toBe(3);
  });

  it("ignores pieces without a pallet weight and zero quantities", () => {
    const s = summarizePallets([
      { name: "Rosii cherry", unit: "kg", qty: 400 },
      { name: "Etichete", unit: "buc", qty: 5000 },
      { name: "Busuioc", unit: "kg", qty: 0 },
    ]);
    expect(s.pallets).toBe(0);
    expect(s.kg).toBe(0);
    expect(s.wholePallets).toBe(0);
    expect(s.byClass).toEqual([]);
  });

  it("rounds each product up to whole pallets for loading", () => {
    const s = summarizePallets([
      { name: "Radicchio rosu", unit: "kg", qty: 100 },
      { name: "Baby spanac bio", unit: "kg", qty: 30 },
    ]);
    expect(s.pallets).toBeCloseTo(100 / 500 + 30 / 220, 6);
    expect(s.wholePallets).toBe(2);
  });
});

import { palletKgFor as _pk } from "../src/lib/forecastGroups";
import { test as _t, expect as _e } from "vitest";
_t("kg pe palet", () => {
  _e(_pk("Capatani salata verde")).toBe(400);
  _e(_pk("Radicchio rosu")).toBe(500);
  _e(_pk("Baby spanac bio")).toBe(220);
  _e(_pk("Busuioc")).toBe(200);
});

describe("packaging weekly order plan", () => {
  it("each week orders only what earlier suggested orders did not cover", async () => {
    const { sequentialOrderPlan } = await import("../src/lib/forecastGroups");
    // stoc final fără comenzi: -50, -150, -250; țintă 100 pe săptămână
    expect(sequentialOrderPlan([-50, -150, -250], [100, 100, 100])).toEqual([150, 100, 100]);
    expect(sequentialOrderPlan([500, 300, null], [100, 100, 100])).toEqual([0, 0, null]);
  });
  it("order-by date is delivery minus lead time", async () => {
    const { orderByDay } = await import("../src/lib/forecastGroups");
    expect(orderByDay("2026-11-23", 14)).toBe("2026-11-09");
    expect(orderByDay("2026-12-01", 7)).toBe("2026-11-24");
  });
});

import { palletKgFor as kgPal } from "../src/lib/forecastGroups";
describe("kg pe palet", () => {
  it("aromate 200", () => expect(kgPal("BUSUIOC VRAC")).toBe(200));
  it("baby leaf 220", () => expect(kgPal("RUCOLA VRAC")).toBe(220));
  it("indivia riccia 400", () => expect(kgPal("INDIVIA RICCIA VRAC")).toBe(400));
  it("scarola 400", () => expect(kgPal("SCAROLA VRAC")).toBe(400));
  it("pzd 400", () => expect(kgPal("PAN DI ZUCHERO VRAC")).toBe(400));
  it("radicchio 500", () => expect(kgPal("RADICCHIO ROSSO")).toBe(500));
  it("iceberg 400", () => expect(kgPal("ICEBERG VRAC")).toBe(400));
});
