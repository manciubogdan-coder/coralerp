import { expect, test } from 'bun:test';
import { buildRecipeBook, mainClient, type MixedRecipe } from '../../src/lib/productie/recipeBook';

const lupino: MixedRecipe = { produsId: 'lupino', produs: 'Lupino 200 g LIDL', ingredients: [
  { nume: 'Morcovi', kgPerBuc: 0.04 }, { nume: 'Varza', kgPerBuc: 0.04 }, { nume: 'Pan Di Zuchero', kgPerBuc: 0.1 }, { nume: 'Radichio Rosso', kgPerBuc: 0.02 },
] };
const rucola: MixedRecipe = { produsId: 'rucola', produs: 'Rucola 125 g', ingredients: [{ nume: 'Rucola', kgPerBuc: 0.125 }] };
const losses = [{ name: 'Morcovi', pt_percent: 5 }, { name: 'Varza', pt_percent: 35 }, { name: 'Pan di zuchero', pt_percent: 30 }, { name: 'Radichio rosso', pt_percent: 30 }];
const nick: Record<string, string> = { 'OSCAR FOOD SRL': 'CATERIN', 'CAYA DELIVERY FOOD S.R.L.': 'CATERIN' };
const clientOf = (o: { magazin: string | null }) => mainClient(o.magazin, nick[o.magazin ?? '']);

test('all Lidl stores are one client: Aricești 252 + Fundeni 180 Lupino = 432 pieces', () => {
  const book = buildRecipeBook([
    { magazin: 'LIDL DISCOUNT SRL - ARICESTI', produs_id: 'lupino', cantitate: 252, baxare: '6' },
    { magazin: 'LIDL DISCOUNT SRL - FUNDENI', produs_id: 'lupino', cantitate: 180, baxare: '6' },
  ], [lupino], losses, clientOf);
  expect(book.map(c => c.client)).toEqual(['LIDL DISCOUNT SRL']);
  expect(book[0].products[0].bucati).toBe(432);
  expect(book[0].products[0].bucBax).toBe('6');
});

test('Lupino 432 pieces: net 17.28/17.28/43.2/8.64 kg = 86.4 kg, gross with losses 108.864 kg', () => {
  const [lidl] = buildRecipeBook([{ magazin: 'LIDL DISCOUNT SRL - ROMAN', produs_id: 'lupino', cantitate: 432 }], [lupino], losses, clientOf);
  const p = lidl.products[0];
  expect(p.ingredients.map(i => i.netKg)).toEqual([17.28, 17.28, 43.2, 8.64]);
  expect(p.ingredients.map(i => i.brutKg)).toEqual([18.144, 23.328, 56.16, 11.232]);
  expect(p.netKg).toBe(86.4);
  expect(p.brutKg).toBe(108.864);
});

test('HoReCa clients with the same nickname are totalled under that nickname', () => {
  const book = buildRecipeBook([
    { magazin: 'OSCAR FOOD SRL', produs_id: 'lupino', cantitate: 4 },
    { magazin: 'CAYA DELIVERY FOOD S.R.L.', produs_id: 'lupino', cantitate: 30 },
  ], [lupino], losses, clientOf);
  expect(book.map(c => [c.client, c.bucati])).toEqual([['CATERIN', 34]]);
});

test('single-ingredient products and advance production stay out of the recipe book', () => {
  const book = buildRecipeBook([
    { magazin: 'LIDL DISCOUNT SRL - ROMAN', produs_id: 'rucola', cantitate: 500 },
    { magazin: 'PRODUCTIE_AVANS', produs_id: 'lupino', cantitate: 100, tip_comanda: 'PRODUCTIE_AVANS' },
  ], [lupino, rucola], losses, clientOf);
  expect(book).toEqual([]);
});

import { manualOrders, matchMixedProduct } from '../../src/lib/productie/recipeBook';

const lupino150: MixedRecipe = { produsId: 'lupino150', produs: 'Lupino 150 g', ingredients: lupino.ingredients };
const amorino: MixedRecipe = { produsId: 'amorino', produs: 'Amorino 200 g LIDL', ingredients: lupino.ingredients };

test('uploaded line "LUPINO" 200 g for LIDL matches Lupino 200 g LIDL, not the 150 g recipe', () => {
  expect(matchMixedProduct('LUPINO', 200, [lupino150, lupino, amorino], 'LIDL')?.produsId).toBe('lupino');
  expect(matchMixedProduct('LUPINO', 150, [lupino150, lupino, amorino], 'LIDL')?.produsId).toBe('lupino150');
  expect(matchMixedProduct('SALATA PRIMAVERA', 120, [lupino, amorino], null)).toBeNull();
});

const cartons = [{ produs_id: 'lupamo', denumire: 'Mix salate Lupino/Amorino', components: [{ produs_id: 'lupino', nume: 'Lupino', units: 6 }, { produs_id: 'amorino', nume: 'Amorino', units: 2 }] }];

test('manual 10 bax Lupino/Amorino 6+2 → 60 Lupino + 20 Amorino pieces', () => {
  const { orders, problems } = manualOrders([{ id: '1', magazin: 'LIDL DISCOUNT SRL - ROMAN', produsId: 'lupamo', cantitate: 10, unit: 'bax' }], cartons);
  expect(problems).toEqual([]);
  expect(orders.map(o => [o.produs_id, o.cantitate])).toEqual([['lupino', 60], ['amorino', 20]]);
});

test('manual 12 bax of a 6 buc/bax product → 72 pieces; bax without pieces per case is refused', () => {
  const { orders, problems } = manualOrders([
    { id: '1', magazin: 'MEGA IMAGE', produsId: 'lupino', cantitate: 12, unit: 'bax', bucBax: '6' },
    { id: '2', magazin: 'MEGA IMAGE', produsId: 'lupino', cantitate: 5, unit: 'bax', bucBax: '' },
    { id: '3', magazin: 'LIDL', produsId: 'lupamo', cantitate: 12, unit: 'buc' },
  ], cartons);
  expect(orders.map(o => o.cantitate)).toEqual([72]);
  expect(problems.map(p => p.id)).toEqual(['2', '3']);
});
