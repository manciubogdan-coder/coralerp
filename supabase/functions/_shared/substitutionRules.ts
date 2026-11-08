/**
 * Rețetar raw-material substitutions: which ingredient replaces a missing one, and how much
 * the other ingredients of a recipe may grow when nothing replaces it. Shared by the screen and the save action.
 */
export type SubstitutionRule = {
  /** Missing ingredient, as named in the recipes. */
  from: string;
  /** Replacements in order of preference; empty = no replacement, only the other ingredients grow. */
  to: string[];
  /** Always replaced in mixed recipes, even with stock (the recipe ingredient is only theoretical). */
  always: boolean;
};
export type SubstitutionSettings = { rules: SubstitutionRule[]; maxIncreasePct: number };

export const DEFAULT_SUBSTITUTIONS: SubstitutionSettings = {
  rules: [
    { from: "Iceberg", to: ["Pan di Zuchero"], always: true },
    { from: "Scarola", to: ["Pan di Zuchero"], always: false },
    { from: "Mizuna Green", to: ["Mizuna Red"], always: false },
    { from: "Morcovi", to: [], always: false },
  ],
  maxIncreasePct: 50,
};

const key = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const name = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

/** Validates user input; throws a message the user can act on. */
export function validSubstitutions(input: unknown): SubstitutionSettings {
  const raw = (input ?? {}) as { rules?: unknown; maxIncreasePct?: unknown };
  if (!Array.isArray(raw.rules) || raw.rules.length > 100) throw new Error("Lista de înlocuiri este invalidă.");
  const max = Number(raw.maxIncreasePct);
  if (!Number.isFinite(max) || max < 0 || max > 300) throw new Error("Creșterea maximă trebuie să fie între 0% și 300%.");
  const seen = new Set<string>();
  const rules = raw.rules.map((r: any): SubstitutionRule => {
    const from = name(r?.from);
    if (!from) throw new Error("Alege ingredientul care lipsește.");
    if (seen.has(key(from))) throw new Error(`${from} apare de două ori.`);
    seen.add(key(from));
    if (!Array.isArray(r?.to) || r.to.length > 5) throw new Error(`Înlocuitorii pentru ${from} sunt invalizi.`);
    const to = [...new Map(r.to.map(name).filter(Boolean).map((t: string) => [key(t), t])).values()] as string[];
    if (to.some(t => key(t) === key(from))) throw new Error(`${from} nu se poate înlocui cu el însuși.`);
    const always = r?.always === true;
    if (always && !to.length) throw new Error(`Alege cu ce înlocuiești mereu ${from}.`);
    return { from, to, always };
  });
  return { rules, maxIncreasePct: Math.round(max * 100) / 100 };
}

/** Saved row → settings; a broken row falls back to the defaults. */
export function settingsFromRow(row: { rules?: unknown; max_increase_pct?: unknown } | null | undefined): SubstitutionSettings {
  if (!row) return DEFAULT_SUBSTITUTIONS;
  try { return validSubstitutions({ rules: row.rules, maxIncreasePct: row.max_increase_pct }); }
  catch { return DEFAULT_SUBSTITUTIONS; }
}
