// Audit: Senior recipes whose quantity per case (version Cantitate = pieces the recipe yields) disagrees with the
// real case content invoiced/ordered (CT_CantitateBAX). A recipe of 1 piece on a product sold in cases of N pieces
// makes the price per case equal to the price per piece in the calculator.
import { packagingUnits } from "./packagingRules.ts";

export type CaseRow = { id: number; code: string; name: string; vq: number; units: string; lines: number; last: string };
export type CaseIssue = { id: number; code: string; name: string; recipeUnits: number; caseUnits: number; caseVariants: string; lines: number; lastDocument: string; problem: string };

const piecesOf = (u: string) => u.split("+").reduce((s, x) => s + Number(x), 0);

/** Pure rule: one issue per product whose most-used real case content (>1 piece) differs from the recipe quantity. */
export function caseIssues(rows: CaseRow[]): CaseIssue[] {
  const by = new Map<number, CaseRow[]>();
  for (const r of rows) {
    const u = packagingUnits(r.units);
    if (!u) continue;
    by.set(r.id, [...(by.get(r.id) ?? []), { ...r, units: u }]);
  }
  const out: CaseIssue[] = [];
  for (const list of by.values()) {
    const agg = new Map<number, { lines: number; last: string }>();
    for (const r of list) {
      const p = piecesOf(r.units);
      const a = agg.get(p) ?? { lines: 0, last: "" };
      a.lines += Number(r.lines) || 0; if (String(r.last) > a.last) a.last = String(r.last);
      agg.set(p, a);
    }
    const [main, info] = [...agg.entries()].sort((a, b) => b[1].lines - a[1].lines)[0];
    const vq = Number(list[0].vq) || 0;
    if (main <= 1 || Math.abs(vq - main) < 0.001) continue;
    out.push({
      id: list[0].id, code: String(list[0].code ?? "").trim(), name: String(list[0].name ?? "").trim(), recipeUnits: vq, caseUnits: main,
      caseVariants: [...agg.entries()].map(([p, a]) => `${p} buc (${a.lines} linii)`).join(", "), lines: info.lines, lastDocument: info.last.slice(0, 10),
      problem: vq <= 1 ? "Rețeta e pe 1 bucată, dar se vinde la bax: preț bax = preț bucată" : `Rețeta e pe ${vq} buc, baxul real are ${main} buc`,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

