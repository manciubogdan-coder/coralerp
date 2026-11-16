import { describe, expect, test } from "bun:test";
import { buildOrdersSummary, summarySheetRows } from "../../src/lib/productie/ordersSummary";

const o = (magazin: string, produs: string, cantitate: number, extra: Record<string, unknown> = {}) =>
  ({ magazin, produs, cantitate, punct_livrare: "Standard", numar_comanda: String(Math.random()), ...extra });

describe("centralizator comenzi", () => {
  test("total bucăți pe fiecare magazin și pe zi", () => {
    const s = buildOrdersSummary([
      o("Lidl Roman", "Rucola 125", 40), o("Lidl Roman", "Spanac 250", 60),
      o("Mega Image Craiova", "Rucola 125", 25),
    ]);
    expect(s.stores.map(x => [x.store, x.totalBuc])).toEqual([["Lidl Roman", 100], ["Mega Image Craiova", 25]]);
    expect(s.totalBuc).toBe(125);
  });

  test("același produs la același magazin apare pe un singur rând", () => {
    const s = buildOrdersSummary([o("Lidl Roman", "Rucola 125", 40), o("Lidl Roman", "Rucola 125", 10)]);
    expect(s.stores[0].rows).toHaveLength(1);
    expect(s.stores[0].rows[0].cantitate).toBe(50);
  });

  test("avansul, reambalarea, anulatele și estimările absorbite nu intră", () => {
    const s = buildOrdersSummary([
      o("Lidl Roman", "Rucola 125", 40),
      o("PRODUCTIE_AVANS", "Rucola 125", 500),
      o("Lidl Roman", "Rucola 125", 30, { tip_comanda: "REAMBALARE" }),
      o("Lidl Roman", "Rucola 125", 20, { status: "canceled_by_erp" }),
      o("Lidl Roman", "Rucola 125", 0),
    ]);
    expect(s.totalBuc).toBe(40);
    expect(s.nrComenzi).toBe(1);
  });

  test("produsele în kg nu se adună la bucăți", () => {
    const s = buildOrdersSummary([o("Horeca", "Rucola vrac", 5, { unitate: "kg" }), o("Horeca", "Rucola 125", 10)]);
    expect(s.totalBuc).toBe(10);
    expect(s.otherUnits).toEqual({ kg: 5 });
  });

  test("unitățile greșite din nomenclator (ex. „1”) contează ca bucăți", () => {
    expect(buildOrdersSummary([o("Lidl Roman", "Rucola 125", 10, { unitate: "1" })]).totalBuc).toBe(10);
  });

  test("Excel-ul are totalul magazinului și totalul zilei ca numere", () => {
    const rows = summarySheetRows(buildOrdersSummary([o("Lidl Roman", "Rucola 125", 40)]), "Comenzi");
    expect(rows).toContainEqual(["Total Lidl Roman", "", 40, "buc"]);
    expect(rows[rows.length - 1]).toEqual(["TOTAL ZI", "", 40, "buc"]);
  });
});
