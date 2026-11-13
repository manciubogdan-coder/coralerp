// Saved layout of the production hall in Viziune: which machines/tables stand where and which line works on each.
// Shared by the page (editing) and the argus function (validating before it is saved for everyone). No React, no Deno.

export const PLAN = { w: 780, h: 1200 }; // floor-plan drawing, in pixels
export const STATION_KINDS = ["cantar", "giostra", "flowpack", "masa", "spalare_auto", "spalare_manual", "utilaj"] as const;
export type StationKind = typeof STATION_KINDS[number];
export const KIND_LABEL: Record<StationKind, string> = {
  cantar: "Cântar cu masă rotativă",
  giostra: "Giostra (cântar + flowpack)",
  flowpack: "Flowpack",
  masa: "Masă de lucru",
  spalare_auto: "Linie de spălat automată",
  spalare_manual: "Spălătoare mari",
  utilaj: "Alt utilaj",
};
export const ROTATIONS = [0, 90, 180, 270] as const;
export const MAX_STATIONS = 60;

export interface HallStation {
  id: string;
  kind: StationKind;
  label: string;
  px: number;
  py: number;
  rot: number;
  lineId: string | null;
}

const ID_RE = /^[a-z0-9_-]{1,40}$/i;
const LINE_RE = /^[0-9a-f-]{36}$/i;

/** Checks a layout sent for saving; throws a message the user can read. Coordinates are rounded and kept inside the hall. */
export function validateHallLayout(raw: unknown): HallStation[] {
  if (!Array.isArray(raw)) throw new Error("Planul halei lipsește.");
  if (raw.length > MAX_STATIONS) throw new Error(`Cel mult ${MAX_STATIONS} utilaje în hală.`);
  const ids = new Set<string>();
  const lines = new Set<string>();
  return raw.map((s: any, i: number) => {
    const id = String(s?.id ?? "").trim();
    if (!ID_RE.test(id)) throw new Error(`Utilajul ${i + 1} nu are un cod valid.`);
    if (ids.has(id)) throw new Error(`Utilajul ${id} apare de două ori.`);
    ids.add(id);
    const kind = String(s?.kind ?? "") as StationKind;
    if (!STATION_KINDS.includes(kind)) throw new Error(`Tip necunoscut la utilajul ${i + 1}.`);
    const label = String(s?.label ?? "").trim().slice(0, 60);
    if (!label) throw new Error(`Utilajul ${i + 1} nu are nume.`);
    const px = Number(s?.px), py = Number(s?.py);
    if (!Number.isFinite(px) || !Number.isFinite(py)) throw new Error(`Poziție invalidă la ${label}.`);
    const rot = Number(s?.rot ?? 0);
    if (!(ROTATIONS as readonly number[]).includes(rot)) throw new Error(`Rotire invalidă la ${label}.`);
    const lineId = s?.lineId == null || s.lineId === "" ? null : String(s.lineId);
    if (lineId !== null) {
      if (!LINE_RE.test(lineId)) throw new Error(`Linie invalidă la ${label}.`);
      if (lines.has(lineId)) throw new Error(`O linie nu poate sta pe două utilaje (${label}).`);
      lines.add(lineId);
    }
    return {
      id, kind, label, rot, lineId,
      px: Math.round(Math.min(PLAN.w, Math.max(0, px))),
      py: Math.round(Math.min(PLAN.h, Math.max(0, py))),
    };
  });
}
