import { describe, it, expect } from "vitest";
import { husaBalance } from "../src/lib/huse";

const r = (tip: any, cantitate: number, persoana?: string) => ({ occurred_at: "2026-11-01", tip, cantitate, zona: "picking" as const, persoana });

describe("husaBalance", () => {
  it("stoc 50, dau 20 la sofer, primesc 5 inapoi -> 35 in depozit, 15 afara", () => {
    const b = husaBalance([r("intrare", 50), r("predare", 20, "Ion"), r("retur", 5, "ion")]);
    expect(b.inDepozit).toBe(35);
    expect(b.afara).toBe(15);
    expect(b.persoane[0].afara).toBe(15);
  });
  it("pierderea scade din ce are persoana si din total", () => {
    const b = husaBalance([r("intrare", 50), r("predare", 10, "Ion"), r("pierdere", 3, "Ion")]);
    expect(b.afara).toBe(7);
    expect(b.total).toBe(47);
    expect(b.inDepozit).toBe(40);
  });
});
