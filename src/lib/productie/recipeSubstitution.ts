/**
 * Rețetar: when a raw material is missing, the goods still ship. The missing ingredient is replaced
 * by its configured substitute (only from stock nobody else needs), and what is still missing is
 * made up by the other ingredients of the same recipe, cheapest first, each growing at most by the
 * configured percentage so the recipe does not change too much. Whatever cannot be covered stays
 * in the recipe and keeps showing as missing.
 */
import type { SubstitutionSettings } from "../../../supabase/functions/_shared/substitutionRules";
import { stockFor, type BookClient, type BookIngredient, type StockLine } from "./recipeBook";

export { DEFAULT_SUBSTITUTIONS, settingsFromRow, validSubstitutions, type SubstitutionRule, type SubstitutionSettings } from "../../../supabase/functions/_shared/substitutionRules";

const plain = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const EPS = 0.0005;

export type PriceLine = { name: string; pricePerKg: number };

/** Price per kg for one ingredient: same name, else the longest name contained either way (as for PT %). */
export function priceFor(ingredient: string, prices: PriceLine[]): number | null {
  const s = plain(ingredient);
  let best: PriceLine | null = null;
  for (const p of prices) {
    const a = plain(p.name);
    if (!a || !(p.pricePerKg > 0)) continue;
    if (a === s) return p.pricePerKg;
    if ((s.includes(a) || a.includes(s)) && (!best || a.length > plain(best.name).length)) best = p;
  }
  return best ? best.pricePerKg : null;
}

export type MaterialChange = {
  nume: string;
  /** always = replaced in every mixed recipe by rule; short = not enough stock. */
  reason: "always" | "short";
  /** Net kg that had to be replaced. */
  netKg: number;
  replaced: { nume: string; netKg: number }[];
  supplemented: { nume: string; netKg: number; pricePerKg: number | null }[];
  /** Net kg nobody could replace: stays in the recipe and stays missing. */
  uncoveredNetKg: number;
};

type Ing = { nume: string; kg: number; orig: number; pt: number | null; notes: Set<string> };
type Line = { c: number; p: number; bucati: number; ings: Map<string, Ing> };

