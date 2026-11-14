import { describe, expect, it } from "vitest";
import { nextView, NAV_LIMITS, type V3 } from "@/lib/viziune/cameraNav";
import { fillSlots, rowPairCells } from "@/lib/viziune/storageLayout";

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pos: V3 = [0, 20, 20], target: V3 = [0, 0, 0];

describe("camera navigation buttons", () => {
  it("forward moves camera and target into the screen (towards -z when looking from +z)", () => {
    const v = nextView(pos, target, "inainte");
    expect(v.target[2]).toBeLessThan(0);
    expect(v.pos[2] - v.target[2]).toBeCloseTo(20);
  });
  it("right moves sideways to the screen's right (+x when looking towards -z)", () => {
    expect(nextView(pos, target, "dreapta").target[0]).toBeGreaterThan(0);
    expect(nextView(pos, target, "stanga").target[0]).toBeLessThan(0);
  });
  it("rotation keeps the distance to the target", () => {
    const v = nextView(pos, target, "rotStanga");
    expect(dist(v.pos, v.target)).toBeCloseTo(dist(pos, target));
    expect(v.target).toEqual(target);
  });
  it("zoom stays between the limits", () => {
    let p = pos; for (let i = 0; i < 20; i++) p = nextView(p, target, "aproape").pos;
    expect(dist(p, target)).toBeCloseTo(NAV_LIMITS.minDist);
    for (let i = 0; i < 20; i++) p = nextView(p, target, "departe").pos;
    expect(dist(p, target)).toBeCloseTo(NAV_LIMITS.maxDist);
  });
});

describe("dense warehouse", () => {
  const cells = rowPairCells(0, 0, 10, 2);
  it("row pairs give cols × 2 × pairs places", () => expect(cells.length).toBe(40));
  it("fills every place when there is stock, each product at least one", () => {
    const s = fillSlots([1000, 10, 1], cells, 6, 2);
    expect(s.length).toBe(40);
    for (const i of [0, 1, 2]) expect(s.filter((x) => x.item === i).length).toBeGreaterThanOrEqual(1);
    expect(s.filter((x) => x.item === 0).length).toBeGreaterThan(s.filter((x) => x.item === 1).length);
  });
  it("stack height stays within the limits and zero stock takes no place", () => {
    const s = fillSlots([500, 0, 3], cells, 6, 2);
    expect(s.some((x) => x.item === 1)).toBe(false);
    for (const x of s) { expect(x.levels).toBeGreaterThanOrEqual(2); expect(x.levels).toBeLessThanOrEqual(6); }
  });
  it("more products than places: only the biggest are shown, one place each", () => {
    const s = fillSlots(Array.from({ length: 50 }, (_, i) => 100 - i), cells, 6);
    expect(s.length).toBe(40);
    expect(new Set(s.map((x) => x.item)).size).toBe(40);
  });
});
