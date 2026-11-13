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
