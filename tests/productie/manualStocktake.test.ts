import { expect, test } from 'bun:test';
import { buildCount, clearedStockPatch } from '../../src/lib/productie/manualStocktake';
const row = (productId: string, units: string, cases: string) => ({ id: 'row', productId, units, cases });
test('different packaging rows of the same group sum: 15×6 + 61×4 = 334', () => {
  expect(buildCount([row('rosemary', '6', '15'), row('rosemary', '4', '61')], new Set(['rosemary']), '2026-10-29')[0]?.cantitate_surplus).toBe(334);
});
test('blank and zero counted groups do not become positive stock', () => {
  expect(buildCount([row('a', '', ''), row('b', '4', '0')], new Set(['a', 'b']), '2026-10-29')).toEqual([]);
});
test('new groups and repeated rows are accepted and kept separate from other groups', () => {
  const result = buildCount([row('a', '4', '2'), row('b', '6', '3')], new Set(['a', 'b']), '2026-10-28');
  expect(result.map(item => item.cantitate_surplus)).toEqual([8, 18]);
  expect(result.every(item => item.comanda_originala_id === null)).toBe(true);
});
test('invalid packaging, partial input and unknown groups block replacement', () => {
  for (const invalid of [row('a', '0', '2'), row('a', '4', '-1'), row('a', '4', '1.5'), row('a', '', '2'), row('unknown', '4', '2')]) expect(() => buildCount([invalid], new Set(['a']), '2026-10-29')).toThrow();
});
test('old lots are zeroed unavailable rather than deleted or returned to inventory', () => {
  expect(clearedStockPatch().cantitate_surplus).toBe(0);
  expect(clearedStockPatch().status).toBe('redistribuit');
});