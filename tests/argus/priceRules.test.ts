import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_PRICE_RULES, setPriceRules, validPriceRules, priceRules } from "../../supabase/functions/_shared/priceRules";
import { configuredSheet, labourDefaults } from "../../supabase/functions/_shared/priceConfig";
import { configuredRawPalletKg, deliveryRoute, orderedPallets, tradedGood, buildRoutes } from "../../supabase/functions/_shared/priceSourceRules";

const zero = { labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: 5, eurBufferPct: 0, techLossPct: 0, marginPct: 0 };
const data = { product: { unitsPerCase: 10 }, components: [] };
const edited = (patch: Record<string, unknown>) => {
  const v = validPriceRules({ ...structuredClone(DEFAULT_PRICE_RULES), ...patch });
  if ("error" in v) throw new Error(v.error);
  return v.rules;
};
afterEach(() => setPriceRules(DEFAULT_PRICE_RULES));

describe("editable price rules", () => {
  test("defaults keep the agreed values", () => {
    const r = priceRules();
    expect(r.truckPallets).toBe(26);
    expect(r.marginPct).toBe(15);
    expect(r.labourOverheadPct).toBe(41);
    expect(r.lines.find((l) => l.name === "Aromate")?.people).toBe(8);
    expect(configuredRawPalletKg("Mărar vrac")).toBe(220);
    expect(configuredRawPalletKg("RADICCHIO")).toBe(500);
    expect(tradedGood("BABY SPANAC BIO 100 GR")?.piecesPerPallet).toBe(1000);
    expect(tradedGood("SPANAC BIOGREE")).toBeNull();
  });
  test("people on a line change the labour of every product on it", () => {
    const lines = DEFAULT_PRICE_RULES.lines.map((l) => (l.name === "Aromate" ? { ...l, people: 10 } : l));
    setPriceRules(edited({ lines }));
    expect(labourDefaults("Aromate").labourPeople).toBe(10);
    const { rates } = configuredSheet(data, zero, { labourLine: "Aromate" });
    expect(rates.labourPerPiece).toBeCloseTo(10 * 34.5 / 500, 6);
    expect(rates.utilitiesPerPiece).toBeCloseTo(10 * 34.5 / 500 * (0.226 / 0.552), 6);
  });
  test("truck capacity, pallet norms and county routes come from the rules", () => {
    setPriceRules(edited({ truckPallets: 20, palletGroups: [{ label: "Frunze", keywords: ["rucola"], kgPerPallet: 200 }], countyRoutes: { CLUJ: "TURDA-IERNUT" } }));
    const o = orderedPallets([{ name: "Rucola", unit: "kg", qty: 4400, supplier: "A", day: "2026-11-02" }]);
    expect(o.pallets).toBe(22);
    expect(o.trucks).toBe(2);
    expect(deliveryRoute({ name: "MAGAZIN", judet: "Cluj", country: "Romania" })).toBe("TURDA-IERNUT");
  });
  test("route pairs pool cost and pallets", () => {
    setPriceRules(edited({ routePairs: [["ROMAN", "CRAIOVA"]] }));
    const r = buildRoutes([{ pid: 1, name: "X - ROMAN", judet: "", pallets: 10 }, { pid: 2, name: "Y - CRAIOVA", judet: "", pallets: 30 }],
      [{ line: "TRANSPORT DIST ROMAN", trips: 1, total: 1000 }, { line: "TRANSPORT DIST CRAIOVA", trips: 1, total: 3000 }]);
    expect(r.routes.find((x) => x.route === "ROMAN")?.perPallet).toBe(100);
  });
  test("built-in lines cannot be removed and numbers are bounded", () => {
    expect("error" in validPriceRules({ ...DEFAULT_PRICE_RULES, lines: DEFAULT_PRICE_RULES.lines.slice(1) })).toBe(true);
    expect("error" in validPriceRules({ ...DEFAULT_PRICE_RULES, truckPallets: 0 })).toBe(true);
    expect("error" in validPriceRules({ ...DEFAULT_PRICE_RULES, marginPct: 95 })).toBe(true);
  });
});

describe("client network fees (Taxe_2026.xlsx)", () => {
  const { clientFeeFor } = require("../../supabase/functions/_shared/priceRules");
  test.each([
    ["SELGROS CASH & CARRY SRL - BUCURESTI 13799", "SELGROS CASH & CARRY SRL", 8.3],
    ["SELGROS CASH & CARRY SRL - BUCURESTI 13203", "SELGROS CASH & CARRY SRL", 21.9],
    ["SELGROS CASH & CARRY SRL - BUCURESTI 1410059", "SELGROS CASH & CARRY SRL", 21.9],
    ["PROFI ROM FOOD SRL/PLATFORMA FRESH CLUJ", "PROFI ROM FOOD SRL", 18.5],
    ["MEGA IMAGE SRL", "MEGA IMAGE SRL", 20],
    ["AUCHAN ROMÂNIA SA - AUCHAN WAREHOUSE CAMPUS 2836", "AUCHAN ROMÂNIA SA", 0],
    ["VALENCIA TRADING OFFICE", "VALENCIA TRADING OFFICE", 3],
    ["ICS METRO CASH & CARRY MOLDOVA SRL", "ICS METRO CASH & CARRY MOLDOVA SRL", 3],
    ["METRO CASH & CARRY MILITARI", "METRO CASH & CARRY ROMANIA SRL", 0.8],
  ])("%s → %d%%", (name, central, pct) => {
    expect(clientFeeFor(name, central)?.pct).toBe(pct);
  });
  test("clients missing from the table pay 0", () => {
    expect(clientFeeFor("TENIS PROFI SRL", "TENIS PROFI SRL")).toBeNull();
    expect(clientFeeFor("LIDL DISCOUNT SRL - ROMAN", "LIDL DISCOUNT SRL")).toBeNull();
  });
});
