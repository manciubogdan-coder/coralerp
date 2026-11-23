import { describe, expect, it } from "vitest";
import { computeStatus, isClosedStatus } from "@/lib/prereceptie";
import { pendingPrereceptions } from "@/lib/viziune/factoryState";

describe("prerecepție — lipsă marfă", () => {
  it("a document whose remaining goods never arrived can be closed", () => {
    expect(computeStatus([{ received_at: "2026-11-23" }, { received_at: null, missing_at: "2026-11-23" }])).toBe("lipsa");
    expect(isClosedStatus("lipsa")).toBe(true);
  });

  it("a document with goods still expected stays open", () => {
    expect(computeStatus([{ received_at: null, missing_at: "2026-11-23" }, { received_at: null }])).toBe("partial");
    expect(isClosedStatus("partial")).toBe(false);
  });

  it("everything received stays Recepționată, not lipsă", () => {
    expect(computeStatus([{ received_at: "x" }, { received_at: "y" }])).toBe("receptionata");
  });

  it("missing goods are no longer waiting at the gate", () => {
    const r = pendingPrereceptions([
      { id: "a", status: "partial", expected_date: "2026-11-23", linii: [
        { product_name: "Rucola", cantitate_document: 300, missing_at: "x" },
        { product_name: "Menta", cantitate_document: 50 },
      ] },
      { id: "b", status: "lipsa", expected_date: "2026-11-23", linii: [{ product_name: "PDZ", cantitate_document: 120, missing_at: "x" }] },
    ], "2026-11-23");
    expect(r.map((p) => p.id)).toEqual(["a"]);
    expect(r[0]).toMatchObject({ kgLeft: 50, linesLeft: 1 });
  });
});

import { matchMissingGroup, missingGoodsDay } from "../../supabase/functions/_shared/prereceptieMissing";
import { withMissingGoods } from "@/lib/receptionMissingRows";

describe("lipsă marfă — pe documentul ei", () => {
  it("belongs to the day the rest of the document was received, not the day it was marked", () => {
    expect(missingGoodsDay("2026-11-21", "2026-11-23T11:07:59Z", [
      { received_at: "2026-11-22T14:25:23Z", received_inventory_id: "a" },
      { received_at: null, received_inventory_id: null },
    ])).toBe("2026-11-22");
  });

  it("with nothing received it belongs to the announced delivery day", () => {
    expect(missingGoodsDay("2026-11-21", "2026-11-23T11:07:59Z", [])).toBe("2026-11-21");
  });

  it("goes on the document holding the receipts of the same pre-reception", () => {
    const groups = [
      { supplierId: "s1", supplierName: "De Divitiis", documentNumber: "587/A", rows: [{ inventory_id: "a" }] },
      { supplierId: "s2", supplierName: "Altul", documentNumber: "12", rows: [{ inventory_id: "b" }] },
    ];
    expect(matchMissingGroup(groups, { receivedInventoryIds: ["b"], document_number: "587/A", supplier_id: "s1", supplier_name: null })).toBe(groups[1]);
    expect(matchMissingGroup(groups, { receivedInventoryIds: [], document_number: " 587/a ", supplier_id: "s1", supplier_name: null })).toBe(groups[0]);
    expect(matchMissingGroup(groups, { receivedInventoryIds: [], document_number: "999", supplier_id: "s1", supplier_name: null })).toBeNull();
  });

  it("reception history shows the missing row right after its document", () => {
    const rows = [
      { id: "r1", receipt_date: "2026-11-22T14:25:00Z", document_number: "587/A", supplier_id: "s1" },
      { id: "r2", receipt_date: "2026-11-22T10:00:00Z", document_number: "12", supplier_id: "s2" },
    ];
    const out = withMissingGoods(rows, [{
      lineId: "L", prereceptieId: "P", document_number: "587/A", supplier_id: "s1", supplier_name: null, expected_date: null,
      product_id: null, product_name: "Rucola", manufacturer_id: null, manufacturer_name: null, cantitate_document: 40, unit: "kg",
      missing_at: "2026-11-23T11:00:00Z", missing_by_email: null, missing_reason: null, receivedInventoryIds: ["r1"], day: "2026-11-22",
    }]);
    expect(out.map((r) => r.id)).toEqual(["r1", "missing-L", "r2"]);
    expect(out[1]).toMatchObject({ quantity: 0, missing_doc_qty: 40 });
  });
});
