import { describe, expect, it } from "vitest";
import { leversToPct, leverImpact } from "../src/lib/argus/futureLevers";

describe("future levers", () => {
  it("minimum wage +10% raises labour by 10% and overhead by 4%", () => {
    const p = leversToPct({ salariu: 10 });
    expect(p.manopera).toBe(10);
    expect(p.regie).toBe(4);
    expect(p.mp).toBeUndefined();
  });
  it("diesel +20% raises distribution by 7%", () => {
    expect(leversToPct({ motorina: 20 }).distributie).toBe(7);
  });
  it("impact in lei ranks the costliest lever first", () => {
    const r = leverImpact({ manopera: 1000, distributie: 1000 }, { salariu: 10, motorina: 10 });
    expect(r[0]).toEqual({ lever: "salariu", lei: 120 });
    expect(r[1].lei).toBeCloseTo(35);
  });
});
