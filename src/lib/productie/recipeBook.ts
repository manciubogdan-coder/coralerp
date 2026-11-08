/**
 * Rețetar: mixed-product recipes multiplied by the Senior orders already received,
 * grouped by main client (all Lidl stores together, HoReCa by client nickname).
 */
export type RecipeIngredient = { nume: string; kgPerBuc: number };
export type MixedRecipe = { produsId: string; produs: string; ingredients: RecipeIngredient[]; recipeId?: string };
export type RecipeBookOrder = { magazin: string | null; punct_livrare?: string | null; produs_id: string | null; cantitate: number; baxare?: string | null; tip_comanda?: string | null };
export type LossRule = { name: string; pt_percent: number | null };

/** `origKgPerBuc`/`nota` are set only when a raw-material substitution changed the recipe for this sheet. */
export type BookIngredient = RecipeIngredient & { netKg: number; ptPct: number | null; brutKg: number; origKgPerBuc?: number; nota?: string };
export type StoreQty = { store: string; bucati: number };
export type BookProduct = { produsId: string; recipeId?: string; produs: string; bucBax: string | null; bucati: number; ingredients: BookIngredient[]; netKg: number; brutKg: number; stores: string[]; storeQty: StoreQty[] };
export type BookClient = { client: string; products: BookProduct[]; stores: string[]; bucati: number; netKg: number; brutKg: number; materials: { nume: string; netKg: number; ptPct: number | null; brutKg: number }[] };

const plain = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const spaced = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** One delivery point: the store name, plus the delivery point when it is not the default "Standard". */
export function storeLabel(o: { magazin?: string | null; punct_livrare?: string | null }) {
  const store = spaced(o.magazin), point = spaced(o.punct_livrare);
  return point && plain(point) !== 'STANDARD' && plain(point) !== plain(store) ? `${store} · ${point}` : store;
}

function storeTotals(orders: RecipeBookOrder[]): StoreQty[] {
  const m = new Map<string, number>();
  orders.forEach(o => { const s = storeLabel(o); if (s) m.set(s, (m.get(s) || 0) + (Number(o.cantitate) || 0)); });
  return [...m.entries()].map(([store, bucati]) => ({ store, bucati })).sort((a, b) => b.bucati - a.bucati || a.store.localeCompare(b.store, 'ro'));
}

/** Everything summed into one sheet, regardless of client or store. */
export const ALL_STORES = 'CENTRALIZAT — TOATE MAGAZINELE';
/** Centralized sheet when the user unticks some stores: ticked stores summed together, the unticked ones on a second sheet. */
export const PICKED_STORES = 'CENTRALIZAT — MAGAZINELE BIFATE';
export const OTHER_STORES = 'CENTRALIZAT — CELELALTE MAGAZINE';

/** Store → sheet for the centralized view; nothing unticked = one sheet with all stores. */
export function pickedStoresOf(unticked: string[]) {
  const out = new Set(unticked.map(plain).filter(Boolean));
  return (o: { magazin?: string | null; punct_livrare?: string | null }) =>
    !out.size ? ALL_STORES : out.has(plain(storeLabel(o))) ? OTHER_STORES : PICKED_STORES;
}

/** Ticked stores first, then the others. */
export const sortPicked = <T extends { client: string }>(book: T[]) =>
  [...book].sort((a, b) => Number(a.client === OTHER_STORES) - Number(b.client === OTHER_STORES));

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
        stores: [...new Set(os.map(storeLabel).filter(Boolean))].sort(),
        storeQty: storeTotals(os),
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
      stores: [...new Set(list.flatMap(p => p.stores))].sort(),
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

// ---------- Stock check: will the raw material in the warehouse cover these sheets? ----------

export type StockLine = { name: string; kg: number };
export type StockCheckRow = {
  key: string; nume: string; needKg: number; stockKg: number; leftKg: number;
  /** Gross kg the same day's other orders (single-ingredient products, filtered-out lines) also need. */
  otherKg: number; leftAfterOtherKg: number; stockNames: string[];
  status: 'short' | 'tight' | 'ok';
};
export type StoreShortage = { sheet: string; store: string; missing: { nume: string; needKg: number; coveredKg: number; shortKg: number }[] };

