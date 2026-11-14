import { describe, expect, it } from "vitest";
import { defaultLayout, moverRoutes, MP_GATE, PICKING_EXIT, newStation, placementOf, setStationLine, toPlan, toWorld, validateHallLayout } from "@/lib/viziune/hallLayout";

const L1 = "3378201c-50a6-406a-9e79-9252a48a95ba";
const L2 = "60ac5c26-861d-4f56-803a-413e608f9328";
const st = (id: string, lineId: string | null = null, extra = {}) => ({ id, kind: "masa", label: id, px: 100, py: 100, rot: 0, lineId, ...extra });

describe("Viziune: planul halei salvat", () => {
  it("a line can stand on only one machine", () => {
    expect(() => validateHallLayout([st("a", L1), st("b", L1)])).toThrow(/două utilaje/);
  });
  it("two machines cannot share a code", () => {
    expect(() => validateHallLayout([st("a"), st("a")])).toThrow(/de două ori/);
  });
  it("a machine dragged outside the hall is kept on its edge", () => {
    const [s] = validateHallLayout([st("a", null, { px: -40, py: 5000 })]);
    expect([s.px, s.py]).toEqual([0, 1200]);
  });
  it("only quarter turns are accepted", () => {
    expect(() => validateHallLayout([st("a", null, { rot: 45 })])).toThrow(/Rotire/);
    expect(validateHallLayout([st("a", null, { rot: 90 })])[0].rot).toBe(90);
  });
  it("unknown machine types are refused", () => {
    expect(() => validateHallLayout([st("a", null, { kind: "rachetă" })])).toThrow(/Tip/);
  });
  it("moving a line to another machine frees its old place", () => {
    const next = setStationLine([st("a", L1), st("b", L2)], "b", L1);
    expect(next.map((s) => s.lineId)).toEqual([null, L1]);
  });
  it("lines placed nowhere in the saved layout are listed", () => {
    const lines = [{ id: L1, nume: "Giostra" }, { id: L2, nume: "Replay" }];
    const { byStation, unplaced } = placementOf([st("a", L1)], lines);
    expect(byStation.get("a")).toBe(L1);
    expect(unplaced.map((l) => l.id)).toEqual([L2]);
  });
  it("a new machine gets a free code", () => {
    const layout = [st("masa_1"), st("masa_2")];
    expect(newStation(layout as any, "masa", "Masă").id).toBe("masa_3");
  });
  it("empty spare tables are not part of the starting layout", () => {
    const ids = defaultLayout([{ id: "g", nume: "Giostra" }]).map((s) => s.id);
    expect(ids).toContain("cantar5");
    expect(ids).not.toContain("rezerva1");
  });
  it("dragging on the floor maps back to the same plan point", () => {
    const [x, z] = toWorld(320, 1045);
    expect(toPlan(x, z)).toEqual([320, 1045]);
  });
});

describe("plan machines Iceberg / Replay / Top sealing", () => {
  it("are editable stations and the replay line lands on Replay 55", () => {
    const lines = [{ id: "70ac5c26-861d-4f56-803a-413e608f9328", nume: "replay 55 nr2" }];
    const layout = defaultLayout(lines);
    expect(layout.map((s) => s.id)).toEqual(expect.arrayContaining(["iceberg", "replay55", "topsealing"]));
    expect(layout.find((s) => s.id === "replay55")?.lineId).toBe(lines[0].id);
  });
});

describe("moving goods follow the factory flow", () => {
  it("every raw-material route starts at the MP gate", () => {
    for (const r of moverRoutes().filter((r) => r.kind === "materie")) expect(r.pts[0]).toEqual(MP_GATE);
  });
  it("every finished-goods route ends at the picking exit, never back at a line", () => {
    const fin = moverRoutes().filter((r) => r.kind === "finit");
    expect(fin.length).toBe(4);
    for (const r of fin) expect(r.pts[r.pts.length - 1]).toEqual(PICKING_EXIT);
  });
  it("finished goods leave the weighers toward the top corridor (y decreases)", () => {
    for (const r of moverRoutes().filter((r) => r.kind === "finit")) expect(r.pts[0][1]).toBeGreaterThan(r.pts[1][1]);
  });
});
