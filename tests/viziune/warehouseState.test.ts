import { describe, expect, it } from "vitest";
import { depotDetail, pickingDetail, piecesPerPallet, type PalletInfo } from "@/lib/viziune/warehouseState";
import type { VOrder } from "@/lib/viziune/factoryState";

const info: PalletInfo = {
  raw: { "Baby spanac": 220, "Salata iceberg": 400, "Morcovi": null },
  products: { rucola: ["RUC-LIDL", "RUC-MEGA"], menta: ["MEN-1", "MEN-2", "MEN-3"], fara: ["X"] },
  stores: { "rucola|LIDL ARICESTI": "RUC-LIDL" },
  perCode: { "RUC-LIDL": 600, "RUC-MEGA": 480, "MEN-1": 900, "MEN-2": 900, "MEN-3": 1200 },
};
const order = (o: Partial<VOrder>): VOrder => ({ id: Math.random().toString(36).slice(2), status: "completed", cantitate: 0, ...o });

describe("pieces per pallet from Senior", () => {
  it("uses the Senior article the store itself orders", () => {
    expect(piecesPerPallet(info, "rucola", "LIDL DISCOUNT SRL - ARICESTI")).toEqual({ pieces: 600, source: "magazin" }); // same store key
    expect(piecesPerPallet(info, "rucola", "LIDL ARICESTI")).toEqual({ pieces: 600, source: "magazin" });
  });
  it("otherwise the most common size among the product's codes, marked approximate when they differ", () => {
    expect(piecesPerPallet(info, "menta", "MEGA IMAGE")).toEqual({ pieces: 900, source: "aproximativ" });
    expect(piecesPerPallet(info, "rucola", "METRO")).toEqual({ pieces: 480, source: "aproximativ" }); // tie: smaller pallet
  });
  it("no size when Senior has none", () => {
    expect(piecesPerPallet(info, "fara", "LIDL ARICESTI")).toBeNull();
    expect(piecesPerPallet(info, null, "LIDL ARICESTI")).toBeNull();
  });
});

describe("Picking: what is ready per store", () => {
  const orders = [
    order({ magazin: "LIDL ARICESTI", produs_id: "rucola", cantitate: 1200, cantitate_reala_produsa: 1200, productie_produse: { nume: "Rucola 125g" }, linie_id: "L1" }),
    order({ magazin: "LIDL ARICESTI", produs_id: "rucola", cantitate: 600, cantitate_reala_produsa: 300, status: "partial", productie_produse: { nume: "Rucola 125g" }, linie_id: "L2" }),
    order({ magazin: "LIDL ARICESTI", produs_id: "fara", cantitate: 50, cantitate_reala_produsa: 50, productie_produse: { nume: "Fără palet" } }),
    order({ magazin: "PRODUCTIE_AVANS", produs_id: "rucola", cantitate: 999, cantitate_reala_produsa: 999 }),
    order({ magazin: "MEGA", produs_id: "menta", cantitate: 100, status: "pending" }),
  ];
  it("groups products per store and counts pallets only where the size is known", () => {
    const [s, ...rest] = pickingDetail(orders, info);
    expect(rest).toHaveLength(0); // advance production and nothing-produced stores are left out
    expect(s.store).toBe("LIDL ARICESTI");
    expect(s.pieces).toBe(1550);
    const r = s.products.find((p) => p.productId === "rucola")!;
    expect(r.produced).toBe(1500);
    expect(r.ordered).toBe(1800);
    expect(r.lineIds).toEqual(["L1", "L2"]);
    expect(r.pallets).toBeCloseTo(2.5);
    expect(s.pallets).toBeCloseTo(2.5);
    expect(s.missing).toBe(1);
  });
});

describe("Raw-material store: products and lots", () => {
  const rows = [
    { name: "Baby spanac", quantity: 110, unit: "kg", lot_number: "L-2", receipt_date: "2026-11-13", suppliers: { name: "Agro" } },
    { name: "Baby spanac", quantity: 330, unit: "kg", lot_number: "L-1", receipt_date: "2026-11-09", suppliers: { name: "Agro" } },
    { name: "Morcovi", quantity: 50, unit: "kg", lot_number: null, receipt_date: "2026-11-14" },
    { name: "Salata iceberg", quantity: 0, unit: "kg" },
  ];
  it("lists every lot oldest first with its age and pallets from the kg/pallet rule", () => {
    const [spanac, morcovi, ...rest] = depotDetail(rows, info, "2026-11-14");
    expect(rest).toHaveLength(0);
    expect(spanac.qty).toBe(440);
    expect(spanac.pallets).toBeCloseTo(2);
    expect(spanac.lots.map((l) => [l.lot, l.ageDays])).toEqual([["L-1", 5], ["L-2", 1]]);
    expect(morcovi.pallets).toBeNull();
    expect(morcovi.lots[0].lot).toBe("fără lot");
  });
});
