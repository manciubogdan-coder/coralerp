import { describe, it, expect } from "vitest";
import { buildLines, readyByStore, producedOf } from "@/lib/viziune/factoryState";

describe("viziune factory state", () => {
  it("a line with an active session is working and counts its workers", () => {
    const [l] = buildLines(
      [{ id: "L1", nume: "Giostra", status: "activa" }],
      [{ id: "o1", linie_id: "L1", status: "in_progress", cantitate: 100, cantitate_produsa_sesiuni: 40, productie_produse: { nume: "Menta 30 g" } }],
      [{ id: "s1", comanda_id: "o1", linie_id: "L1", nume_operator: "Ana", numar_angajati: 4 }],
    );
    expect(l.status).toBe("lucreaza");
    expect(l.workers).toBe(4);
    expect(l.produced).toBe(40);
    expect(l.currentProduct).toBe("Menta 30 g");
  });
  it("produced pieces never exceed the ordered quantity", () => {
    expect(producedOf({ id: "x", status: "completed", cantitate: 10, cantitate_produsa_sesiuni: 15 })).toBe(10);
  });
  it("advance orders never show up as a store at dispatch", () => {
    const r = readyByStore([
      { id: "a", status: "completed", cantitate: 50, cantitate_produsa_sesiuni: 50, magazin: "PRODUCTIE_AVANS" },
      { id: "b", status: "completed", cantitate: 20, cantitate_produsa_sesiuni: 20, magazin: "LIDL ROMAN" },
    ]);
    expect(r).toEqual([{ store: "LIDL ROMAN", pieces: 20, orders: 1 }]);
  });
});

import { pendingPrereceptions } from "@/lib/viziune/factoryState";
describe("viziune prereceptions", () => {
  it("only announced deliveries due today or overdue with unreceived lines wait at the gate", () => {
    const r = pendingPrereceptions([
      { id: "a", status: "asteptare", expected_date: "2026-11-13", supplier_name: "Agro", linii: [{ product_name: "Rucola", cantitate_document: 300 }] },
      { id: "b", status: "partial", expected_date: "2026-11-12", supplier_name: "Fresh", linii: [{ product_name: "Menta", cantitate_document: 50, received_at: "x" }, { product_name: "PDZ", cantitate_document: 120 }] },
      { id: "c", status: "asteptare", expected_date: "2026-11-14", linii: [{ product_name: "X", cantitate_document: 10 }] },
      { id: "d", status: "receptionata", expected_date: "2026-11-13", linii: [{ product_name: "Y", cantitate_document: 10, received_at: "x" }] },
    ], "2026-11-13");
    expect(r.map((p) => p.id)).toEqual(["b", "a"]);
    expect(r[0]).toMatchObject({ late: true, kgLeft: 120, linesLeft: 1 });
  });
});
