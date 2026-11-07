// Audit: Senior recipes written for a whole case but whose version Cantitate (pieces the recipe yields) is 1.
// The price calculator divides the recipe by that Cantitate, so such a recipe shows lei/bax = lei/buc while its
// components (e.g. 4 caserole + 4 etichete, or 2 kg for a 500 g product) prove a case of several pieces.

export type RecipeRow = { pa: number; pcode: string | null; pname: string; vid: number; vq: number; impl: number | boolean | null; ds: string | null; id: number; name: string; q: number; um: string | null };
export type BaxRow = { aid: number; units: string; lines: number };
export type RecipeStatus = "ok" | "case_as_piece" | "component_qty" | "kg_check";
export type RecipeCheck = {
  id: number; code: string; name: string; recipeUnits: number; suggestedUnits: number | null;
  caseUnits: number | null; caseVariants: string; status: RecipeStatus; problem: string; components: string;
};

const CASE = /CUTI|LAZI|POLISTIREN|BAX|CARTON|NAVET|PALET/i;
const CONTAINER = /CASEROL|PUNG|PAHAR|BOL|TAVI|ALIGAL|SUPORT/i;
const LABEL = /ETICHET/i;
const SERVICE = /^(MANOPERA PRODUCTIE|CHELTUIELI FIXE PRODUCTIE)$/i;
export const STATUS_LABEL: Record<RecipeStatus, string> = {
  ok: "OK", case_as_piece: "Rețetă pe bax, marcată 1 buc", component_qty: "Componentă greșită", kg_check: "La KG — de verificat",
};

const fmt = (x: number) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")).replace(".", ",");
const piecesOf = (u: string) => { const p = String(u).split("+").map(Number); return p.every((x) => x > 0) ? p.reduce((s, x) => s + x, 0) : null; };
/** Grams per piece from the product name ("RUCOLA 500G", "CIMBRU 30 GR", "SPANAC 1KG"). */
export function gramsInName(name: string) {
  const m = /(\d+(?:[.,]\d+)?)\s*(KG|G|GR)\b/i.exec(name);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return m[2].toUpperCase() === "KG" ? v * 1000 : v;
}
/** Sold by the kilo ("BUSUIOC KG"), not a pack weight like "1KG". */
const soldByKg = (name: string) => /\bKG\b/i.test(name) && !/\d\s*KG/i.test(name);

/** Same version the price calculator uses: the default active version, else the most recent. */
export function pickVersions(rows: RecipeRow[]) {
  const by = new Map<number, Map<number, RecipeRow[]>>();
  for (const r of rows) {
    const vs = by.get(r.pa) ?? new Map<number, RecipeRow[]>();
    vs.set(r.vid, [...(vs.get(r.vid) ?? []), r]);
    by.set(r.pa, vs);
  }
  const out = new Map<number, RecipeRow[]>();
  for (const [pa, vs] of by) out.set(pa, [...vs.values()].sort((a, b) => (Number(!!b[0].impl) - Number(!!a[0].impl)) || String(b[0].ds ?? "").localeCompare(String(a[0].ds ?? "")))[0]);
  return out;
}

/** Pure rule over every active Senior recipe. */
export function recipeChecks(rows: RecipeRow[], bax: BaxRow[] = []): RecipeCheck[] {
  const ct = new Map<number, Map<number, number>>();
  for (const b of bax) {
    const p = piecesOf(b.units);
    if (!p) continue;
    const m = ct.get(Number(b.aid)) ?? new Map<number, number>();
    m.set(p, (m.get(p) ?? 0) + (Number(b.lines) || 0));
    ct.set(Number(b.aid), m);
  }
  const out: RecipeCheck[] = [];
  for (const [pa, list] of pickVersions(rows)) {
    const h = list[0], name = String(h.pname ?? "").trim(), vq = Number(h.vq) || 0;
    const unit = (r: RecipeRow) => String(r.um ?? "").trim().toUpperCase();
    const pieces = list.filter((r) => unit(r) === "BUC" && !CASE.test(r.name));
    const cont = pieces.filter((r) => CONTAINER.test(r.name)), lab = pieces.filter((r) => LABEL.test(r.name));
    const kg = list.filter((r) => unit(r) === "KG").reduce((s, r) => s + Number(r.q || 0), 0);
    const g = gramsInName(name), est = g && kg ? kg * 1000 / g : null;
    const maxC = Math.max(0, ...cont.map((r) => Number(r.q))), maxL = Math.max(0, ...lab.map((r) => Number(r.q)));
    const variants = [...(ct.get(pa) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]);
    let status: RecipeStatus = "ok", problem = "", suggested: number | null = null;
    if (vq <= 1 && (maxC > 1 || maxL > 1 || (est != null && est > 1.6))) {
      if (soldByKg(name)) {
        status = "kg_check";
        problem = `Produs vândut la kg; rețeta are ${fmt(maxC || maxL)} pungi/etichete la 1 kg. Dacă 1 kg se ambalează în ${fmt(maxC || maxL)} pungi e corect; altfel cantitatea ambalajului e greșită.`;
      } else if (maxC > 0 && maxC <= 1 && maxL > 1) {
        status = "component_qty";
        problem = `${fmt(maxL)} etichete la ${fmt(maxC)} ${cont[0].name.trim()}: cantitatea etichetei pare greșită (de obicei 1 pe bucată).`;
      } else {
        status = "case_as_piece";
        const counts = new Map<number, number>();
        for (const x of [...cont, ...lab].map((r) => Math.round(Number(r.q))).filter((x) => x > 1)) counts.set(x, (counts.get(x) ?? 0) + 1);
        suggested = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (est ? Math.round(est) : null);
        const ev = [...cont, ...lab].filter((r) => Number(r.q) > 1).map((r) => `${r.name.trim()} ${fmt(Number(r.q))} buc`);
        if (est != null && est > 1.6) ev.push(`${fmt(Math.round(kg * 1000) / 1000)} kg materie primă ÷ ${fmt(g!)} g = ${fmt(Math.round(est * 100) / 100)} bucăți`);
        problem = `Rețeta conține componente pentru ${suggested ?? "mai multe"} bucăți (${ev.join("; ")}), dar Cantitatea versiunii e ${fmt(vq)}: în calculator lei/bax = lei/buc. Pune Cantitate versiune = ${suggested ?? "nr. bucăți din bax"}.`;
      }
    }
    out.push({
      id: pa, code: String(h.pcode ?? "").trim(), name, recipeUnits: vq, suggestedUnits: suggested,
      caseUnits: variants[0]?.[0] ?? null, caseVariants: variants.map(([p, l]) => `${fmt(p)} buc (${l} linii)`).join(", "),
      status, problem,
      components: list.filter((r) => !SERVICE.test(r.name.trim())).map((r) => `${r.name.trim()} ${fmt(Number(r.q))} ${String(r.um ?? "").trim()}`).join("; "),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
