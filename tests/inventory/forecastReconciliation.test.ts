import { expect, test } from 'bun:test';
import { businessDay, dayBounds, historicalCommitments, reconcileProjection, sessionUsage, stockVariance } from '../../src/lib/forecastReconciliation';

test('delivered historical commitments remain visible at their ETA but cancelled do not', () => {
  expect(historicalCommitments([
    { product_id: 'rucola', quantity_ordered: 3000, expected_delivery_date: '2026-10-28', status: 'delivered' },
    { product_id: 'rucola', quantity_ordered: 800, expected_delivery_date: '2026-10-28', status: 'cancelled' },
  ])).toEqual({ rucola: { '2026-10-28': 3000 } });
});
test('historical opening is dated, never todays 1855; receipts replace promises for actual balance', () => {
  const result = reconcileProjection({ dates: ['2026-10-28'], today: '2026-11-02', anchor: 1855,
    snapshots: { '2026-10-28': 3200, '2026-10-29': 1855 }, ordered: { '2026-10-28': 1000 },
    received: { '2026-10-28': 800 }, outbound: { '2026-10-28': 2000 }, demand: [999] });
  expect(result[0]).toEqual({ opening: 3200, closing: 2000, observed: 3200, incoming: 800, consumption: 2000, residual: -145 });
});
test('missing historical snapshot stays unknown, zero stock remains known', () => {
  const input = { dates: ['2026-10-28'], today: '2026-11-02', anchor: 1855,
    snapshots: {}, ordered: {}, received: {}, outbound: {}, demand: [] };
  expect(reconcileProjection(input)[0].opening).toBeNull();
  expect(reconcileProjection({ ...input, snapshots: { '2026-10-28': 0 } })[0].opening).toBe(0);
  expect(stockVariance(null, 1855, 800, 2000)).toBeNull();
});
test('future remains signed and never hides negative stock or counts delivered commitment twice', () => {
  const result = reconcileProjection({ dates: ['2026-11-02', '2026-11-03'], today: '2026-11-02', anchor: 1855,
    snapshots: { '2026-11-02': 1855 }, ordered: { '2026-11-03': 100 }, received: {}, outbound: {}, demand: [2000, 50] });
  expect(result.map(r => r.closing)).toEqual([-145, -95]);
});
test('completed sessions attribute actual produced quantity to worked day and other order day, using custom recipe', () => {
  const usage = sessionUsage([{ comanda_id: 'a', ora_sfarsit: '2026-11-01T22:30:00Z', status: 'finalizata', cantitate_produsa: 100 }],
    [{ id: 'a', data_productie: '2026-11-03', tip_comanda: 'PRODUCTIE_AVANS', productie_produse: { nume: 'Rucola', productie_retete: [{ activa: true, productie_retete_ingrediente: [{ cantitate_necesara: 99 }] }] } }],
    [{ comanda_id: 'a', ingredient_custom_nume: 'Rucola', cantitate_necesara: 70, unitate_masura: 'g' }]);
  expect(usage[0]).toMatchObject({ day: '2026-11-02', targetDay: '2026-11-03', quantity: 7, advance: true, otherDay: true });
});
test('Bucharest dates and historical DST boundaries do not use current browser offset', () => {
  expect(businessDay('2026-11-01T22:30:00Z')).toBe('2026-11-02');
  expect(dayBounds('2026-10-24').start).toBe('2026-10-23T21:00:00.000Z');
  expect(dayBounds('2026-11-02').start).toBe('2026-11-01T22:00:00.000Z');
});