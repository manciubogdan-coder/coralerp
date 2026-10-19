import { describe, expect, test } from "bun:test";
import { buildGroupResolver, matrixFromHistory } from "../../src/lib/productie/avansGrouping";

const products = [
  { id: "a", nume: "BUSUIOC 30" },
  { id: "b", nume: "Busuioc 30 g" },
  { id: "c", nume: "BUSUIOC 30 GR" },
  { id: "d", nume: "BUSUIOC 30" }, // cod duplicat, nu e în grupă
  { id: "e", nume: "Menta 30 g" },
];
const groupOf = buildGroupResolver({ a: "Busuioc 30 g", b: "Busuioc 30 g", c: "Busuioc 30 g" }, products);

describe("grupare producție în avans", () => {
  test("variantele din aceeași grupă devin un singur rând pe zi", () => {
    // 3 luni la rând, de fiecare dată altă denumire de busuioc 30
    const rows = matrixFromHistory([
      { produs_id: "a", produs_nume: "BUSUIOC 30", linie_id: "L1", linie_nume: "Aromate", cantitate: 900, data_productie: "2026-10-05" },
      { produs_id: "b", produs_nume: "Busuioc 30 g", linie_id: "L1", linie_nume: "Aromate", cantitate: 1000, data_productie: "2026-10-12" },
      { produs_id: "c", produs_nume: "BUSUIOC 30 GR", linie_id: "L1", linie_nume: "Aromate", cantitate: 800, data_productie: "2026-10-19" },
    ], groupOf);
    expect(rows.length).toBe(1);
    expect(rows[0].weekday).toBe(1);
    expect(rows[0].cantitate).toBe(900);
    expect(rows[0].produs_id).toBe("b"); // denumirea identică cu grupa
  });

  test("codul duplicat fără grupă e recunoscut după denumire", () => {
    expect(groupOf("d", "BUSUIOC 30")).toBe("Busuioc 30 g");
  });

  test("două variante în aceeași zi se adună", () => {
    const rows = matrixFromHistory([
      { produs_id: "a", produs_nume: "BUSUIOC 30", linie_id: null, linie_nume: null, cantitate: 300, data_productie: "2026-10-05" },
      { produs_id: "c", produs_nume: "BUSUIOC 30 GR", linie_id: null, linie_nume: null, cantitate: 200, data_productie: "2026-10-05" },
    ], groupOf);
    expect(rows[0].cantitate).toBe(500);
  });

  test("produsele din grupe diferite rămân separate", () => {
    const rows = matrixFromHistory([
      { produs_id: "b", produs_nume: "Busuioc 30 g", linie_id: null, linie_nume: null, cantitate: 100, data_productie: "2026-10-05" },
      { produs_id: "e", produs_nume: "Menta 30 g", linie_id: null, linie_nume: null, cantitate: 100, data_productie: "2026-10-05" },
    ], groupOf);
    expect(rows.length).toBe(2);
  });
});
