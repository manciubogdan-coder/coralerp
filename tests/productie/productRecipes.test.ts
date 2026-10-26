import { describe, expect, test } from 'bun:test';
import { inheritancePlan, productIdentity } from '../../supabase/functions/_shared/productRecipes';

const products = [{ id: 'source', nume: 'Mozaic 200 g' }, { id: 'same', nume: 'Mozaic 500 g' }];
const recipes = [{ id: 'recipe', produs_id: 'source', activa: true, versiune: 1, productie_retete_ingrediente: [
  { ingredient_id: 'a', cantitate_necesara: 120, unitate_masura: 'gr' },
  { ingredient_id: 'b', cantitate_necesara: 80, unitate_masura: 'gr' },
] }];
describe('Senior product recipe inheritance', () => {
  test('Mozaic 200g to 500g scales every ingredient by 2.5', () => {
    const plan = inheritancePlan({ id: 'new', nume: 'Mozaic 500 gr' }, products, recipes, {});
    expect(plan.recipe?.ingredients.map(i => i.cantitate_necesara)).toEqual([300, 200]);
  });
  test('Mozaic 500 MC joins the existing Mozaic 500 group', () => {
    expect(inheritancePlan({ id: 'new', nume: 'SALATA MOZAIC 500 GR MC' }, products, recipes, { same: 'Mozaic 500' }).group).toBe('Mozaic 500');
  });
  test('different weights never join the same packaging group', () => {
    expect(inheritancePlan({ id: 'new', nume: 'Mozaic 250 g' }, products, recipes, { same: 'Mozaic 500' }).group).toBeNull();
  });
  test('no unrelated recipe is invented', () => {
    expect(inheritancePlan({ id: 'new', nume: 'Atlantic 500 g' }, products, recipes, {}).recipe).toBeNull();
  });
  test('existing recipes are preserved', () => {
    expect(inheritancePlan(products[0], products, recipes, {}).recipe).toBeNull();
  });
  test('composition suffixes remain distinct', () => {
    expect(productIdentity('Mozaic cu rucola 500 g MC')?.family).not.toBe(productIdentity('Mozaic 500 g')?.family);
  });
});