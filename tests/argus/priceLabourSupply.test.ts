import { describe, expect, test } from "bun:test";
import { configuredSheet, labourDefaults, lineHourCost, MIXED_WASHED } from "../../supabase/functions/_shared/priceConfig";
import { prefilledConfig } from "../../supabase/functions/_shared/priceDefaults";

const zero = { labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: 5, eurBufferPct: 0, techLossPct: 0, marginPct: 0 };
const mp = { id: 1, name: "BABY SPANAC VRAC", qty: 0.4, unit: "KG", kind: "mp" as const, price: 10, priceSource: "t", lossPct: 20, kgPerPallet: 200 };
const data = { product: { unitsPerCase: 4 }, components: [mp] };

describe("labour from the October 2026 CSV", () => {
  test("monoprodus uses the CSV tariff 0.212 + 0.087 per piece", () => {
    const { sheet } = configuredSheet(data, zero, prefilledConfig(data, { labourLine: "Multihead — Monoprodus" }));
    expect(sheet.labour).toBe(0.848);
    expect(sheet.utilities).toBe(0.348);
  });
  test("CSV hourly cost per person: 0.212 × 975 ÷ 6", () => {
    expect(lineHourCost("Multihead — Monoprodus")).toBeCloseTo(34.45, 2);
    expect(labourDefaults(MIXED_WASHED).labourPeople).toBe(13);
  });
  test("washed mixes need the mix speed and never show zero labour as complete", () => {
    const { sheet } = configuredSheet(data, zero, prefilledConfig(data, { labourLine: MIXED_WASHED }));
    expect(sheet.missingInputs).toContain("Viteză linie mixte spălate (buc/oră, conform mix)");
  });
  test("washed mixes: 13 people × 34.45 lei/h ÷ 500 buc/h, +41% regie", () => {
    const { rates } = configuredSheet(data, zero, prefilledConfig(data, { labourLine: MIXED_WASHED, labourSpeed: 500 }));
    expect(rates.labourPerPiece).toBeCloseTo(0.8957, 4);
    expect(rates.utilitiesPerPiece).toBeCloseTo(0.8957 * 0.41, 4);
  });
});

describe("supply transport per pallet and per kg", () => {
  // October 2026 Senior: 307317.46 lei on 624.01, 925 NIR pallets, 187635.32 kg raw materials.
  const defaults = { supplyBasis: "pallet" as const, supplyTotal: 307317.46, supplyPallets: 925, supplyKg: 187635.32 };
  test("both tariffs are derived from the closed month", () => {
    const cfg = prefilledConfig({ ...data, defaults }, {});
    expect(cfg.supplyPerPallet).toBeCloseTo(332.2351, 3);
    expect(cfg.rates?.supplyPerKg).toBeCloseTo(1.6378, 3);
  });
  test("chosen basis drives the total: 0.5 kg effective", () => {
    const pallet = configuredSheet(data, zero, prefilledConfig({ ...data, defaults }, {})).sheet;
    expect(pallet.supplyTransport).toBeCloseTo(0.5 / 200 * 307317.46 / 925, 3);
    const kg = configuredSheet(data, zero, prefilledConfig({ ...data, defaults }, { supplyBasis: "kg" })).sheet;
    expect(kg.supplyTransport).toBeCloseTo(0.5 * 307317.46 / 187635.32, 3);
  });
});
