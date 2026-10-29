import { expect, test } from 'bun:test';
import { countedQuantity, stocktakePayloads, stocktakeRows } from '../../src/lib/productie/stocktakeOctober28';

const totals = [334,18,434,44,122,8,64,30,40,108,54,20,534,78,60,138,30,48,16,1200,114,54,132,16,32,24,30];
stocktakeRows.forEach((row, index) => test(`${row[0]} equals the handwritten boxes multiplied by units`, () => {
  expect(countedQuantity(index)).toBe(totals[index]);
}));
test('all 27 products total 3782 units with the sheet date and no origin allocation', () => {
  const payload = stocktakePayloads(stocktakeRows.map((_, index) => `product-${index}`));
  expect(payload.length).toBe(27);
  expect(payload.reduce((sum, row) => sum + row.cantitate_surplus, 0)).toBe(3782);
  expect(payload.every(row => row.data_productie === '2026-10-28' && row.comanda_originala_id === null && row.status === 'disponibil')).toBe(true);
  expect(new Set(payload.map(row => row.id)).size).toBe(27);
});
test('missing or duplicate product choices cannot be imported', () => {
  expect(() => stocktakePayloads([])).toThrow();
  expect(() => stocktakePayloads(stocktakeRows.map(() => 'same'))).toThrow();
});