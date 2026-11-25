/** Future macro/legal changes (minimum wage, diesel, energy, packaging taxes…) turned into cost-line % for the cost-structure scenario. */
import type { CostKey } from "./costStructure";

export const LEVER_KEYS = ["salariu", "motorina", "energie", "ambalaje", "mp", "inflatie"] as const;
export type LeverKey = typeof LEVER_KEYS[number];
export const LEVER_LABEL: Record<LeverKey, string> = {
  salariu: "Salariu minim / contribuții", motorina: "Motorină / acciză", energie: "Energie & gaz",
  ambalaje: "Ambalaje (taxă mediu, RetuRO, plastic)", mp: "Materie primă (furnizori)", inflatie: "Inflație servicii generale",
};
export type Levers = Partial<Record<LeverKey, number>>;

/** How much of each cost line moves with each lever (0..1). Editable estimates, not measured shares. */
export type Weights = Partial<Record<CostKey, Partial<Record<LeverKey, number>>>>;
export const DEFAULT_WEIGHTS: Weights = {
  mp: { mp: 1 },
  ambalaje: { ambalaje: 1 },
  manopera: { salariu: 1 },
  regie: { salariu: 0.4, energie: 0.35, inflatie: 0.25 },
  aprovizionare: { motorina: 0.35, salariu: 0.2, inflatie: 0.45 },
  distributie: { motorina: 0.35, salariu: 0.2, inflatie: 0.45 },
};

/** % change of each cost line = Σ lever % × weight. Lines without weights are unchanged. */
export function leversToPct(levers: Levers, weights: Weights = DEFAULT_WEIGHTS): Partial<Record<CostKey, number>> {
  const out: Partial<Record<CostKey, number>> = {};
  for (const [k, w] of Object.entries(weights) as Array<[CostKey, Partial<Record<LeverKey, number>>]>) {
    let v = 0;
    for (const [l, share] of Object.entries(w) as Array<[LeverKey, number]>) v += (levers[l] ?? 0) * share;
    if (v) out[k] = Math.round(v * 100) / 100;
  }
  return out;
}

/** A known or expected change the user can apply. Values are editable estimates, never presented as law. */
export type Preset = { id: string; title: string; note: string; levers: Levers; feeDelta?: number };
export const PRESETS: Preset[] = [
  { id: "prudent", title: "Anul viitor — prudent", note: "Scumpiri moderate; verifică cifrele cu contabila înainte de negociere.", levers: { salariu: 8, motorina: 5, energie: 5, ambalaje: 3, mp: 3, inflatie: 5 } },
  { id: "dur", title: "Anul viitor — dur", note: "Salariu minim mare, acciză și energie în creștere, taxe de mediu pe ambalaje.", levers: { salariu: 15, motorina: 12, energie: 20, ambalaje: 10, mp: 6, inflatie: 8 } },
  { id: "salariu", title: "Doar salariul minim", note: "Introdu procentul anunțat oficial pentru salariul minim brut.", levers: { salariu: 10 } },
  { id: "motorina", title: "Doar motorina", note: "Scumpirea motorinei lovește camioanele de aprovizionare și distribuție.", levers: { motorina: 15 } },
];

/** Plain-language warnings: which lever hurts most, given today's cost lines (lei over the period). */
export function leverImpact(costs: Partial<Record<CostKey, number>>, levers: Levers, weights: Weights = DEFAULT_WEIGHTS): Array<{ lever: LeverKey; lei: number }> {
  return LEVER_KEYS.map((l) => {
    let lei = 0;
    for (const [k, w] of Object.entries(weights) as Array<[CostKey, Partial<Record<LeverKey, number>>]>) lei += (costs[k] ?? 0) * ((levers[l] ?? 0) * (w[l] ?? 0)) / 100;
    return { lever: l, lei };
  }).filter((x) => x.lei).sort((a, b) => b.lei - a.lei);
}
