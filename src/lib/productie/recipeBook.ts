/**
 * Rețetar: mixed-product recipes multiplied by the Senior orders already received,
 * grouped by main client (all Lidl stores together, HoReCa by client nickname).
 */
export type RecipeIngredient = { nume: string; kgPerBuc: number };
export type MixedRecipe = { produsId: string; produs: string; ingredients: RecipeIngredient[] };
export type RecipeBookOrder = { magazin: string | null; produs_id: string | null; cantitate: number; baxare?: string | null; tip_comanda?: string | null };
export type LossRule = { name: string; pt_percent: number | null };

export type BookIngredient = RecipeIngredient & { netKg: number; ptPct: number | null; brutKg: number };
export type BookProduct = { produsId: string; produs: string; bucBax: string | null; bucati: number; ingredients: BookIngredient[]; netKg: number; brutKg: number; stores: string[] };
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
        produsId: id, produs: r.produs, bucBax: mostCommon(os.map(unitsOf)), bucati, ingredients,
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
