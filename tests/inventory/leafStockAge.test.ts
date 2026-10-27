import { expect, test } from 'bun:test';
import { agedLeafLots, isLeafSalad, leafStockAgeDays } from '../../src/lib/leafStockAge';
const now = new Date('2026-10-27T05:38:00Z');
const lot = { id: 'old', name: 'Baby Spanac', quantity: 12.375, unit: 'kg', lot_number: 'LOT-23', receipt_date: '2026-10-23' };

test('leaves are red only after more than three days, not at exactly three days', () => {
  expect(leafStockAgeDays('2026-10-24', now)).toBe(3);
  expect(agedLeafLots([{ ...lot, receipt_date: '2026-10-24' }], now)).toEqual([]);
  expect(agedLeafLots([lot], now)[0]?.days).toBe(4);
});
test('affected quantity and original lots survive aggregation without counting fresh or empty lots', () => {
  const lots = agedLeafLots([{ ...lot, isHeader: true, quantity: 999, items: [lot, { ...lot, id: 'fresh', receipt_date: '2026-10-27', quantity: 20 }, { ...lot, id: 'empty', quantity: 0 }] }], now);
  expect(lots.map(({ item }) => [item.lot_number, item.quantity])).toEqual([['LOT-23', 12.375]]);
});
test('leaf salad matching excludes herbs and unrelated materials', () => {
  for (const name of ['Rucola', 'Salată verde', 'Valeriana', 'Mizuna red', 'Tatsoi', 'Baby leaf', 'Bulls Blood', 'Latuga Bowl']) expect(isLeafSalad(name)).toBe(true);
  for (const name of ['Busuioc', 'Mentă', 'Mărar', 'Etichete', 'Caserole']) expect(isLeafSalad(name)).toBe(false);
});
test('missing dates and future receipts are not invented as old stock; age uses Bucharest day', () => {
  expect(agedLeafLots([{ ...lot, receipt_date: undefined }, { ...lot, receipt_date: '2026-10-28' }], now)).toEqual([]);
  expect(leafStockAgeDays('2026-10-23T21:30:00Z', now)).toBe(3);
});