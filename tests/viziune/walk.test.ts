import { describe, expect, it } from "vitest";
import { hallWalls, lookedAt, lookTarget, stationBoxes, stepWalk, walkAreas, WALK, WALK_START, GATE_X, type Box } from "@/lib/viziune/walk";
import { HALL_CORNER, HALL_OFFICE_SPLIT, roomsFor } from "@/lib/viziune/officeLayout";
import { ROOM_ORDER_DEFAULT } from "../../supabase/functions/_shared/officeConfigRules";
import { HALL, toWorld, type HallStation } from "@/lib/viziune/hallLayout";

const still = { fwd: 0, side: 0, turn: 0, run: false };
const fwd = { ...still, fwd: 1 };
const walkFor = (seconds: number, input = fwd, start = WALK_START, boxes: Box[] = []) => {
  let p = start;
  for (let t = 0; t < seconds; t += 0.02) p = stepWalk(p, input, 0.02, boxes);
  return p;
};
const masa: HallStation = { id: "m1", kind: "masa", label: "Masă", px: 390, py: 600, rot: 0, lineId: null };

describe("walking through the factory", () => {
  it("forward at yaw 0 walks up the hall (towards −z) at walking pace", () => {
    const p = walkFor(1);
    expect(p.z).toBeCloseTo(WALK_START.z - WALK.speed, 1);
    expect(p.x).toBeCloseTo(WALK_START.x, 5);
  });

  it("Shift runs faster than walking", () => {
    const run = walkFor(1, { ...fwd, run: true });
    expect(WALK_START.z - run.z).toBeCloseTo(WALK.run, 1);
  });

  it("walking diagonally is not faster than walking straight", () => {
    const p = walkFor(1, { ...fwd, side: 1 });
    expect(Math.hypot(p.x - WALK_START.x, p.z - WALK_START.z)).toBeCloseTo(WALK.speed, 1);
  });

  it("turning left with yaw +90° makes forward go towards −x", () => {
    const p = walkFor(1, fwd, { ...WALK_START, yaw: Math.PI / 2 });
    expect(p.x).toBeLessThan(WALK_START.x - 3);
  });

  it("a table stops the walker and they slide along it instead of passing through", () => {
    const boxes = stationBoxes(masa);
    const [, tz] = toWorld(masa.px, masa.py);
    const start = { x: toWorld(masa.px, 0)[0] + 0.4, z: tz + 4, yaw: 0 };
    const p = walkFor(3, { ...fwd, side: 0.3 }, start, boxes);
    expect(p.z).toBeGreaterThan(tz); // never crossed the table
    expect(p.x).toBeGreaterThan(start.x + 0.5); // kept moving sideways
  });

  it("the hall wall blocks the walker but the raw-material gate lets them out", () => {
    const walls = hallWalls();
    const blocked = walkFor(4, { ...still, fwd: -1 }, { x: 8, z: HALL.d / 2 - 2, yaw: 0 }, walls);
    expect(blocked.z).toBeLessThan(HALL.d / 2);
    const out = walkFor(4, { ...still, fwd: -1 }, { x: GATE_X, z: HALL.d / 2 - 2, yaw: 0 }, walls);
    expect(out.z).toBeGreaterThan(HALL.d / 2 + 3);
  });

  it("never leaves the factory grounds", () => {
    const p = walkFor(60, { ...fwd, run: true }, { x: 0, z: 0, yaw: Math.PI / 2 });
    expect(p.x).toBe(WALK.bounds.x0);
  });

  it("a machine turned 90° takes the turned footprint", () => {
    const flat = stationBoxes({ ...masa, kind: "spalare_auto" })[0];
    const turned = stationBoxes({ ...masa, kind: "spalare_auto", rot: 90 })[0];
    expect(flat.z1 - flat.z0).toBeCloseTo(19.5);
    expect(turned.x1 - turned.x0).toBeCloseTo(19.5);
  });

  it("the crosshair picks the nearest machine straight ahead, within reach only", () => {
    const [tx, tz] = toWorld(masa.px, masa.py);
    const boxes = stationBoxes(masa);
    expect(lookedAt({ x: tx, z: tz + 5, yaw: 0 }, boxes)).toBe("m1");
    expect(lookedAt({ x: tx, z: tz + 5, yaw: Math.PI }, boxes)).toBeNull();
    expect(lookedAt({ x: tx, z: tz + 30, yaw: 0 }, boxes)).toBeNull();
    expect(lookedAt({ x: tx, z: tz + 5, yaw: 0 }, hallWalls())).toBeNull(); // walls are not pickable
  });
});


describe("walk mode crosshair on warehouses and offices", () => {
  const areas = walkAreas(roomsFor([...ROOM_ORDER_DEFAULT]));

  it("looking at the raw-material store from outside picks the store", () => {
    expect(lookTarget({ x: 0, z: 21.5, yaw: Math.PI }, [], areas)).toBe("zona:depozit");
  });

  it("inside an office room picks that office, in the corridor the building", () => {
    expect(lookTarget({ x: -27, z: -40, yaw: 0 }, [], areas)).toBe("birou:ceo");
    expect(lookTarget({ x: -20, z: -34, yaw: -Math.PI / 2 }, [], areas)).toBe("zona:birouri");
  });

  it("a wall in between hides the area, a machine in front wins over it", () => {
    const wall: Box = { x0: -5, x1: 5, z0: 22.4, z1: 22.6 };
    expect(lookTarget({ x: 0, z: 21.5, yaw: Math.PI }, [wall], areas)).toBeNull();
    const machine: Box = { x0: -1, x1: 1, z0: 22, z1: 23, id: "m1" };
    expect(lookTarget({ x: 0, z: 21.5, yaw: Math.PI }, [machine], areas)).toBe("m1");
  });

  it("the offices behind the changing-rooms wall in the hall can be picked from the hall floor", () => {
    const x = (HALL_OFFICE_SPLIT + HALL_CORNER.x1) / 2;
    expect(lookTarget({ x, z: HALL_CORNER.z0 - 3, yaw: Math.PI }, hallWalls(), areas)).toBe("birou:productie");
  });
});
