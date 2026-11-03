import { describe, test, expect } from 'bun:test';
import { expandCarton, findCarton, validateCarton, cartonReady, type MixedCarton } from '../../supabase/functions/_shared/mixedCartons';
const row: MixedCarton = { produs_id: 'mix', denumire: 'Mixuri salate Lupino/Amorino', aliases: [], enabled: true, components: [{ produs_id: 'l', nume: 'Lupino', units: 6 }, { produs_id: 'a', nume: 'Amorino', units: 2 }] };
describe('mixed commercial cartons', () => {
  test('one carton contains 6 Lupino and 2 Amorino, not one salad', () => expect(expandCarton(row, 1).map(c => c.quantity)).toEqual([6, 2]));
  test('10 cartons create 60 and 20 pieces', () => expect(expandCarton(row, 10).map(c => c.quantity)).toEqual([60, 20]));
  test('already converted 80 pieces expand once to 60 and 20', () => expect(expandCarton(row, 80, 'buc').map(c => c.quantity)).toEqual([60, 20]));
  test('partial cartons cannot silently round', () => expect(() => expandCarton(row, 9, 'buc')).toThrow());
  test('matches explicit name only, not a component or retailer variant', () => { expect(findCarton([row], null, row.denumire)?.produs_id).toBe('mix'); expect(findCarton([row], null, 'Lupino')).toBeUndefined(); expect(findCarton([row], null, `${row.denumire} alt magazin`)).toBeUndefined(); });
  test('distinct component products and no nested cartons', () => { expect(() => validateCarton({ ...row, components: [row.components[0], row.components[0]] })).toThrow(); expect(() => validateCarton(row, [{ ...row, produs_id: 'l' }])).toThrow(); });
  test('both recipes contribute separately for one carton', () => { const c = expandCarton(row, 1); const quantities = c.map(x => x.quantity); expect(quantities[0] * 0.1 + quantities[1] * 0.08).toBeCloseTo(0.76); expect(quantities[0] * 0.04 + quantities[1] * 0.05).toBeCloseTo(0.34); });
  test('carton is ready only when both components are ready', () => { expect(cartonReady(row, { l: 60, a: 18 })).toBe(9); expect(cartonReady(row, { l: 60, a: 20 })).toBe(10); });
});