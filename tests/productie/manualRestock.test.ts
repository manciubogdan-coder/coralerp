import { expect, test } from 'bun:test';
import { manualRestockPayload } from '../../src/lib/productie/manualRestock';

test('restocarea manuală creează marfă disponibilă fără alocare către comandă', () => {
  expect(manualRestockPayload('rucola', 125.5, '2026-10-26')).toEqual({
    produs_id: 'rucola', cantitate_surplus: 125.5, data_productie: '2026-10-26',
    status: 'disponibil', comanda_originala_id: null,
  });
});
test('cantitatea trebuie să fie pozitivă și finită', () => {
  for (const quantity of [0, -1, NaN, Infinity]) expect(() => manualRestockPayload('rucola', quantity, '2026-10-26')).toThrow();
});
test('produsul și data validă sunt obligatorii', () => {
  expect(() => manualRestockPayload('', 10, '2026-10-26')).toThrow();
  for (const day of ['', '2026-02-30', '26-10-2026']) expect(() => manualRestockPayload('rucola', 10, day)).toThrow();
});