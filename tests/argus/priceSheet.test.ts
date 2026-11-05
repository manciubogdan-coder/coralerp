import { describe, expect, it } from "bun:test";
import { componentKind, computeSheet, effectiveQty, isServiceComponent, ratePeriod, withMargin, matchLoss } from "../../supabase/functions/_shared/priceSheet";


const rates = { labourPerPiece: 0.778, utilitiesPerPiece: 0.0567, supplyPerKg: 2, distributionPerPiece: 4.125, clientFeePerPiece: 0.5584, eurRate: 5.2473, eurBufferPct: 1.5, techLossPct: 0, marginPct: 0 };

describe("price sheet", () => {
  it("raw material loss: 0.6 kg recipe at 19% becomes 0.7407 kg", () => {
    expect(effectiveQty(0.6, 19)).toBeCloseTo(0.7407, 4);
  });

  it("margin is taken from the selling price: 100 at 20% sells for 125", () => {
    expect(withMargin(100, 20)).toBeCloseTo(125, 6);
  });

  it("weighed vegetables are raw material, foil and boxes are packaging, labour rows are services", () => {
    expect(componentKind("BUSUIOC VRAC", "KG")).toBe("mp");
    expect(componentKind("FOLIE FLOW PACK MARE 470 MM", "KG")).toBe("ambalaj");
    expect(componentKind("CUTII MIXTE 6", "BUC")).toBe("ambalaj");
    expect(isServiceComponent("MANOPERA PRODUCTIE")).toBe(true);
    expect(isServiceComponent("CHELTUIELI FIXE PRODUCTIE")).toBe(true);
  });

  it("Busuioc 100 g Bulgaria case of 6: components, labour per piece and EUR with 1.5% buffer add up", () => {
    const s = computeSheet({
      unitsPerCase: 6,
      rates,
      components: [
        { id: 1, name: "BUSUIOC VRAC", qty: 0.6, unit: "KG", kind: "mp", price: 38.72, priceSource: "t", lossPct: 19 },
        { id: 2, name: "CASEROLE 900", qty: 6, unit: "BUC", kind: "ambalaj", price: 0.214, priceSource: "t", lossPct: 0 },
      ],
    });
    expect(s.rawMaterial).toBeCloseTo(28.6815, 3);
    expect(s.supplyTransport).toBeCloseTo(1.4815, 3);
    expect(s.packaging).toBeCloseTo(1.284, 4);
    expect(s.labour).toBeCloseTo(4.668, 4);
    expect(s.productionCost).toBeCloseTo(28.6815 + 1.4815 + 1.284 + 4.668 + 0.3402, 2);
    expect(s.delivered).toBeCloseTo(s.factoryGate + 6 * 4.125, 4);
    expect(s.clientPriceEur).toBeCloseTo(s.clientPrice / (5.2473 * 1.015), 3);
    expect(s.perPiece.clientPrice).toBeCloseTo(s.clientPrice / 6, 3);
  });

  it("a component without a Senior price is listed as missing", () => {
    const s = computeSheet({ unitsPerCase: 1, rates, components: [{ id: 1, name: "X", qty: 1, unit: "BUC", kind: "ambalaj", price: null, priceSource: "-", lossPct: 0 }] });
    expect(s.missingPrices).toEqual(["X"]);
  });

  it("rates use the 12 whole months before the chosen month", () => {
    expect(ratePeriod(2026, 11)).toEqual({ from: 202511, to: 202610, startDay: "2025-11-01", endDay: "2026-11-01" });
    expect(ratePeriod(2026, 1)).toEqual({ from: 202501, to: 202512, startDay: "2025-01-01", endDay: "2026-01-01" });
  });

  it("technological loss comes from the Coral ERP raw material whose name is in the Senior name", () => {
    expect(matchLoss("BUSUIOC VRAC", [{ name: "Busuioc", pt_percent: 19 }, { name: "Busuioc rosu", pt_percent: 30 }])).toEqual({ name: "Busuioc", pt: 19 });
  });
});
