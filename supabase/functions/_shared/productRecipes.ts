export type RecipeProduct = { id: string; nume: string; unitate_masura?: string };
export type RecipeIngredient = { ingredient_id: string; cantitate_necesara: number; unitate_masura: string; observatii?: string | null };
export type InheritanceRecipe = { id: string; produs_id: string; activa: boolean; versiune: number; productie_retete_ingrediente: RecipeIngredient[] };

// Remove only known retailer/channel suffixes, never arbitrary composition words.
export function productIdentity(name: string) {
  const text = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\bmega\s+image\b/g, '').replace(/\b(?:mc|pg|lidl|auchan|carrefour|penny|kaufland|gastro|horeca)\b/g, '')
    .replace(/^\s*salata\s+/, '').replace(/\s+/g, ' ').trim();
  const match = text.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|gr|g)\b/) ?? text.match(/\b(\d+(?:[.,]\d+)?)\b/);
  if (!match || match.index === undefined) return null;
  const grams = Number(match[1].replace(',', '.')) * (match[2] === 'kg' ? 1000 : 1);
  const family = (text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length))
    .replace(/[^a-z0-9]+/g, ' ').trim();
  return grams > 0 && family ? { family, grams } : null;
}

export function inheritancePlan(target: RecipeProduct, products: RecipeProduct[], recipes: InheritanceRecipe[], groups: Record<string, string>) {
  const identity = productIdentity(target.nume);
  if (!identity) return { recipe: null, group: null, reason: 'Gramaj sau familie nerecunoscută' };
  const siblings = products.filter(p => p.id !== target.id && productIdentity(p.nume)?.family === identity.family);
  const sameWeight = siblings.filter(p => productIdentity(p.nume)?.grams === identity.grams);
  const groupNames = new Set(sameWeight.map(p => groups[p.id]).filter(Boolean));
  for (const group of Object.values(groups)) {
    const g = productIdentity(group);
    if (g?.family === identity.family && g.grams === identity.grams) groupNames.add(group);
  }
  const group = !groups[target.id] && groupNames.size === 1 ? [...groupNames][0] : null;
  if (recipes.some(r => r.produs_id === target.id && r.activa && r.productie_retete_ingrediente.length)) return { recipe: null, group, reason: 'Rețetă existentă' };
  const candidates = siblings.flatMap(p => {
    const source = recipes.filter(r => r.produs_id === p.id && r.activa && r.productie_retete_ingrediente.length)
      .sort((a, b) => b.versiune - a.versiune)[0];
    const sourceIdentity = productIdentity(p.nume);
    return source && sourceIdentity ? [{ product: p, source, grams: sourceIdentity.grams }] : [];
  });
  candidates.sort((a, b) => (a.grams === identity.grams ? 0 : 1) - (b.grams === identity.grams ? 0 : 1) || Math.abs(a.grams - identity.grams) - Math.abs(b.grams - identity.grams) || a.product.id.localeCompare(b.product.id));
  const chosen = candidates[0];
  if (!chosen) return { recipe: null, group, reason: 'Nu există rețetă compatibilă' };
  // Conflicting compositions at the selected source weight need a human, not guessing.
  const signature = (r: InheritanceRecipe) => r.productie_retete_ingrediente.map(i => `${i.ingredient_id}:${i.unitate_masura}:${Number(i.cantitate_necesara).toFixed(3)}`).sort().join('|');
  if (candidates.filter(c => c.grams === chosen.grams).some(c => signature(c.source) !== signature(chosen.source))) return { recipe: null, group, reason: 'Rețete diferite pentru aceeași familie; verificare manuală' };
  const ingredients = chosen.source.productie_retete_ingrediente.map(i => ({
    ingredient_id: i.ingredient_id,
    cantitate_necesara: Math.round(Number(i.cantitate_necesara) * identity.grams / chosen.grams * 1000) / 1000,
    unitate_masura: i.unitate_masura, observatii: i.observatii ?? '',
  }));
  if (ingredients.some(i => !Number.isFinite(i.cantitate_necesara) || i.cantitate_necesara <= 0)) return { recipe: null, group, reason: 'Cantități sursă invalide' };
  return { recipe: { sourceName: chosen.product.nume, ingredients }, group, reason: null };
}

export async function readAll(client: any, table: string, select = '*') {
  const rows: any[] = [];
  while (true) {
    const { data, error } = await client.from(table).select(select).order(table === 'productie_grupare_ambalare' ? 'produs_id' : 'id').range(rows.length, rows.length + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function loadInheritanceCatalog(operational: any, cloud: any) {
  const [products, recipes, groupRows] = await Promise.all([
    readAll(operational, 'productie_produse'),
    readAll(operational, 'productie_retete', '*,productie_retete_ingrediente(*)'),
    readAll(cloud, 'productie_grupare_ambalare'),
  ]);
  return { products, recipes, groups: Object.fromEntries(groupRows.map(r => [r.produs_id, r.grup_nume])) as Record<string, string> };
}

export async function applyInheritance(operational: any, cloud: any, target: RecipeProduct, catalog: Awaited<ReturnType<typeof loadInheritanceCatalog>>) {
  const plan = inheritancePlan(target, catalog.products, catalog.recipes, catalog.groups);
  let recipeCreated = false;
  if (plan.recipe) {
    // Recheck persistence before writing: retries must never overwrite an existing recipe.
    const { data: current, error: lookupError } = await operational.from('productie_retete').select('id,activa,productie_retete_ingrediente(id)').eq('produs_id', target.id);
    if (lookupError) throw lookupError;
    if (!(current ?? []).some((r: any) => r.activa && r.productie_retete_ingrediente.length)) {
      const { data: parent, error } = await operational.from('productie_retete').insert({ produs_id: target.id, nume_reteta: `Rețetă ${target.nume}`, descriere: `Adaptată din ${plan.recipe.sourceName}`, activa: true }).select().single();
      if (error) throw error;
      const { error: ingredientError } = await operational.from('productie_retete_ingrediente').insert(plan.recipe.ingredients.map(i => ({ ...i, reteta_id: parent.id })));
      if (ingredientError) {
        await operational.from('productie_retete').delete().eq('id', parent.id);
        throw ingredientError;
      }
      catalog.recipes.push({ ...parent, productie_retete_ingrediente: plan.recipe.ingredients });
      recipeCreated = true;
    }
  }
  if (plan.group) {
    const { error } = await cloud.from('productie_grupare_ambalare').upsert({ produs_id: target.id, grup_nume: plan.group }, { onConflict: 'produs_id', ignoreDuplicates: true });
    if (error) throw error;
    catalog.groups[target.id] = plan.group;
  }
  if (!catalog.products.some(p => p.id === target.id)) catalog.products.push(target);
  return { recipeCreated, grouped: Boolean(plan.group), reason: plan.reason };
}