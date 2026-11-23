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