export function substituteBook(book: BookClient[], opts: {
  /** null = stock not loaded yet: only the "always" rules apply. */
  stock: StockLine[] | null;
  /** Gross kg the day's other orders need, reserved before any substitute is taken. */
  other?: Map<string, number>;
  settings: SubstitutionSettings;
  priceOf: (nume: string) => number | null;
  ptOf: (nume: string) => number | null;
}) {
  const other = opts.other ?? new Map<string, number>();
  const maxPct = Math.max(0, opts.settings.maxIncreasePct);
  const lines: Line[] = [];
  book.forEach((c, ci) => c.products.forEach((p, pi) => {
    const ings = new Map<string, Ing>();
    p.ingredients.forEach(i => {
      const k = plain(i.nume), e = ings.get(k);
      if (e) { e.kg += i.kgPerBuc; e.orig += i.kgPerBuc; }
      else ings.set(k, { nume: i.nume, kg: i.kgPerBuc, orig: i.kgPerBuc, pt: i.ptPct, notes: new Set() });
    });
    lines.push({ c: ci, p: pi, bucati: p.bucati, ings });
  }));
  const grossOf = (i: Ing, bucati: number) => i.kg * bucati * (1 + (i.pt ?? 0) / 100);
  const needOf = (k: string) => lines.reduce((s, l) => { const i = l.ings.get(k); return i ? s + grossOf(i, l.bucati) : s; }, 0);
  const before = new Map<string, { nume: string; gross: number }>();
  lines.forEach(l => l.ings.forEach((i, k) => {
    const e = before.get(k) ?? { nume: i.nume, gross: 0 };
    e.gross += grossOf(i, l.bucati); before.set(k, e);
  }));
  const stockCache = new Map<string, number>();
  const stockKg = (nume: string) => {
    const k = plain(nume);
    if (!stockCache.has(k)) stockCache.set(k, opts.stock ? stockFor(nume, opts.stock).kg : 0);
    return stockCache.get(k)!;
  };
  const ptCache = new Map<string, number | null>();
  const pt = (nume: string, known?: number | null) => {
    const k = plain(nume);
    if (known !== undefined && !ptCache.has(k)) ptCache.set(k, known);
    if (!ptCache.has(k)) ptCache.set(k, opts.ptOf(nume));
    return ptCache.get(k) ?? 0;
  };
  const priceCache = new Map<string, number | null>();
  const price = (nume: string) => { const k = plain(nume); if (!priceCache.has(k)) priceCache.set(k, opts.priceOf(nume)); return priceCache.get(k)!; };
  /** Net kg of an ingredient still free in stock after the sheets and the day's other orders. */
  const freeNet = (nume: string) => Math.max(0, stockKg(nume) - needOf(plain(nume)) - (other.get(plain(nume)) || 0)) / (1 + pt(nume) / 100);

  const move = (l: Line, fromK: string, toName: string, net: number, how: "replace" | "supplement") => {
    const f = l.ings.get(fromK)!, per = net / l.bucati, tk = plain(toName);
    f.kg = Math.max(0, f.kg - per);
    let t = l.ings.get(tk);
    if (!t) { t = { nume: toName, kg: 0, orig: 0, pt: null, notes: new Set() }; t.pt = pt(toName); l.ings.set(tk, t); }
    t.kg += per;
    f.notes.add(how === "replace" ? `înlocuit cu ${toName}` : `completat cu ${toName}`);
    t.notes.add(how === "replace" ? `în loc de ${f.nume}` : `suplimentat pentru ${f.nume}`);
  };

  const rules = opts.settings.rules;
  const ruleOf = new Map(rules.map(r => [plain(r.from), r]));
  const alwaysOut = new Set(rules.filter(r => r.always && r.to.length).map(r => plain(r.from)));
  const changes: MaterialChange[] = [];

  // 1. Ingredients that exist only on paper in mixed recipes (e.g. Iceberg → Pan di Zuchero): always replaced.
  for (const r of rules.filter(r => r.always && r.to.length)) {
    const k = plain(r.from), to = r.to[0];
    let total = 0, nume = r.from;
    lines.forEach(l => {
      const i = l.ings.get(k);
      if (!i || i.kg <= 0) return;
      nume = i.nume; const net = i.kg * l.bucati; total += net;
      move(l, k, to, net, "replace");
    });
    if (total > EPS) changes.push({ nume, reason: "always", netKg: round(total), replaced: [{ nume: to, netKg: round(total) }], supplemented: [], uncoveredNetKg: 0 });
  }

  // 2. Not enough stock: substitute, then the recipe's other ingredients, cheapest first.
  if (opts.stock) {
    const keys = new Map<string, string>();
    lines.forEach(l => l.ings.forEach((i, k) => { if (i.kg > 0 && !keys.has(k)) keys.set(k, i.nume); }));
    const short = [...keys.entries()]
      .map(([k, nume]) => ({ k, nume, deficit: needOf(k) - stockKg(nume) }))
      .filter(d => d.deficit > EPS)
      .sort((a, b) => b.deficit - a.deficit || a.nume.localeCompare(b.nume, "ro"));
    const shortSet = new Set(short.map(s => s.k));
    for (const { k, nume } of short) {
      const deficit = needOf(k) - stockKg(nume);
      if (deficit <= EPS) continue;
      const holders = lines.filter(l => (l.ings.get(k)?.kg ?? 0) > 0);
      const totalNet = holders.reduce((s, l) => s + l.ings.get(k)!.kg * l.bucati, 0);
      if (totalNet <= EPS) continue;
      const shortNet = Math.min(totalNet, deficit / (1 + pt(nume, holders[0].ings.get(k)!.pt) / 100));
      // The same share of the ingredient is replaced in every recipe that uses it.
      const want = new Map(holders.map(l => [l, l.ings.get(k)!.kg * l.bucati * shortNet / totalNet]));
      const left = () => [...want.values()].reduce((s, v) => s + v, 0);
      const change: MaterialChange = { nume, reason: "short", netKg: round(shortNet), replaced: [], supplemented: [], uncoveredNetKg: 0 };

      for (const to of ruleOf.get(k)?.to ?? []) {
        const tk = plain(to);
        if (shortSet.has(tk) || alwaysOut.has(tk) || left() <= EPS) continue;
        const cap = freeNet(to), f = Math.min(1, cap / left());
        if (cap <= EPS) continue;
        let moved = 0;
        holders.forEach(l => { const m = want.get(l)! * f; if (m > 1e-9) { move(l, k, to, m, "replace"); want.set(l, want.get(l)! - m); moved += m; } });
        if (moved > EPS) change.replaced.push({ nume: to, netKg: round(moved) });
      }

      const candidates = new Map<string, string>();
      holders.forEach(l => l.ings.forEach((i, ik) => {
        if (ik !== k && i.orig > 0 && !shortSet.has(ik) && !alwaysOut.has(ik) && !candidates.has(ik)) candidates.set(ik, i.nume);
      }));
      const ordered = [...candidates.entries()].sort((a, b) => {
        const pa = price(a[1]), pb = price(b[1]);
        if (pa != null && pb != null && pa !== pb) return pa - pb;
        if ((pa == null) !== (pb == null)) return pa == null ? 1 : -1;
        return a[1].localeCompare(b[1], "ro");
      });
      for (const [ik, inume] of ordered) {
        if (left() <= EPS) break;
        const caps = holders.map(l => {
          const i = l.ings.get(ik);
          if (!i || i.orig <= 0) return 0;
          const room = i.orig * l.bucati * maxPct / 100 - Math.max(0, i.kg - i.orig) * l.bucati;
          return Math.max(0, Math.min(want.get(l)!, room));
        });
        const total = caps.reduce((s, v) => s + v, 0);
        if (total <= EPS) continue;
        const f = Math.min(1, freeNet(inume) / total);
        if (f <= 0) continue;
        let moved = 0;
        holders.forEach((l, idx) => { const m = caps[idx] * f; if (m > 1e-9) { move(l, k, inume, m, "supplement"); want.set(l, want.get(l)! - m); moved += m; } });
        if (moved > EPS) change.supplemented.push({ nume: inume, netKg: round(moved), pricePerKg: price(inume) });
      }
      change.uncoveredNetKg = round(left());
      changes.push(change);
    }
  }

  // 3. Rebuild the sheets with the changed recipes.
  const out: BookClient[] = book.map((c, ci) => {
    const products = c.products.map((p, pi) => {
      const l = lines.find(x => x.c === ci && x.p === pi)!;
      const ingredients: BookIngredient[] = [...l.ings.values()].filter(i => i.kg > 1e-9 || i.orig > 0).map(i => {
        const netKg = i.kg * l.bucati, changed = Math.abs(i.kg - i.orig) > 1e-9;
        return {
          nume: i.nume, kgPerBuc: round(i.kg, 6), netKg: round(netKg), ptPct: i.pt, brutKg: round(netKg * (1 + (i.pt ?? 0) / 100)),
          ...(changed ? { origKgPerBuc: i.orig, nota: [...i.notes].join("; ") } : {}),
        };
      });
      return { ...p, ingredients, netKg: round(ingredients.reduce((s, i) => s + i.netKg, 0)), brutKg: round(ingredients.reduce((s, i) => s + i.brutKg, 0)) };
    });
    const materials = new Map<string, { nume: string; netKg: number; ptPct: number | null; brutKg: number }>();
    products.forEach(p => p.ingredients.forEach(i => {
      if (i.netKg <= 0) return;
      const k = plain(i.nume), m = materials.get(k) ?? { nume: i.nume, netKg: 0, ptPct: i.ptPct, brutKg: 0 };
      m.netKg = round(m.netKg + i.netKg); m.brutKg = round(m.brutKg + i.brutKg); materials.set(k, m);
    }));
    return {
      ...c, products,
      netKg: round(products.reduce((s, p) => s + p.netKg, 0)), brutKg: round(products.reduce((s, p) => s + p.brutKg, 0)),
      materials: [...materials.values()].sort((a, b) => b.netKg - a.netKg),
    };
  });

  // 4. Raw-material cost difference (gross kg bought × price per kg).
  const after = new Map<string, { nume: string; gross: number }>();
  lines.forEach(l => l.ings.forEach((i, k) => {
    const e = after.get(k) ?? { nume: i.nume, gross: 0 };
    e.gross += grossOf(i, l.bucati); after.set(k, e);
  }));
  let costDelta = 0;
  const unpriced = new Set<string>();
  new Set([...before.keys(), ...after.keys()]).forEach(k => {
    const d = (after.get(k)?.gross ?? 0) - (before.get(k)?.gross ?? 0);
    if (Math.abs(d) <= EPS) return;
    const nume = after.get(k)?.nume ?? before.get(k)!.nume, p = price(nume);
    if (p == null) unpriced.add(nume); else costDelta += d * p;
  });
  return { book: out, changes, costDelta: round(costDelta, 2), unpriced: [...unpriced].sort() };
}
