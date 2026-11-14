// Where the offices stand in the 3D scene (metres). Pure geometry, no React or three.
import type { OfficeId } from "./officeState";
import { toWorld } from "./hallLayout";

export interface Room { id: OfficeId; x0: number; x1: number; z0: number; z1: number }

/** Separate office building east of the hall, with a corridor along z = 0 and the door facing the hall. */
export const OFFICE_BUILDING = { x0: 17, x1: 41, z0: -13, z1: 13 };

// Offices inside the hall: the right half of the changing-rooms corner of the floor plan (bottom-left).
const [hx0, hz0] = toWorld(0, 930);
const [hx1, hz1] = toWorld(215, 1200);
export const HALL_OFFICE_SPLIT = hx0 + (hx1 - hx0) * 0.36; // changing rooms on the left, offices on the right
const third = (hz1 - hz0) / 3;
export const HALL_CORNER = { x0: hx0, x1: hx1, z0: hz0, z1: hz1 };

export const ROOMS: Room[] = [
  { id: "ceo", x0: 17, x1: 25, z0: -13, z1: -1.5 },
  { id: "vanzari", x0: 25, x1: 33, z0: -13, z1: -1.5 },
  { id: "achizitii", x0: 33, x1: 41, z0: -13, z1: -1.5 },
  { id: "contabilitate", x0: 17, x1: 31, z0: 1.5, z1: 13 },
  { id: "hr", x0: 31, x1: 41, z0: 1.5, z1: 13 },
  { id: "productie", x0: HALL_OFFICE_SPLIT, x1: hx1, z0: hz0, z1: hz0 + third },
  { id: "calitate", x0: HALL_OFFICE_SPLIT, x1: hx1, z0: hz0 + third, z1: hz0 + 2 * third },
  { id: "mentenanta", x0: HALL_OFFICE_SPLIT, x1: hx1, z0: hz0 + 2 * third, z1: hz1 },
];
export const roomOf = (id: OfficeId) => ROOMS.find((r) => r.id === id)!;
export const roomCenter = (r: Room): [number, number] => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];

/**
 * Desk places spread evenly over a room (grid shaped like the room, at most as many as fit at 1.75 × 1.9 m);
 * each place is the chair, the desk stands in front of it (-z).
 */
export function deskSpots(r: Room, wanted: number): [number, number][] {
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const maxCols = Math.max(1, Math.floor((w - 0.6) / 1.75)), maxRows = Math.max(1, Math.floor((d - 0.6) / 1.9));
  const n = Math.max(1, Math.min(wanted, maxCols * maxRows));
  let cols = Math.min(maxCols, Math.max(1, Math.round(Math.sqrt((n * w) / d))));
  let rows = Math.ceil(n / cols);
  if (rows > maxRows) { rows = maxRows; cols = Math.min(maxCols, Math.ceil(n / rows)); }
  const out: [number, number][] = [];
  for (let i = 0; i < rows && out.length < n; i++) for (let j = 0; j < cols && out.length < n; j++) {
    out.push([r.x0 + (w / cols) * (j + 0.5), r.z0 + (d / rows) * (i + 0.5) + 0.35]);
  }
  return out;
}
