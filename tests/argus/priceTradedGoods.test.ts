import { describe, expect, it } from "bun:test";
import { componentKind, computeSheet, gramsPerPiece } from "../../supabase/functions/_shared/priceSheet";
import { configuredSheet } from "../../supabase/functions/_shared/priceConfig";
import { orderedPallets, tradedGood } from "../../supabase/functions/_shared/priceSourceRules";

const zero = { labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: 5, eurBufferPct: 0, techLossPct: 0, marginPct: 0 };
const bio = { id: 3809, name: "BABY SPANAC BIO 100 GR", qty: 8, unit: "BUC", kind: "marfa" as const, price: 2, priceSource: "NIR", lossPct: 0, piecesPerPallet: 1000 };

describe("Bio Baby Spanac — marfă revândută ca atare", () => {
  it("is a traded good with 1000 pieces per pallet, labels stay packaging", () => {
    expect(componentKind("BABY SPANAC BIO 100 GR", "BUC")).toBe("marfa");
    expect(tradedGood("Spanac bio")?.piecesPerPallet).toBe(1000);
    expect(componentKind("ETICHETE BABY SPANAC BIO LIDL", "BUC")).toBe("ambalaj");
    expect(gramsPerPiece("BABY SPANAC BIO 100 GR")).toBe(100);
  });
  it("pays supply transport on pieces ÷ 1000 per pallet", () => {
    const s = computeSheet({ unitsPerCase: 8, components: [bio], rates: { ...zero, supplyPerPallet: 452, supplyBasis: "pallet" } });
    expect(s.supplyTransport).toBeCloseTo(8 / 1000 * 452, 4);
    expect(s.rawMaterial).toBe(16);
  });
  it("has no direct labour, only the line's factory overhead", () => {
    const { sheet } = configuredSheet({ product: { unitsPerCase: 8 }, components: [bio] }, zero,
      { tradedGood: true, labourLine: "Multihead — Monoprodus", supplyPerPallet: 452, distributionPerPallet: 600, piecesPerPallet: 1000, feePct: 0 });
    expect(sheet.labour).toBe(0);
    expect(sheet.utilities).toBeCloseTo(8 * 0.087, 4);
  });
  it("counts supplier orders in pieces as pallets", () => {
    const r = orderedPallets([{ name: "Spanac bio", unit: "Buc", qty: 2000, supplier: "IT", day: "2026-11-02" }]);
    expect(r.pallets).toBe(2);
    expect(r.skipped).toHaveLength(0);
  });
});
