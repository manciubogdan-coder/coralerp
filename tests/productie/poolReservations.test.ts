import { expect, test } from 'bun:test';
import { availablePoolLots } from '../../src/lib/productie/poolReservations';

const spinach = { id: 'today', cantitate: 1000, cantitate_din_restock: 0, magazin: 'MEGA IMAGE' };
const lot = { id: 'spinach500', cantitate_surplus: 1000, comanda_originala_id: 'today' };

test('1000 spinach 500 pieces awaiting todays Picking cannot cover tomorrow', () => {
  expect(availablePoolLots([lot], [spinach], 'tomorrow')).toEqual([]);
  expect(availablePoolLots([lot], [spinach])).toEqual([]);
  expect(lot.cantitate_surplus).toBe(1000);
});
test('originating Picking can still take its own 1000 pieces', () => {
  expect(availablePoolLots([lot], [spinach], 'today')[0].cantitate_surplus).toBe(1000);
});
test('only true surplus beyond the 1000 pieces is free across multiple lots', () => {
  const lots = [{ ...lot, id: 'first', cantitate_surplus: 600 }, { ...lot, id: 'second', cantitate_surplus: 500 }];
  expect(availablePoolLots(lots, [spinach], 'tomorrow')).toEqual([{ ...lots[1], cantitate_surplus: 100 }]);
});
test('manual restocks remain free and unknown-origin production stays protected', () => {
  expect(availablePoolLots([{ id: 'manual', cantitate_surplus: 320 }], [])[0].cantitate_surplus).toBe(320);
  expect(availablePoolLots([lot], [])).toEqual([]);
});
test('dedicated advance production remains available after explicit allocation', () => {
  expect(availablePoolLots([lot], [{ ...spinach, magazin: 'PRODUCTIE_AVANS' }], 'tomorrow')[0].cantitate_surplus).toBe(1000);
});