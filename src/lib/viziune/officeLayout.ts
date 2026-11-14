// Where the offices stand in the 3D scene (metres). Pure geometry, no React or three.
import type { OfficeId } from "./officeState";
import { toWorld } from "./hallLayout";

export interface Room { id: OfficeId; x0: number; x1: number; z0: number; z1: number; inHall: boolean }
type Place = Omit<Room, "id"> & { label: string };

/**
 * Separate office building left of Picking & livrare (north of the hall, seen from the main view), with a
 * corridor along its middle and a walkway from its east end to the picking floor.
 */
export const OFFICE_BUILDING = { x0: -31, x1: -7, z0: -46, z1: -22 };
export const OFFICE_CORRIDOR_Z = -34;
const B = OFFICE_BUILDING, cN = OFFICE_CORRIDOR_Z - 1.5, cS = OFFICE_CORRIDOR_Z + 1.5;

// Offices inside the hall: the right half of the changing-rooms corner of the floor plan (bottom-left).
const [hx0, hz0] = toWorld(0, 930);
const [hx1, hz1] = toWorld(215, 1200);
export const HALL_OFFICE_SPLIT = hx0 + (hx1 - hx0) * 0.36; // changing rooms on the left, offices on the right
const third = (hz1 - hz0) / 3;
export const HALL_CORNER = { x0: hx0, x1: hx1, z0: hz0, z1: hz1 };

/** Room places, in the order offices are put into them: the first BUILDING_PLACES in the building, then the hall. */
export const ROOM_PLACES: Place[] = [
  { label: "Clădirea de birouri · spate stânga", x0: B.x0, x1: B.x0 + 8, z0: B.z0, z1: cN, inHall: false },
  { label: "Clădirea de birouri · spate mijloc", x0: B.x0 + 8, x1: B.x0 + 16, z0: B.z0, z1: cN, inHall: false },
  { label: "Clădirea de birouri · spate dreapta (spre Picking)", x0: B.x0 + 16, x1: B.x1, z0: B.z0, z1: cN, inHall: false },
  { label: "Clădirea de birouri · față stânga (birou mare)", x0: B.x0, x1: B.x0 + 14, z0: cS, z1: B.z1, inHall: false },
  { label: "Clădirea de birouri · față dreapta (spre Picking)", x0: B.x0 + 14, x1: B.x1, z0: cS, z1: B.z1, inHall: false },
  { label: "Hală, lângă vestiare · primul", x0: HALL_OFFICE_SPLIT, x1: hx1, z0: hz0, z1: hz0 + third, inHall: true },
  { label: "Hală, lângă vestiare · al doilea", x0: HALL_OFFICE_SPLIT, x1: hx1, z0: hz0 + third, z1: hz0 + 2 * third, inHall: true },
  { label: "Hală, lângă vestiare · al treilea (spre poartă)", x0: HALL_OFFICE_SPLIT, x1: hx1, z0: hz0 + 2 * third, z1: hz1, inHall: true },
];

/** Rooms for an order of the offices (a full order, see roomOrderOf): office i stands in place i. */
export function roomsFor(order: readonly OfficeId[]): Room[] {
  return order.slice(0, ROOM_PLACES.length).map((id, i) => { const { label: _l, ...p } = ROOM_PLACES[i]; return { id, ...p }; });
}
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
