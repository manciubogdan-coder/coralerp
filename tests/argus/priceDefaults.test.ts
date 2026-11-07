import { expect, it } from "bun:test";
import { priceDates, prefilledConfig, suggestedLabour } from "../../supabase/functions/_shared/priceDefaults";
const component = { id: 1, name: "Baby spanac", kind: "mp" as const, qty: 0.4, unit: "KG", price: 11, priceSource: "NIR", lossPct: 13.5 };
it("last week includes current November entries, not October's closing week", () => {
  expect(priceDates(2026, 11, "2026-11-07")).toEqual({ startDay: "2025-11-08", weekStart: "2026-11-01", endDay: "2026-11-08" });
});
it("historical October price includes October 31", () => {
  expect(priceDates(2026, 10, "2026-11-07").endDay).toBe("2026-11-01");
});
it("Baby spanac mono is not assigned to washed mixtures", () => {
  expect(suggestedLabour("BABY SPANAC 100 MI NOU", [component])).toBe("Multihead — Monoprodus");
});
it("calculated defaults prefill rates and keep manual adjustments", () => {
  const d = { product: { unitsPerCase: 4 }, components: [component], defaults: { supplyPerPallet: 250, labourLine: "Multihead — Monoprodus", rates: { labourPerPiece: 0.212, utilitiesPerPiece: 0.087 }, components: { 1: { kgPerPallet: 220 } } } };
  const c = prefilledConfig(d, { rates: { labourPerPiece: 0.3 } });
  expect(c.rates?.labourPerPiece).toBe(0.3);
  expect(c.rates?.utilitiesPerPiece).toBe(0.087);
  expect(c.supplyPerPallet).toBe(250);
  expect(c.components?.[1]?.kgPerPallet).toBe(220);
});
it("changing country cannot inherit the previous country's cost", () => {
  expect(prefilledConfig({ product: { unitsPerCase: 4 }, components: [], defaults: { route: "România", distributionPerPallet: 300 } }, { route: "Bulgaria" }).distributionPerPallet).toBeUndefined();
});