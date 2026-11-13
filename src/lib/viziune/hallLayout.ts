// Production hall layout, traced from the factory floor plan (780×1200 px drawing).
// Pure data + the rules that place each production line on its machine; no React or three.
import { PLAN, type HallStation, type StationKind } from "../../../supabase/functions/_shared/hallLayoutRules";

export { PLAN, KIND_LABEL, STATION_KINDS, validateHallLayout, type HallStation, type StationKind } from "../../../supabase/functions/_shared/hallLayoutRules";
export const HALL = { w: 26, d: 40 }; // metres in the 3D scene

/** Plan pixel → scene metres, hall centred on the origin (x = plan right, z = plan down). */
export const toWorld = (px: number, py: number): [number, number] => [
  (px / PLAN.w - 0.5) * HALL.w,
  (py / PLAN.h - 0.5) * HALL.d,
];
/** Scene metres → plan pixel, kept inside the hall and snapped to 5 px. */
export const toPlan = (x: number, z: number): [number, number] => {
  const snap = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v / 5) * 5));
  return [snap((x / HALL.w + 0.5) * PLAN.w, PLAN.w), snap((z / HALL.d + 0.5) * PLAN.h, PLAN.h)];
};

/** Station as traced from the original floor plan, with the name rule used before anyone saves a layout. */
interface PlanStation { id: string; kind: StationKind; label: string; px: number; py: number; match?: RegExp; spare?: boolean }

export const STATIONS: PlanStation[] = [
  { id: "cantar1", kind: "cantar", label: "Cântar 1", px: 235, py: 300, match: /salate\s*1|vertical/i },
  { id: "cantar2", kind: "cantar", label: "Cântar 2", px: 355, py: 300, match: /salate\s*2/i },
  { id: "cantar3", kind: "cantar", label: "Cântar 3", px: 525, py: 300, match: /spanac/i },
  { id: "cantar4", kind: "cantar", label: "Cântar 4", px: 650, py: 300, match: /aromate.*automat/i },
  { id: "cantar5", kind: "giostra", label: "Cântar 5 · Giostra", px: 300, py: 740, match: /giostra/i },
  { id: "fp1", kind: "flowpack", label: "Flowpack 1", px: 62, py: 270, match: /flow\s*-?pack/i },
  { id: "fp2", kind: "flowpack", label: "Flowpack 2", px: 72, py: 640, match: /aromate.*manual/i },
  { id: "masa_gastro", kind: "masa", label: "Masă gastro", px: 320, py: 1045, match: /gastro/i },
  { id: "masa_vrac", kind: "masa", label: "Masă vracuri", px: 540, py: 690, match: /vrac/i },
  { id: "masa_bio", kind: "masa", label: "Masă bio / coleslaw", px: 520, py: 585, match: /bio|coleslo|fructe/i },
  { id: "spalare_auto", kind: "spalare_auto", label: "Linia de spălat automată", px: 650, py: 820, match: /sp[ăa]lat.*automat/i },
  { id: "spalare_manual", kind: "spalare_manual", label: "Spălătoare mari", px: 520, py: 790, match: /sp[ăa]lat.*manual/i },
  { id: "rezerva1", kind: "masa", label: "Masă liberă", px: 420, py: 880, spare: true },
  { id: "rezerva2", kind: "masa", label: "Masă liberă", px: 140, py: 860, spare: true },
  { id: "rezerva3", kind: "masa", label: "Masă liberă", px: 150, py: 455, spare: true },
];

export type StationOverrides = Record<string, string>; // stationId → lineId (old per-browser choice)

/**
 * Layout used until someone saves one: the plan's machines, each line placed by an old per-browser choice,
 * then by the station's name rule, then on a free spare table. Spare tables left empty are not drawn.
 */
