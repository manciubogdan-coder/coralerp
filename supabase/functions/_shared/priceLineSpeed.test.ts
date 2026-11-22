import { describe, expect, it } from "vitest";
import { isBulkLine, matchesProduct, sharedSpeedOf, speedTokens, usualLineNorm } from "./priceLineSpeed";

const at = (h: number) => new Date(Date.UTC(2026, 10, 20, 0, Math.round(h * 60))).toISOString();
const s = (id: string, from: number, to: number, q: number, line = "L") => ({ id, linie_id: line, ora_start: at(from), ora_sfarsit: at(to), cantitate_produsa: q });

describe("real line speed for the price calculator", () => {
  it("a 500 PG bag is not measured on the 500 GASTRO product", () => {
    const t = { ...speedTokens("SAL. ATLANTIC 500 PG"), formats: "PG" };
    expect(matchesProduct("SAL. ATLANTIC 500 PG", t)).toBe(true);
    expect(matchesProduct("SAL. ATLANTIC 500 GASTRO", t)).toBe(false);
  });
  it("a session left open all day next to busy orders gets only its share of the line time", () => {
    // 2 pieces open 8 h, while 798 pieces run in the same 8 h: the product took 2/800 of the time.
    const r = sharedSpeedOf([s("a", 0, 8, 2)], [s("a", 0, 8, 2), s("b", 0, 8, 798)]);
    expect(r.hours).toBeCloseTo(8 * (2 / 800), 6);
    expect(r.speed).toBeCloseTo(100, 6);
  });
  it("alone on the line a product keeps its whole worked time, overlaps merged", () => {
    const r = sharedSpeedOf([s("a", 0, 2, 100), s("b", 1, 3, 100)], []);
    expect(r.hours).toBeCloseTo(3, 6);
  });
  it("the usual line is the one with most orders and a norm; Vracuri/GASTRO are hand-packed lines", () => {
    const lines = new Map([["s1", { nume: "Salate 1 (verticala mare)", capacitate_ora: 975 }], ["v", { nume: "Vracuri pungi", capacitate_ora: 120 }]]);
    expect(usualLineNorm([{ linie_id: "s1" }, { linie_id: "s1" }, { linie_id: "v" }], lines)).toMatchObject({ line: "Salate 1 (verticala mare)", speed: 975 });
    expect(isBulkLine("Vracuri pungi")).toBe(true);
    expect(isBulkLine("GASTRO")).toBe(true);
    expect(isBulkLine("Salate 2 ")).toBe(false);
  });
});
