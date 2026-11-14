// Walking through the factory at eye height: movement, what the walker bumps into and what they look at.
// Pure maths on the hall layout, no React or three.
import { HALL, toWorld, type HallStation, type StationKind } from "./hallLayout";

export type Box = { x0: number; z0: number; x1: number; z1: number; id?: string };
export type WalkPose = { x: number; z: number; yaw: number };
/** fwd/side/turn in −1…1 (forward, right, turn left); run = faster pace. */
export type WalkInput = { fwd: number; side: number; turn: number; run: boolean };

export const WALK = {
  eye: 1.65, radius: 0.35, speed: 3.2, run: 7.5, turnSpeed: 1.9, lookDist: 12, fov: 70,
  bounds: { x0: -62, x1: 46, z0: -72, z1: 52 },
};

const W2 = HALL.w / 2, D2 = HALL.d / 2;
export const GATE_X = toWorld(375, 0)[0];
export const EXIT_X = toWorld(610, 0)[0];
/** Openings in the hall walls: raw-material gate (south, plan bottom) and dispatch exit (north, plan top). */
export const GATE_HALF = 1.8, EXIT_HALF = 1.6;

/** Where a walk starts: inside the raw-material gate, in the free aisle, looking up the hall towards the scales. */
export const WALK_START: WalkPose = { x: GATE_X + 3.5, z: D2 - 1.4, yaw: 0 };

/** Solid parts of each kind of station, in the station's own frame [centre x, centre z, width, depth] (as drawn). */
const PARTS: Record<StationKind, [number, number, number, number][]> = {
  cantar: [[0, 0, 3, 3], [-0.3, -6.4, 1.9, 1.9], [0, -3.45, 0.7, 3.7], [1.9, 5, 0.7, 3.2], [-1.9, -4.2, 1.2, 0.8], [-1.9, 3.2, 1.2, 0.8]],
  giostra: [[0, 0, 3, 3], [-2.8, -5.7, 1.9, 1.9], [-2.5, -3, 1.2, 4.6], [1.9, 4.8, 0.7, 2.8], [0, 6.6, 1.4, 1.2], [-1.9, -1.5, 1.2, 0.8], [-1.9, 3, 1.2, 0.8]],
  flowpack: [[0.3, -2.2, 1.6, 1.6], [0, -0.3, 1.2, 4.2], [0, 3.2, 1, 1.6], [1.6, 0, 1.2, 0.8]],
  masa: [[0, 0, 2.7, 1.4], [2.1, 0, 1.2, 0.8]],
  utilaj: [[0, 0, 2.1, 1.7], [1.6, 0, 1.2, 0.8]],
  spalare_manual: [[0.3, -0.85, 3.1, 2.1], [-1, 1.1, 1, 2], [1.4, 1.3, 1.2, 0.8]],
  spalare_auto: [[0, 0, 2.6, 19.5], [-2.6, -1.4, 1, 2.2]],
};

/** Boxes a station takes on the floor, turned like the station (turns are multiples of 90°). */
export function stationBoxes(st: HallStation): Box[] {
  const [cx, cz] = toWorld(st.px, st.py);
  const a = -((st.rot || 0) * Math.PI) / 180;
  const cos = Math.round(Math.cos(a)), sin = Math.round(Math.sin(a));
  const swap = Math.abs(sin) === 1;
  return PARTS[st.kind].map(([lx, lz, w, d]) => {
    // three.js turn about y: x' = x cos + z sin, z' = −x sin + z cos
    const x = cx + lx * cos + lz * sin, z = cz - lx * sin + lz * cos;
    const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
    return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, id: st.id };
  });
}

/** Hall walls with their two openings, the changing-rooms corner and the dispatch docks. */
export function hallWalls(): Box[] {
  const t = 0.15;
  const [ox0, oz0] = toWorld(0, 930); const [ox1] = toWorld(215, 1200);
  return [
    { x0: -W2 - t, x1: -W2 + t, z0: -D2, z1: D2 },
    { x0: W2 - t, x1: W2 + t, z0: -D2, z1: D2 },
    { x0: -W2, x1: GATE_X - GATE_HALF, z0: D2 - t, z1: D2 + t },
    { x0: GATE_X + GATE_HALF, x1: W2, z0: D2 - t, z1: D2 + t },
    { x0: -W2, x1: EXIT_X - EXIT_HALF, z0: -D2 - t, z1: -D2 + t },
    { x0: EXIT_X + EXIT_HALF, x1: W2, z0: -D2 - t, z1: -D2 + t },
    { x0: ox0, x1: ox1 + 0.13, z0: oz0 - 0.13, z1: D2 },
    ...[-6, 0, 6].map((dx) => ({ x0: EXIT_X + dx - 1.6, x1: EXIT_X + dx + 1.6, z0: -36, z1: -35 })),
  ];
}

const hits = (x: number, z: number, boxes: Box[], r: number) => boxes.some((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);

/**
 * One step of walking: forward is where the walker looks (yaw 0 = towards −z), each axis is tried on its own
 * so the walker slides along a wall instead of sticking to it, and never leaves the factory grounds.
 */
export function stepWalk(p: WalkPose, input: WalkInput, dt: number, boxes: Box[]): WalkPose {
  const step = Math.min(dt, 0.05);
  const yaw = p.yaw + input.turn * WALK.turnSpeed * step;
  const len = Math.hypot(input.fwd, input.side);
  if (!len) return { ...p, yaw };
  const k = ((input.run ? WALK.run : WALK.speed) * step) / Math.max(1, len);
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const dx = (fx * input.fwd + rx * input.side) * k, dz = (fz * input.fwd + rz * input.side) * k;
  const B = WALK.bounds, r = WALK.radius;
  let x = Math.min(B.x1, Math.max(B.x0, p.x + dx)), z = p.z;
  if (hits(x, z, boxes, r) && !hits(p.x, z, boxes, r)) x = p.x;
  const nz = Math.min(B.z1, Math.max(B.z0, p.z + dz));
  if (!hits(x, nz, boxes, r) || hits(x, z, boxes, r)) z = nz;
  return { x, z, yaw };
}

/** First box (with an id) straight ahead on the floor within `maxDist`, e.g. the machine under the crosshair. */
export function lookedAt(p: WalkPose, boxes: Box[], maxDist = WALK.lookDist): string | null {
  const dx = -Math.sin(p.yaw), dz = -Math.cos(p.yaw);
  let best: { id: string; t: number } | null = null;
  for (const b of boxes) {
    if (!b.id) continue;
    let t0 = 0, t1 = maxDist;
    for (const [o, d, lo, hi] of [[p.x, dx, b.x0, b.x1], [p.z, dz, b.z0, b.z1]] as const) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = Infinity; break; } continue; }
      let a = (lo - o) / d, c = (hi - o) / d; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    }
    if (t0 <= t1 && (!best || t0 < best.t)) best = { id: b.id, t: t0 };
  }
  return best?.id ?? null;
}
