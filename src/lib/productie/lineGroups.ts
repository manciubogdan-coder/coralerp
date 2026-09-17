/**
 * Grupuri de linii pentru interfața de operator.
 *
 * Aromate are două linii fizice (automată și manuală) și se lucrează uneori pe
 * ambele, uneori doar pe una. Ca să nu fie nevoie de modificarea rețetelor /
 * regulilor de distribuire, în interfața de operator ele apar ca o singură
 * grupă „Aromate", iar linia fizică se alege la pornirea sesiunii.
 */

export interface DisplayLine {
  id: string;
  nume: string;
  capacitate_ora: number;
  memberIds: string[];
  members: { id: string; nume: string }[];
  isGroup: boolean;
}

const AROMATE_GROUP_ID = "group:aromate";
const AROMATE_GROUP_NAME = "Aromate";

const isAromateLineName = (nume?: string | null) =>
  (nume || "").toLowerCase().includes("arom");

export const buildDisplayLines = (lines?: any[] | null): DisplayLine[] => {
  if (!lines || lines.length === 0) return [];

  const aromate = lines.filter((l) => isAromateLineName(l?.nume));
  const rest = lines.filter((l) => !isAromateLineName(l?.nume));

  const result: DisplayLine[] = rest.map((l) => ({
    id: l.id,
    nume: l.nume,
    capacitate_ora: Number(l.capacitate_ora || 0),
    memberIds: [l.id],
    members: [{ id: l.id, nume: l.nume }],
    isGroup: false,
  }));

  if (aromate.length === 1) {
    const l = aromate[0];
    result.push({
      id: l.id,
      nume: l.nume,
      capacitate_ora: Number(l.capacitate_ora || 0),
      memberIds: [l.id],
      members: [{ id: l.id, nume: l.nume }],
      isGroup: false,
    });
  } else if (aromate.length > 1) {
    result.push({
      id: AROMATE_GROUP_ID,
      nume: AROMATE_GROUP_NAME,
      capacitate_ora: Math.max(
        ...aromate.map((l) => Number(l.capacitate_ora || 0)),
      ),
      memberIds: aromate.map((l) => l.id),
      members: aromate.map((l) => ({ id: l.id, nume: l.nume })),
      isGroup: true,
    });
  }

  return result;
};
