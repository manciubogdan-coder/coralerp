import { expect, test } from 'bun:test';
import { horecaProductNeeds, planHorecaFinish, type HorecaFinishOrder } from '../../src/lib/productie/horecaFinish';

const order = (id: string, product: string, quantity: number, made = 0): HorecaFinishOrder => ({
  id, produs_id: product, sessionId: `session-${id}`,
  cantitate: quantity, cantitate_reala_produsa: made,
});

test('HoReCa partial stop closes untouched sessions without marking missing products as produced', () => {
  const result = planHorecaFinish([
    order('client-1-spanac', 'spanac', 10),
    order('client-2-spanac', 'spanac', 20),
    order('client-1-busuioc', 'busuioc', 15),
  ], new Map([['spanac', 12]]));
  expect(result).toEqual([
    { id: 'session-client-1-spanac', comanda_id: 'client-1-spanac', cantitate_produsa: 10, status: 'finalizata', remaining: 0 },
    { id: 'session-client-2-spanac', comanda_id: 'client-2-spanac', cantitate_produsa: 2, status: 'partial', remaining: 18 },
    { id: 'session-client-1-busuioc', comanda_id: 'client-1-busuioc', cantitate_produsa: 0, status: 'partial', remaining: 15 },
  ]);
});

test('resuming a partially worked HoReCa order requires only the unproduced remainder', () => {
  const orders = [order('a', 'spanac', 20, 2), order('b', 'busuioc', 15)];
  expect([...horecaProductNeeds(orders)]).toEqual([['spanac', 18], ['busuioc', 15]]);
  const result = planHorecaFinish(orders, horecaProductNeeds(orders));
  expect(result.map(r => r.cantitate_produsa)).toEqual([18, 15]);
  expect(result.map(r => r.status)).toEqual(['finalizata', 'finalizata']);
});

test('switching work with zero production leaves all demand available for resumption', () => {
  const result = planHorecaFinish([order('a', 'spanac', 20), order('b', 'busuioc', 15)], new Map());
  expect(result.map(r => [r.cantitate_produsa, r.status, r.remaining])).toEqual([
    [0, 'partial', 20], [0, 'partial', 15],
  ]);
});

test('product quantities remain separate and surplus cannot cover another product', () => {
  const result = planHorecaFinish([order('a', 'spanac', 20), order('b', 'busuioc', 15)], new Map([['spanac', 30]]));
  expect(result.map(r => [r.cantitate_produsa, r.remaining])).toEqual([[30, 0], [0, 15]]);
});

test('accepted demand changes recalculate the remainder without erasing previously made goods', () => {
  const increased = order('a', 'spanac', 600, 200);
  const reduced = order('b', 'busuioc', 400, 200);
  expect([...horecaProductNeeds([increased, reduced])]).toEqual([['spanac', 400], ['busuioc', 200]]);
  expect(increased.cantitate_reala_produsa).toBe(200);
  expect(reduced.cantitate_reala_produsa).toBe(200);
});

test('allocated stock reduces the HoReCa remainder once, without being reported as production', () => {
  const row = { ...order('a', 'spanac', 20, 2), cantitate_din_restock: 5 };
  const result = planHorecaFinish([row], horecaProductNeeds([row]));
  expect(result[0]).toMatchObject({ cantitate_produsa: 13, remaining: 0, status: 'finalizata' });
});

test('invalid quantities, foreign products and duplicate sessions are rejected before writes', () => {
  const row = order('a', 'spanac', 20);
  for (const quantity of [NaN, Infinity, -1]) {
    expect(() => planHorecaFinish([row], new Map([['spanac', quantity]]))).toThrow();
  }
  expect(() => planHorecaFinish([row], new Map([['busuioc', 2]]))).toThrow();
  expect(() => planHorecaFinish([row, row], new Map())).toThrow();
});