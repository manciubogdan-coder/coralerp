/**
 * Rețetar: mixed-product recipes multiplied by the Senior orders already received,
 * grouped by main client (all Lidl stores together, HoReCa by client nickname).
 */
export type RecipeIngredient = { nume: string; kgPerBuc: number };
export type MixedRecipe = { produsId: string; produs: string; ingredients: RecipeIngredient[]; recipeId?: string };
export type RecipeBookOrder = { magazin: string | null; produs_id: string | null; cantitate: number; baxare?: string | null; tip_comanda?: string | null };
export type LossRule = { name: string; pt_percent: number | null };

export type BookIngredient = RecipeIngredient & { netKg: number; ptPct: number | null; brutKg: number };
export type BookProduct = { produsId: string; recipeId?: string; produs: string; bucBax: string | null; bucati: number; ingredients: BookIngredient[]; netKg: number; brutKg: number; stores: string[] };
export type BookClient = { client: string; products: BookProduct[]; bucati: number; netKg: number; brutKg: number; materials: { nume: string; netKg: number; ptPct: number | null; brutKg: number }[] };

const plain = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Units in recipes are grams unless marked kg. */
export const toKg = (q: number, unit: string | null | undefined) => {
  const u = String(unit ?? '').trim().toLowerCase();
  if (u === 'kg') return q;
  if (u === 't') return q * 1000;
  if (u.startsWith('g')) return q / 1000;
  return q;
};

/** Mixed = recipe with more than one ingredient (same rule as the operator day summary). */
export const isMixed = (r: MixedRecipe) => r.ingredients.filter(i => i.kgPerBuc > 0).length > 1;

/**
 * Main client: the client's nickname when set (HoReCa groups such as "MIRCEA HORECA"),
 * otherwise the company name without the store suffix ("LIDL DISCOUNT SRL - ARICESTI" → "LIDL DISCOUNT SRL").
 */
export function mainClient(magazin: string | null | undefined, nickname?: string | null) {
  const nick = String(nickname ?? '').replace(/\s+/g, ' ').trim();
  if (nick) return nick.toUpperCase();
  const name = String(magazin ?? '').replace(/\s+/g, ' ').trim();
  return (name.split(/\s+-\s+/)[0] || name || 'FĂRĂ CLIENT').trim().toUpperCase();
}

