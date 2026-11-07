import { describe, expect, it } from "bun:test";
import { labourLines, configuredSheet, validPriceConfig } from "../../supabase/functions/_shared/priceConfig";
const defaults = { labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: 5, eurBufferPct: 0, techLossPct: 0, marginPct: 0 };
const data = { product: { unitsPerCase: 6 }, components: [
  { id: 1, name: "Busuioc", qty: 0.6, unit: "KG", kind: "mp" as const, price: 20, priceSource: "NIR", lossPct: 0 },
  { id: 2, name: "Caserolă", qty: 6, unit: "BUC", kind: "ambalaj" as const, price: 1, priceSource: "ultima intrare", lossPct: 5 },
] };
describe("uploaded price calculation rules", () => {
  for (const [name, total] of [["Giostra", 0.213], ["Flowpack", 0.426], ["Multihead — Monoprodus", 0.299], ["Spanac Mare", 0.566], ["Aromate", 0.778], ["Vracuri / Gastro", 0.811]] as const) {
    it(`${name} labour ≈ October 2026 CSV rate ${total}`, () => {
      const line = labourLines().find(l => l.name === name)!;
      expect(line.total!).toBeCloseTo(total, 9);
      const { sheet } = configuredSheet(data, defaults, { labourLine: name });
      expect(sheet.labour + sheet.utilities).toBeCloseTo(6 * line.total!, 4);
    });
  }
  it("packaging technological loss applies to packaging price", () => {
    expect(configuredSheet(data, defaults).sheet.packaging).toBe(6.3);
  });
  it("supply is cost per pallet times effective raw-material pallets", () => {
    const { sheet } = configuredSheet(data, defaults, { supplyPerPallet: 220, components: { 1: { kgPerPallet: 220, lossPct: 20 } } });
    expect(sheet.supplyTransport).toBe(0.75);
  });
  it("distribution uses route cost divided by invoiced pallets and product pieces/pallet", () => {
    const { sheet } = configuredSheet(data, defaults, { route: "Bulgaria", distributionTotal: 6000, distributionPallets: 10, piecesPerPallet: 600 });
    expect(sheet.logistics).toBe(6);
  });
  it("manual prices and recipe quantities override Senior without changing source data", () => {
    const { sheet } = configuredSheet(data, defaults, { components: { 1: { price: 30, qty: 1 } } });
    expect(sheet.rawMaterial).toBe(30);
    expect(data.components[0].price).toBe(20);
  });
  it("washed mixtures cannot silently use an invented labour cost", () => {
    expect(configuredSheet(data, defaults, { labourLine: "Multihead — Mixte SPĂLATE" }).sheet.missingInputs).toContain("Viteză linie mixte spălate (buc/oră, conform mix)");
  });
  it("missing logistics prevents a complete price", () => {
    expect(configuredSheet(data, defaults).sheet.complete).toBe(false);
  });
  it("complete configured scenario does not double count the factory overhead", () => {
    const { sheet } = configuredSheet(data, defaults, { labourLine: "Aromate", supplyPerPallet: 220, distributionPerPallet: 600, piecesPerPallet: 600, feePct: 0, components: { 1: { kgPerPallet: 220 } } });
    expect(sheet.complete).toBe(true);
    expect(sheet.productionCost).toBeCloseTo(12 + 6.3 + 0.6 + 6 * 0.778, 4);
  });
  it("validates stored scenario overrides and rejects invalid percentages", () => {
    expect(validPriceConfig({ feePct: 100 })).toBeNull();
    expect(validPriceConfig({ piecesPerPallet: 0 })).toBeNull();
    expect(validPriceConfig({ components: { 1: { lossPct: 100 } } })).toBeNull();
    expect(validPriceConfig({ rawPriceMode: "week", route: "Moldova", rates: { marginPct: 20 } })).toEqual({ rawPriceMode: "week", route: "Moldova", rates: { marginPct: 20 } });
  });
});