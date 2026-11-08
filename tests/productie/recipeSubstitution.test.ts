import { expect, test } from 'bun:test';
import { buildRecipeBook, mainClient, stockCheck, type MixedRecipe } from '../../src/lib/productie/recipeBook';
import { DEFAULT_SUBSTITUTIONS, priceFor, substituteBook, validSubstitutions } from '../../src/lib/productie/recipeSubstitution';

const lupino: MixedRecipe = { produsId: 'lupino', produs: 'Lupino 200 g LIDL', ingredients: [
  { nume: 'Morcovi', kgPerBuc: 0.04 }, { nume: 'Varza', kgPerBuc: 0.04 }, { nume: 'Pan di Zuchero', kgPerBuc: 0.1 }, { nume: 'Radichio Rosso', kgPerBuc: 0.02 },
] };
const scarolaMix: MixedRecipe = { produsId: 'mix', produs: 'Mix Scarola', ingredients: [{ nume: 'Scarola', kgPerBuc: 0.05 }, { nume: 'Rucola', kgPerBuc: 0.05 }] };
const icebergMix: MixedRecipe = { produsId: 'ice', produs: 'Mix Iceberg', ingredients: [{ nume: 'Iceberg', kgPerBuc: 0.03 }, { nume: 'Rucola', kgPerBuc: 0.05 }] };
const prices = [{ name: 'Varza', pricePerKg: 1.5 }, { name: 'Pan di Zuchero', pricePerKg: 6.18 }, { name: 'Radichio rosso', pricePerKg: 6 }, { name: 'Morcovi', pricePerKg: 2.39 }, { name: 'Rucola', pricePerKg: 9.09 }, { name: 'Scarola', pricePerKg: 4.28 }];
const run = (recipe: MixedRecipe, bucati: number, stock: { name: string; kg: number }[], other = new Map<string, number>()) => {
  const book = buildRecipeBook([{ magazin: 'LIDL DISCOUNT SRL - ROMAN', produs_id: recipe.produsId, cantitate: bucati }], [recipe], [], o => mainClient(o.magazin));
  return substituteBook(book, { stock, other, settings: DEFAULT_SUBSTITUTIONS, priceOf: n => priceFor(n, prices), ptOf: () => 0 });
};
const ing = (r: ReturnType<typeof run>, nume: string) => r.book[0].products[0].ingredients.find(i => i.nume === nume);

test('Morcovi cannot be replaced: the missing 7.28 kg go to the cheapest other ingredient, Varza', () => {
  const r = run(lupino, 432, [{ name: 'Morcovi', kg: 10 }, { name: 'Varza', kg: 100 }, { name: 'Pan di Zuchero', kg: 100 }, { name: 'Radichio Rosso', kg: 100 }]);
  expect(ing(r, 'Morcovi')!.netKg).toBe(10);
  expect(ing(r, 'Varza')!.netKg).toBe(24.56);
  expect(ing(r, 'Pan di Zuchero')!.netKg).toBe(43.2);
  expect(r.changes[0]).toMatchObject({ nume: 'Morcovi', replaced: [], supplemented: [{ nume: 'Varza', netKg: 7.28 }], uncoveredNetKg: 0 });
  expect(r.book[0].products[0].netKg).toBe(86.4);
});

test('Scarola is replaced by Pan di Zuchero first, then Rucola makes up the rest', () => {
  const r = run(scarolaMix, 100, [{ name: 'Scarola', kg: 2 }, { name: 'Pan di Zuchero', kg: 1 }, { name: 'Rucola', kg: 100 }]);
  expect(ing(r, 'Scarola')!.netKg).toBe(2);
  expect(ing(r, 'Pan di Zuchero')!.netKg).toBe(1);
  expect(ing(r, 'Rucola')!.netKg).toBe(7);
  expect(r.changes[0]).toMatchObject({ replaced: [{ nume: 'Pan di Zuchero', netKg: 1 }], supplemented: [{ nume: 'Rucola', netKg: 2 }], uncoveredNetKg: 0 });
});

test('Iceberg in mixed salads is always Pan di Zuchero, even with Iceberg in stock', () => {
  const r = run(icebergMix, 100, [{ name: 'Iceberg', kg: 100 }, { name: 'Pan di Zuchero', kg: 100 }, { name: 'Rucola', kg: 100 }]);
  expect(ing(r, 'Iceberg')!.netKg).toBe(0);
  expect(ing(r, 'Pan di Zuchero')!.netKg).toBe(3);
  expect(r.changes[0]).toMatchObject({ nume: 'Iceberg', reason: 'always' });
});

test('an ingredient grows at most 50%: what cannot be covered stays missing', () => {
  const r = run(lupino, 432, [{ name: 'Morcovi', kg: 0 }, { name: 'Varza', kg: 100 }, { name: 'Pan di Zuchero', kg: 43.2 }, { name: 'Radichio Rosso', kg: 100 }]);
  // Pan di Zuchero has no kg to spare, so only Varza (+8.64) and Radicchio (+4.32) can make up the 17.28 kg of Morcovi.
  const morcovi = r.changes.find(c => c.nume === 'Morcovi')!;
  expect(morcovi.supplemented).toEqual([{ nume: 'Varza', netKg: 8.64, pricePerKg: 1.5 }, { nume: 'Radichio Rosso', netKg: 4.32, pricePerKg: 6 }]);
  expect(morcovi.uncoveredNetKg).toBe(4.32);
});

test("a substitute only uses stock the day's other orders do not need", () => {
  const r = run(scarolaMix, 100, [{ name: 'Scarola', kg: 0 }, { name: 'Pan di Zuchero', kg: 5 }, { name: 'Rucola', kg: 100 }], new Map([['PAN DI ZUCHERO', 4]]));
  expect(ing(r, 'Pan di Zuchero')!.netKg).toBe(1);
});

test('after substitution the stock check no longer reports the replaced material as missing', () => {
  const stock = [{ name: 'Scarola', kg: 2 }, { name: 'Pan di Zuchero', kg: 1 }, { name: 'Rucola', kg: 100 }];
  const r = run(scarolaMix, 100, stock);
  expect(stockCheck(r.book, stock).rows.filter(x => x.status === 'short')).toEqual([]);
});

test('rules reject replacing an ingredient with itself and "always" without a substitute', () => {
  expect(() => validSubstitutions({ rules: [{ from: 'Scarola', to: ['scarola'] }], maxIncreasePct: 50 })).toThrow();
  expect(() => validSubstitutions({ rules: [{ from: 'Iceberg', to: [], always: true }], maxIncreasePct: 50 })).toThrow();
});
