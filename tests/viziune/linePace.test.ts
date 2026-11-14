import { describe, it, expect } from "vitest";
import { linePace, teamSize, buildLines } from "@/lib/viziune/factoryState";
import { defaultLayout, placementOf } from "@/lib/viziune/hallLayout";
const assignStations = (lines: { id: string; nume: string }[], o = {}) => placementOf(defaultLayout(lines, o), lines);

const T0 = Date.parse("2026-11-13T04:00:00Z");
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();
const order = (id: string, cantitate: number, extra: any = {}) => ({ id, linie_id: "L", status: "assigned", cantitate, productie_produse: { nume: id }, ...extra });
const open = (id: string, comanda_id: string, startMin: number, extra: any = {}) => ({ id, comanda_id, linie_id: "L", ora_start: at(startMin), ora_sfarsit: null, status: "activa", nume_operator: "Ana", numar_angajati: 4, ...extra });

describe("Viziune: comanda în lucru față de normă", () => {
  it("grouped orders on a line are timed together against quantity ÷ norm", () => {
    // 1728 buc la 915/h = 113 min; pornite la 04:00, acum 04:30 → în normă, gata la ~05:53
    const p = linePace(915, [order("a", 576), order("b", 576), order("c", 576)], [open("s1", "a", 0), open("s2", "b", 0), open("s3", "c", 1)], "L", T0 + 30 * 60_000);
    expect(p.status).toBe("in_norma");
    expect(p.qty).toBe(1728);
    expect(Math.round(p.normHours! * 60)).toBe(113);
    expect(new Date(p.dueAt!).toISOString().slice(11, 16)).toBe("05:53");
    expect(p.expectedNow).toBe(Math.round(915 * 0.5));
  });

  it("flags the line as late once worked time passes the norm and the order is still open", () => {
    // 100 buc la 120/h = 50 min; lucrează de 65 min → 15 min peste normă
    const p = linePace(120, [order("a", 100)], [open("s1", "a", 0)], "L", T0 + 65 * 60_000);
    expect(p.status).toBe("intarziat");
    expect(p.lateMinutes).toBe(15);
  });

  it("warns when 90% of the norm time is used", () => {
    const p = linePace(120, [order("a", 100)], [open("s1", "a", 0)], "L", T0 + 46 * 60_000);
    expect(p.status).toBe("aproape");
  });

  it("counts earlier closed sessions of the same order, without double-counting overlaps", () => {
    // 20 min ieri-dimineață închise + 20 min acum deschise = 40 min lucrate din 50 normate
    const sessions = [
      { id: "old", comanda_id: "a", linie_id: "L", ora_start: at(-120), ora_sfarsit: at(-100), status: "finalizata", cantitate_produsa: 30 },
      open("s1", "a", 0),
    ];
    const p = linePace(120, [order("a", 100)], sessions, "L", T0 + 20 * 60_000);
    expect(Math.round(p.workedHours * 60)).toBe(40);
    expect(p.startedAt).toBe(T0 - 120 * 60_000);
  });

  it("a line without a norm is never shown as late", () => {
    const p = linePace(0, [order("a", 100)], [open("s1", "a", 0)], "L", T0 + 600 * 60_000);
    expect(p.status).toBe("fara_norma");
    expect(p.lateMinutes).toBe(0);
  });

  it("the day finish time adds the waiting orders at norm speed", () => {
    // în lucru: 120 buc din 120/h, lucrat 30 min → rămân 30 min; în așteptare 60 buc = 30 min; acum 04:30 → gata la 05:30
    const p = linePace(120, [order("a", 120), order("q", 60)], [open("s1", "a", 0)], "L", T0 + 30 * 60_000);
    expect(p.queueOrders).toBe(1);
    expect(new Date(p.dayDoneAt!).toISOString().slice(11, 16)).toBe("05:30");
  });
});

describe("Viziune: oameni pe linie", () => {
  it("grouped sessions of one team count the team once; two operators add up", () => {
    expect(teamSize([open("1", "a", 0), open("2", "b", 0), open("3", "c", 0)] as any)).toBe(4);
    expect(teamSize([open("1", "a", 0, { nume_operator: "Florina", numar_angajati: 1 }), open("2", "b", 0, { nume_operator: "Daciana", numar_angajati: 1 })] as any)).toBe(2);
    const [l] = buildLines([{ id: "L", nume: "GASTRO", status: "activa", capacitate_ora: 120 }], [order("a", 4), order("b", 2)], [open("1", "a", 0, { numar_angajati: 2 }), open("2", "b", 0, { numar_angajati: 2 })] as any, T0);
    expect(l.workers).toBe(2);
  });
});

describe("Viziune: liniile pe utilajele din plan", () => {
  const lines = [
    { id: "g", nume: "Giostra" }, { id: "fp", nume: "Flowpack Mare" }, { id: "s1", nume: "Salate 1 (verticala mare)" },
    { id: "s2", nume: "Salate 2 " }, { id: "sp", nume: "Spanac Mare" }, { id: "x", nume: "Linie nouă" },
  ];
  it("places lines by name on their machine and the rest on free tables", () => {
    const { byStation, unplaced } = assignStations(lines);
    expect(byStation.get("cantar5")).toBe("g");
    expect(byStation.get("fp1")).toBe("fp");
    expect(byStation.get("cantar1")).toBe("s1");
    expect(byStation.get("cantar2")).toBe("s2");
    expect(byStation.get("cantar3")).toBe("sp");
    expect(byStation.get("rezerva1")).toBe("x");
    expect(unplaced).toEqual([]);
  });
  it("a saved choice moves the line and frees its old place", () => {
    const { byStation } = assignStations(lines, { cantar3: "g" });
    expect(byStation.get("cantar3")).toBe("g");
    expect(byStation.get("cantar5")).toBeUndefined();
  });
});

describe("Viziune: sesiuni uitate deschise", () => {
  it("a session left open for more than 12 hours is ignored and listed, not shown as hours of delay", () => {
    const sessions = [open("old", "a", -60 * 30), open("s1", "b", 0)];
    const p = linePace(120, [order("a", 100), order("b", 60)], sessions, "L", T0 + 10 * 60_000);
    expect(p.forgotten).toEqual([]); // started on an earlier day: ignored and not listed
    expect(p.orders.map((o) => o.id)).toEqual(["b"]);
    expect(Math.round(p.workedHours * 60)).toBe(10);
    expect(p.status).toBe("in_norma");
  });
  it("an order running on a line counts there even if it was planned on another line", () => {
    const p = linePace(120, [], [open("s1", "a", 0)], "L", T0 + 10 * 60_000, [order("a", 100, { linie_id: "ALTA" })]);
    expect(p.orders.map((o) => o.id)).toEqual(["a"]);
  });
});
