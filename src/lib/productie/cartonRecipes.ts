import { supabase } from '@/integrations/supabase/client';
import { loadMixedCartons } from '@/hooks/productie/useMixedCartons';
import { cartonRecipe, type RecipeLine } from '../../../supabase/functions/_shared/mixedCartons';

const PREFIX = 'Bax mixt:';
const sameLines = (a: RecipeLine[], b: RecipeLine[]) => a.length === b.length && a.every(x => b.some(y => y.ingredient_id === x.ingredient_id && y.unitate_masura === x.unitate_masura && Math.abs(Number(y.cantitate_necesara) - x.cantitate_necesara) < 0.0005));

async function recipesFor(ids: string[]) {
  const rows: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('productie_retete').select('id, produs_id, activa, versiune, productie_retete_ingrediente(id, ingredient_id, cantitate_necesara, unitate_masura)').in('produs_id', part).order('id').range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}

/**
 * Keeps each mixed carton's active recipe equal to Σ component units × component recipe (per carton),
 * so carton-level orders and sales needs compute real ingredients. Preserves ingredient row IDs.
 */
export async function syncCartonRecipes(componentId?: string) {
  const cartons = (await loadMixedCartons()).filter(c => c.enabled && (!componentId || c.produs_id === componentId || c.components.some(x => x.produs_id === componentId)));
  if (!cartons.length) return { updated: 0, missing: [] as string[] };
  const ids = [...new Set(cartons.flatMap(c => [c.produs_id, ...c.components.map(x => x.produs_id)]))];
  const rows = await recipesFor(ids);
  const active = new Map<string, any>();
  rows.filter(r => r.activa).sort((a, b) => b.versiune - a.versiune).forEach(r => { if (!active.has(r.produs_id)) active.set(r.produs_id, r); });
  const lines = new Map<string, RecipeLine[]>([...active].map(([id, r]) => [id, r.productie_retete_ingrediente ?? []]));
  let updated = 0; const missing: string[] = [];
  for (const carton of cartons) {
    const { ingredients, missing: lack } = cartonRecipe(carton, lines);
    if (lack.length) { missing.push(...lack); continue; }
    const name = `${PREFIX} ${carton.components.map(c => `${c.units} ${c.nume}`).join(' + ')}`;
    let recipe = active.get(carton.produs_id);
    const current: any[] = recipe?.productie_retete_ingrediente ?? [];
    if (recipe && sameLines(ingredients, current)) continue;
    if (!recipe) {
      const { data, error } = await supabase.from('productie_retete').insert({ produs_id: carton.produs_id, nume_reteta: name, descriere: 'Calculată automat din rețetele produselor componente' }).select().single();
      if (error) throw error;
      recipe = data;
    } else {
      const { error } = await supabase.from('productie_retete').update({ nume_reteta: name }).eq('id', recipe.id);
      if (error) throw error;
    }
    const remaining = [...current];
    for (const ing of ingredients) {
      const index = remaining.findIndex(r => r.ingredient_id === ing.ingredient_id);
      const row = index >= 0 ? remaining.splice(index, 1)[0] : null;
      const values = { ingredient_id: ing.ingredient_id, cantitate_necesara: ing.cantitate_necesara, unitate_masura: ing.unitate_masura, observatii: 'Bax mixt — din componente' };
      const { error } = row ? await supabase.from('productie_retete_ingrediente').update(values).eq('id', row.id) : await supabase.from('productie_retete_ingrediente').insert({ ...values, reteta_id: recipe.id });
      if (error) throw new Error(`Rețeta baxului nu s-a salvat: ${error.message}`);
    }
    for (const row of remaining) {
      const { error } = await supabase.from('productie_retete_ingrediente').delete().eq('id', row.id);
      if (error) throw new Error(`Rețeta baxului nu s-a actualizat: ${error.message}`);
    }
    updated++;
  }
  return { updated, missing };
}
