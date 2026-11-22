import { describe, expect, it } from "vitest";
import { sheetFor } from "../../src/components/argus/PartnerMirror";

// SPANAC 500 GR LIDL: bax 5 buc, 2,89 kg spanac/bax, 220 kg/palet; camion 10.597,15 lei ÷ 23,1053 paleți = 458,65 lei/palet.
const item: any = {
  product: { id: 1, name: "SPANAC 500 GR LIDL", unitsPerCase: 5 },
  components: [{ id: 10, name: "SPANAC", qty: 2.5, unit: "kg", kind: "mp", price: 6.5, annualPrice: 6.5, lossPct: 13.5, kgPerPallet: 220, priceSource: "test" }],
  defaults: {
    route: "România", supplyBasis: "pallet", supplyTotal: 10597.1538, supplyPallets: 23.1053, supplyKg: 5491,
    supplyPerPallet: 458.6466, rates: { supplyPerKg: 1.9299, marginPct: 15 }, components: { "10": { kgPerPallet: 220 } },
  },
};

describe("Oglindă parteneri: transport aprovizionare pe palet, ca în Calculator de preț", () => {
  it("SPANAC 500 GR LIDL: 1,2051 lei/buc la 458,65 lei/palet, nu tariful pe kg", () => {
    const s = sheetFor(item, { logistics: {}, eur: { rate: 5 } } as any, "LIDL");
    expect(s.supplyTransport / s.unitsPerCase).toBeCloseTo(1.2051, 3);
  });
});

import { lastClosedMonth } from "../../supabase/functions/_shared/priceDefaults";
describe("luna implicită a costurilor: ultima lună încheiată", () => {
  it("22.11.2026 → octombrie 2026; ianuarie → decembrie anul trecut", () => {
    expect(lastClosedMonth("2026-11-22")).toEqual({ year: 2026, month: 10 });
    expect(lastClosedMonth("2027-01-05")).toEqual({ year: 2026, month: 12 });
  });
});