/** Technological loss from the raw-material list: exact name, else the longest contained name. */
export function lossFor(ingredient: string, rules: LossRule[]) {
  const s = plain(ingredient);
  let best: LossRule | null = null;
  for (const r of rules) {
    if (r.pt_percent == null) continue;
    const a = plain(r.name);
    if (!a) continue;
    if (a === s) return Number(r.pt_percent);
    if ((s.includes(a) || a.includes(s)) && (!best || a.length > plain(best.name).length)) best = r;
  }
  return best ? Number(best.pt_percent) : null;
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const mostCommon = (values: (string | null)[]) => {
  const count = new Map<string, number>();
  values.forEach(v => { if (v) count.set(v, (count.get(v) || 0) + 1); });
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

export function buildRecipeBook(
  orders: RecipeBookOrder[],
  recipes: MixedRecipe[],
  losses: LossRule[],
  clientOf: (o: RecipeBookOrder) => string,
  unitsOf: (o: RecipeBookOrder) => string | null = o => o.baxare ?? null,
): BookClient[] {
  const byProduct = new Map(recipes.filter(isMixed).map(r => [r.produsId, r]));
  const groups = new Map<string, Map<string, RecipeBookOrder[]>>();
  for (const o of orders) {
    const qty = Number(o.cantitate) || 0;
    if (qty <= 0 || !o.produs_id || !byProduct.has(o.produs_id)) continue;
    if (o.tip_comanda === 'PRODUCTIE_AVANS' || o.tip_comanda === 'REAMBALARE' || o.magazin === 'REAMBALARE') continue;
    const client = clientOf(o);
    if (!groups.has(client)) groups.set(client, new Map());
    const products = groups.get(client)!;
    if (!products.has(o.produs_id)) products.set(o.produs_id, []);
    products.get(o.produs_id)!.push(o);
  }
  const ptCache = new Map<string, number | null>();
  const pt = (name: string) => { if (!ptCache.has(name)) ptCache.set(name, lossFor(name, losses)); return ptCache.get(name)!; };
  return [...groups.entries()].map(([client, products]) => {
    const list: BookProduct[] = [...products.entries()].map(([id, os]) => {
      const r = byProduct.get(id)!;
      const bucati = os.reduce((s, o) => s + (Number(o.cantitate) || 0), 0);
      const ingredients = r.ingredients.filter(i => i.kgPerBuc > 0).map(i => {
        const netKg = i.kgPerBuc * bucati, p = pt(i.nume);
        return { ...i, netKg: round(netKg), ptPct: p, brutKg: round(netKg * (1 + (p ?? 0) / 100)) };
      });
      return {
        produsId: id, recipeId: r.recipeId, produs: r.produs, bucBax: mostCommon(os.map(unitsOf)), bucati, ingredients,
        netKg: round(ingredients.reduce((s, i) => s + i.netKg, 0)), brutKg: round(ingredients.reduce((s, i) => s + i.brutKg, 0)),
        stores: [...new Set(os.map(o => String(o.magazin ?? '').trim()).filter(Boolean))].sort(),
      };
    }).sort((a, b) => a.produs.localeCompare(b.produs, 'ro'));
    const materials = new Map<string, { nume: string; netKg: number; ptPct: number | null; brutKg: number }>();
    list.forEach(p => p.ingredients.forEach(i => {
      const k = plain(i.nume);
      const m = materials.get(k) ?? { nume: i.nume, netKg: 0, ptPct: i.ptPct, brutKg: 0 };
      m.netKg = round(m.netKg + i.netKg); m.brutKg = round(m.brutKg + i.brutKg);
      materials.set(k, m);
    }));
    return {
      client, products: list,
      bucati: list.reduce((s, p) => s + p.bucati, 0),
      netKg: round(list.reduce((s, p) => s + p.netKg, 0)), brutKg: round(list.reduce((s, p) => s + p.brutKg, 0)),
      materials: [...materials.values()].sort((a, b) => b.netKg - a.netKg),
    };
  }).sort((a, b) => b.bucati - a.bucati || a.client.localeCompare(b.client, 'ro'));
}

/** Grams written in a product name ("LUPINO 150G LIDL" → 150, "1KG" → 1000). */
export function gramsInName(name: unknown): number | null {
  const m = plain(name).match(/(?:^| )(\d+)\s*(KG|GR|G)(?= |$)/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === 'KG' ? 1000 : 1);
}

const STOP = new Set(['SALATA', 'MIX', 'MIXT', 'MIXURI', 'SALATE', 'DE', 'CU', 'SI', 'BUC', 'BAX', 'G', 'GR', 'KG']);

/**
 * Product named in an uploaded order (name without weight, optional weight) → the mixed recipe.
 * Every significant word must appear in the recipe name, and when a weight is given the recipe
 * name must carry the same weight; a client word (e.g. LIDL) only breaks ties.
 */
export function matchMixedProduct(name: string, gramaj: number | null | undefined, recipes: MixedRecipe[], clientHint?: string | null) {
  const all = plain(name).split(' ').filter(w => w && !/^\d/.test(w));
  const words = all.filter(w => !STOP.has(w)).length ? all.filter(w => !STOP.has(w)) : all;
  if (!words.length) return null;
  const hint = plain(clientHint).split(' ')[0] || '';
  let best: MixedRecipe | null = null, bestScore = 0;
  for (const r of recipes) {
    const n = plain(r.produs), toks = n.split(' ');
    const has = (w: string) => toks.some(t => t === w || (w.length >= 4 && t.length >= 4 && (t.startsWith(w) || w.startsWith(t))));
    if (!words.every(has)) continue;
    const g = gramsInName(n);
    let score = 1;
    if (gramaj) { if (g === Number(gramaj)) score += 1; else if (g != null) continue; }
    if (hint && toks.includes(hint)) score += 0.3;
    score -= toks.length * 0.001;
    if (score > bestScore) { best = r; bestScore = score; }
  }
  return best;
}

export type ManualLine = { id: string; magazin: string; produsId: string; cantitate: number; unit: 'buc' | 'bax'; bucBax?: string | null; sursa?: string | null };
export type CartonDef = { produs_id: string; denumire: string; components: { produs_id: string; nume: string; units: number }[] };

/** Pieces in a case written as "6" or "6+2". */
export const caseUnits = (v: unknown) => {
  const parts = String(v ?? '').split('+').map(x => Number(x.trim()));
  return parts.length && parts.every(n => Number.isInteger(n) && n > 0) ? parts.reduce((a, b) => a + b, 0) : null;
};

/**
 * Manual needs (store + product + quantity in buc or bax) → orders for the Rețetar.
 * Mixed cartons split into their component products (whole cartons only); a product in bax
 * needs its pieces per case. Lines that cannot be converted are returned as problems, never guessed.
 */
export function manualOrders(lines: ManualLine[], cartons: CartonDef[]) {
  const orders: RecipeBookOrder[] = [];
  const problems: { id: string; message: string }[] = [];
  for (const l of lines) {
    const qty = Number(l.cantitate) || 0;
    if (!l.magazin.trim() || !l.produsId || qty <= 0) { problems.push({ id: l.id, message: 'Alege magazinul, produsul și cantitatea.' }); continue; }
    const carton = cartons.find(c => c.produs_id === l.produsId);
    if (carton) {
      const total = carton.components.reduce((s, c) => s + c.units, 0);
      const boxes = l.unit === 'bax' ? qty : qty / total;
      if (!Number.isInteger(boxes)) { problems.push({ id: l.id, message: `${qty} buc nu înseamnă baxuri complete (${total} buc/bax).` }); continue; }
      carton.components.forEach(c => orders.push({ magazin: l.magazin, produs_id: c.produs_id, cantitate: boxes * c.units, baxare: carton.components.map(x => x.units).join('+') }));
      continue;
    }
    if (l.unit === 'bax') {
      const per = caseUnits(l.bucBax);
      if (!per) { problems.push({ id: l.id, message: 'Completează câte bucăți are un bax.' }); continue; }
      orders.push({ magazin: l.magazin, produs_id: l.produsId, cantitate: qty * per, baxare: String(l.bucBax) });
    } else orders.push({ magazin: l.magazin, produs_id: l.produsId, cantitate: qty, baxare: l.bucBax ?? null });
  }
  return { orders, problems };
}