export function defaultLayout(lines: { id: string; nume: string }[], overrides: StationOverrides = {}): HallStation[] {
  const byStation = new Map<string, string>();
  const used = new Set<string>();
  const ids = new Set(lines.map((l) => l.id));
  for (const st of STATIONS) {
    const lid = overrides[st.id];
    if (lid && ids.has(lid) && !used.has(lid)) { byStation.set(st.id, lid); used.add(lid); }
  }
  for (const st of STATIONS) {
    if (byStation.has(st.id) || !st.match || st.id in overrides) continue;
    const l = lines.find((x) => !used.has(x.id) && st.match!.test(x.nume));
    if (l) { byStation.set(st.id, l.id); used.add(l.id); }
  }
  for (const st of STATIONS) {
    if (byStation.has(st.id) || !st.spare || st.id in overrides) continue;
    const l = lines.find((x) => !used.has(x.id));
    if (l) { byStation.set(st.id, l.id); used.add(l.id); }
  }
  return STATIONS
    .filter((st) => !st.spare || byStation.has(st.id))
    .map((st) => ({ id: st.id, kind: st.kind, label: st.label, px: st.px, py: st.py, rot: 0, lineId: byStation.get(st.id) ?? null }));
}

/** Which line works on which station of a layout; lines of the factory that stand nowhere are listed. */
export function placementOf(layout: HallStation[], lines: { id: string; nume: string }[]) {
  const ids = new Set(lines.map((l) => l.id));
  const byStation = new Map<string, string>();
  const used = new Set<string>();
  for (const st of layout) {
    if (st.lineId && ids.has(st.lineId) && !used.has(st.lineId)) { byStation.set(st.id, st.lineId); used.add(st.lineId); }
  }
  return { byStation, unplaced: lines.filter((l) => !used.has(l.id)) };
}

/** Puts a line on a station, taking it off any other station first (a line works in one place). */
export function setStationLine(layout: HallStation[], stationId: string, lineId: string | null): HallStation[] {
  return layout.map((st) => st.id === stationId ? { ...st, lineId } : lineId && st.lineId === lineId ? { ...st, lineId: null } : st);
}

/** A new machine in the middle of the hall, with a free code and a numbered name. */
export function newStation(layout: HallStation[], kind: StationKind, baseLabel: string, lineId: string | null = null): HallStation {
  let n = 1;
  while (layout.some((s) => s.id === `${kind}_${n}`)) n++;
  const same = layout.filter((s) => s.kind === kind).length + 1;
  return { id: `${kind}_${n}`, kind, label: `${baseLabel} ${same}`, px: PLAN.w / 2, py: PLAN.h / 2, rot: 0, lineId };
}

/** Floor flows drawn from the plan: raw material in from the gate, finished goods out to dispatch, hygiene border. */
export const FLOWS: { kind: "materie" | "finit" | "igiena"; pts: [number, number][] }[] = [
  { kind: "materie", pts: [[375, 1195], [375, 1150], [235, 1150], [235, 820], [175, 820], [150, 680], [150, 435], [185, 435]] },
  { kind: "materie", pts: [[350, 1150], [350, 830]] },
  { kind: "materie", pts: [[375, 1150], [575, 1150], [575, 1090]] },
  { kind: "finit", pts: [[130, 620], [130, 55], [610, 50], [610, 5]] },
  { kind: "finit", pts: [[395, 55], [395, 165]] },
  { kind: "finit", pts: [[455, 55], [480, 165]] },
  { kind: "finit", pts: [[575, 55], [600, 150]] },
  { kind: "igiena", pts: [[300, 150], [300, 565], [355, 565], [355, 785], [325, 785], [325, 915]] },
];

/** Machines on the plan that are not production lines: drawn for orientation only. */
export const FIXTURES: { label: string; px: number; py: number; w: number; d: number }[] = [
  { label: "Iceberg", px: 395, py: 620, w: 55, d: 40 },
  { label: "Replay 55", px: 390, py: 680, w: 35, d: 50 },
  { label: "Top sealing", px: 395, py: 740, w: 55, d: 25 },
];