/** Warehouse stock for one ingredient: lots with the same name, else lots whose name contains it (as in the material balance). */
export function stockFor(ingredient: string, stock: StockLine[]) {
  const k = plain(ingredient);
  let lines = stock.filter(s => plain(s.name) === k);
  if (!lines.length && k) lines = stock.filter(s => plain(s.name).includes(k));
  return { kg: round(lines.reduce((s, l) => s + (Number(l.kg) || 0), 0)), names: [...new Set(lines.map(l => spaced(l.name)))].sort() };
}

/** Gross raw material (kg, with PT %) needed by any orders, single-ingredient products included. */
export function grossNeeds(orders: RecipeBookOrder[], recipes: MixedRecipe[], losses: LossRule[]) {
  const byProduct = new Map(recipes.map(r => [r.produsId, r]));
  const out = new Map<string, number>();
  for (const o of orders) {
    const qty = Number(o.cantitate) || 0, r = o.produs_id ? byProduct.get(o.produs_id) : undefined;
    if (qty <= 0 || !r) continue;
    if (o.tip_comanda === 'PRODUCTIE_AVANS' || o.tip_comanda === 'REAMBALARE' || o.magazin === 'REAMBALARE') continue;
    r.ingredients.filter(i => i.kgPerBuc > 0).forEach(i => {
      const k = plain(i.nume);
      out.set(k, (out.get(k) || 0) + i.kgPerBuc * qty * (1 + (lossFor(i.nume, losses) ?? 0) / 100));
    });
  }
  return out;
}

/**
 * Compares the sheets' gross raw-material need with stock and hands the stock out
 * sheet by sheet (in the order shown), store by store (alphabetical), to show which stores would be left without.
 */
export function stockCheck(book: BookClient[], stock: StockLine[], other: Map<string, number> = new Map()) {
  const mats = new Map<string, { nume: string; needKg: number }>();
  book.forEach(c => c.materials.forEach(m => {
    const k = plain(m.nume), e = mats.get(k) ?? { nume: m.nume, needKg: 0 };
    e.needKg += m.brutKg; mats.set(k, e);
  }));
  const keys = new Set([...mats.keys(), ...[...other.keys()].filter(k => mats.has(k))]);
  const rows: StockCheckRow[] = [...keys].map((k): StockCheckRow => {
    const m = mats.get(k)!, s = stockFor(m.nume, stock), otherKg = round(other.get(k) || 0);
    const needKg = round(m.needKg), leftKg = round(s.kg - needKg), leftAfterOtherKg = round(leftKg - otherKg);
    return { key: k, nume: m.nume, needKg, stockKg: s.kg, leftKg, otherKg, leftAfterOtherKg, stockNames: s.names,
      status: leftKg < -0.0005 ? 'short' : leftAfterOtherKg < -0.0005 ? 'tight' : 'ok' };
  }).sort((a, b) => a.leftKg - b.leftKg || a.nume.localeCompare(b.nume, 'ro'));

  const remaining = new Map(rows.map(r => [r.key, r.stockKg]));
  const names = new Map(rows.map(r => [r.key, r.nume]));
  const shortages: StoreShortage[] = [];
  for (const c of book) {
    const need = new Map<string, Map<string, number>>();
    c.products.forEach(p => p.storeQty.forEach(sq => {
      if (!need.has(sq.store)) need.set(sq.store, new Map());
      const m = need.get(sq.store)!;
      p.ingredients.forEach(i => { const k = plain(i.nume); m.set(k, (m.get(k) || 0) + i.kgPerBuc * sq.bucati * (1 + (i.ptPct ?? 0) / 100)); });
    }));
    [...need.keys()].sort((a, b) => a.localeCompare(b, 'ro')).forEach(store => {
      const missing: StoreShortage['missing'] = [];
      need.get(store)!.forEach((kgNeed, k) => {
        const have = Math.max(0, remaining.get(k) ?? 0), covered = Math.min(have, kgNeed);
        remaining.set(k, have - covered);
        if (kgNeed - covered > 0.0005) missing.push({ nume: names.get(k) ?? k, needKg: round(kgNeed), coveredKg: round(covered), shortKg: round(kgNeed - covered) });
      });
      if (missing.length) shortages.push({ sheet: c.client, store, missing: missing.sort((a, b) => b.shortKg - a.shortKg) });
    });
  }
  return { rows, shortages };
}
