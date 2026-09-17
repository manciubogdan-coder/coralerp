/**
 * Grupuri de linii pentru interfața de operator.
 *
 * Unele produse se fac pe mai multe linii fizice echivalente (Aromate automată /
 * manuală, Salate 1 / Salate 2). Ca să nu fie nevoie de modificarea rețetelor /
 * regulilor de distribuire, liniile din aceeași grupă apar în interfața de
 * operator ca o singură intrare, iar linia fizică se alege la pornirea sesiunii.
 *
 * Grupa fiecărei linii se configurează manual din pagina de Linii; dacă nu
 * există configurare, se aplică grupele implicite după numele liniei.
 */

export interface DisplayLine {
  id: string;
  nume: string;
  capacitate_ora: number;
  memberIds: string[];
  members: { id: string; nume: string }[];
  isGroup: boolean;
}

export const DEFAULT_LINE_GROUPS: { match: string; group: string }[] = [
  { match: "arom", group: "Aromate" },
  { match: "salat", group: "Salate" },
];

export const defaultGroupForLine = (nume?: string | null): string => {
  const n = (nume || "").toLowerCase();
  const hit = DEFAULT_LINE_GROUPS.find((g) => n.includes(g.match));
  return hit ? hit.group : "";
};

/** Grupa efectivă a unei linii: configurarea manuală bate implicitul. */
export const groupForLine = (
  line: any,
  groupMap?: Record<string, string>,
): string => {
  if (groupMap && Object.prototype.hasOwnProperty.call(groupMap, line?.id)) {
    return (groupMap[line.id] || "").trim();
  }
  return defaultGroupForLine(line?.nume);
};

export const buildDisplayLines = (
  lines?: any[] | null,
  groupMap?: Record<string, string>,
): DisplayLine[] => {
  if (!lines || lines.length === 0) return [];

  const single = (l: any): DisplayLine => ({
    id: l.id,
    nume: l.nume,
    capacitate_ora: Number(l.capacitate_ora || 0),
    memberIds: [l.id],
    members: [{ id: l.id, nume: l.nume }],
    isGroup: false,
  });

  const result: DisplayLine[] = [];
  const grouped = new Map<string, any[]>();

  for (const l of lines) {
    const grup = groupForLine(l, groupMap);
    if (!grup) {
      result.push(single(l));
      continue;
    }
    if (!grouped.has(grup)) grouped.set(grup, []);
    grouped.get(grup)!.push(l);
  }

  for (const [grup, members] of grouped.entries()) {
    if (members.length === 1) {
      result.push(single(members[0]));
      continue;
    }
    result.push({
      id: `group:${grup.toLowerCase()}`,
      nume: grup,
      capacitate_ora: Math.max(
        ...members.map((l) => Number(l.capacitate_ora || 0)),
      ),
      memberIds: members.map((l) => l.id),
      members: members.map((l) => ({ id: l.id, nume: l.nume })),
      isGroup: true,
    });
  }

  return result;
};
