import { expect, test } from 'bun:test';
import { restockProductIds, restockNeeded } from '../../src/lib/productie/restockGroups';

const groups = { stock: 'Mamamia150G punga', mi: 'Mamamia150G punga', bamis: 'Mamamia150G punga', other: 'Mamamia 500G' };
test('Mamamia restock is shared only within its configured group', () => {
  expect(restockProductIds('mi', groups).sort()).toEqual(['bamis', 'mi', 'stock']);
  expect(restockProductIds('unknown', groups)).toEqual(['unknown']);
});
test('320 units taken from stock reduce the 1194 requested units to 874', () => {
  const quantities = [282, 336, 318, 258];
  let stock = 320;
  const remaining = quantities.reduce((sum, cantitate) => {
    const take = Math.min(stock, cantitate); stock -= take;
    return sum + restockNeeded({ cantitate, cantitate_din_restock: take });
  }, 0);
  expect(remaining).toBe(874);
  expect(stock).toBe(0);
});
test('advance and repackaging plans do not consume stock', () => {
  for (const magazin of ['PRODUCTIE_AVANS', 'REAMBALARE']) expect(restockNeeded({ cantitate: 600, magazin })).toBe(0);
});