// Production hall layout, traced from the factory floor plan (780×1200 px drawing).
// Pure data + the rule that places each production line on its machine; no React or three.

export const PLAN = { w: 780, h: 1200 };
export const HALL = { w: 26, d: 40 }; // metres in the 3D scene

/** Plan pixel → scene metres, hall centred on the origin (x = plan right, z = plan down). */
export const toWorld = (px: number, py: number): [number, number] => [
  (px / PLAN.w - 0.5) * HALL.w,
  (py / PLAN.h - 0.5) * HALL.d,
];

export type StationKind = "cantar" | "flowpack" | "masa" | "spalare_auto" | "spalare_manual";
export interface Station { id: string; kind: StationKind; label: string; px: number; py: number; match?: RegExp; spare?: boolean }

export const STATIONS: Station[] = [
  { id: "cantar1", kind: "cantar", label: "Cântar 1", px: 235, py: 300, match: /salate\s*1|vertical/i },
  { id: "cantar2", kind: "cantar", label: "Cântar 2", px: 355, py: 300, match: /salate\s*2/i },
  { id: "cantar3", kind: "cantar", label: "Cântar 3", px: 525, py: 300, match: /spanac/i },
  { id: "cantar4", kind: "cantar", label: "Cântar 4", px: 650, py: 300, match: /aromate.*automat/i },
  { id: "cantar5", kind: "cantar", label: "Cântar 5 · Giostra", px: 300, py: 740, match: /giostra/i },
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

export type StationOverrides = Record<string, string>; // stationId → lineId

/**
 * Which line sits on which machine: a saved choice wins, then the name rule of the station,
 * then any free spare table. Lines that find no place are returned so the page can list them.
 */
export function assignStations(lines: { id: string; nume: string }[], overrides: StationOverrides = {}) {
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
  return { byStation, unplaced: lines.filter((l) => !used.has(l.id)) };
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
