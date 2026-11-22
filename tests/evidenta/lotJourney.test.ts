import { describe, expect, it } from "vitest";
import { buildLotJourneys, type JourneyReception, overrideKey } from "../../src/lib/evidenta/lotJourney";

const rec = (o: Partial<JourneyReception> = {}): JourneyReception => ({
  id: "r1", entryNumber: 9717, receiptDay: "2026-11-18", product: "Coriandru", lot: "4703",
  supplier: "FLC", producer: null, nirKg: 80, remainingKg: 0, qualityPct: 8, creditKg: 6,
  inventoryIds: ["inv1"], ...o,
});
const recipes = new Map([["p30", [{ material: "coriandru", grams: 30 }]], ["p15", [{ material: "coriandru", grams: 15 }]]]);

describe("evidența pe lot", () => {
  it("pornește de la cantitatea NIR și scade ce s-a dat în producție", () => {
    const [j] = buildLotJourneys({
      receptions: [rec()],
      transfers: [
        { inventoryId: "inv1", material: "coriandru", day: "2026-11-19", kg: 43, line: "Aromate" },
        { inventoryId: "inv1", material: "coriandru", day: "2026-11-22", kg: 20, line: "Aromate" },
      ],
      sessions: [], recipes, rebutBySession: new Map(), overrides: new Map(),
    });
    expect(j.days.map((d) => d.remainingAfter)).toEqual([37, 17]);
    expect(j.days.map((d) => d.ageDays)).toEqual([1, 4]);
  });

  it("calculează kg final din bucăți × gramaj, rebutul și diferența de cântar", () => {
    const [j] = buildLotJourneys({
      receptions: [rec()],
      transfers: [{ inventoryId: "inv1", material: "coriandru", day: "2026-11-19", kg: 61, line: null }],
      sessions: [
        { id: "s1", day: "2026-11-19", productId: "p30", productName: "Coriandru 30 g", pieces: 1194, start: "2026-11-19T11:03:00Z", end: "2026-11-19T15:49:00Z" },
        { id: "s2", day: "2026-11-19", productId: "p15", productName: "Coriandru 15 g", pieces: 270, start: "2026-11-19T15:42:00Z", end: "2026-11-19T15:50:00Z" },
      ],
      recipes, rebutBySession: new Map([["s1", 9.75]]), overrides: new Map(),
    });
    const d = j.days[0];
    expect(d.kgFinal).toBe(39.87); // 1194×0,030 + 270×0,015
    expect(d.rebut).toBe(9.75);
    expect(d.pusInCaserole).toBe(51.25);
    expect(d.difCantar).toBe(11.38);
    expect(d.pctNc).toBeCloseTo(9.75 / 61, 4);
    expect(d.autoStart).toBe("2026-11-19T11:03:00Z");
    expect(d.autoStop).toBe("2026-11-19T15:50:00Z");
  });

  it("împarte producția zilei între loturile date în aceeași zi după kg", () => {
    const out = buildLotJourneys({
      receptions: [rec(), rec({ id: "r2", inventoryIds: ["inv2"], nirKg: 37.7 })],
      transfers: [
        { inventoryId: "inv1", material: "coriandru", day: "2026-11-19", kg: 30, line: null },
        { inventoryId: "inv2", material: "coriandru", day: "2026-11-19", kg: 10, line: null },
      ],
      sessions: [{ id: "s1", day: "2026-11-19", productId: "p30", productName: "Coriandru 30 g", pieces: 1000, start: null, end: null }],
      recipes, rebutBySession: new Map([["s1", 4]]), overrides: new Map(),
    });
    expect(out[0].days[0].share).toBe(0.75);
    expect(out[0].days[0].kgFinal).toBe(22.5);
    expect(out[0].days[0].rebut).toBe(3);
    expect(out[1].days[0].kgFinal).toBe(7.5);
  });

  it("corectura manuală înlocuiește rebutul și kg final calculate", () => {
    const [j] = buildLotJourneys({
      receptions: [rec()],
      transfers: [{ inventoryId: "inv1", material: "coriandru", day: "2026-11-22", kg: 20, line: null }],
      sessions: [{ id: "s1", day: "2026-11-22", productId: "p30", productName: "Coriandru 30 g", pieces: 400, start: null, end: null }],
      recipes, rebutBySession: new Map([["s1", 1]]),
      overrides: new Map([[overrideKey("r1", "2026-11-22"), { rebut: 7.09, kgFinal: 12 }]]),
    });
    expect(j.days[0].rebut).toBe(7.09);
    expect(j.days[0].kgFinal).toBe(12);
    expect(j.days[0].difCantar).toBe(0.91);
  });

  it("nu leagă de un lot transferurile dinaintea recepției (număr de lot refolosit)", () => {
    const [j] = buildLotJourneys({
      receptions: [rec()],
      transfers: [{ inventoryId: "inv1", material: "coriandru", day: "2025-11-20", kg: 50, line: null }],
      sessions: [], recipes, rebutBySession: new Map(), overrides: new Map(),
    });
    expect(j.days).toHaveLength(0);
  });
});
