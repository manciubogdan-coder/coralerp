import { expect, test } from 'bun:test';
import { aggregateSnapshots, businessDay, dayBounds, historicalCommitments, reconcileProjection, sessionUsage, stockVariance, transferStockQuantity } from '../../src/lib/forecastReconciliation';

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

test('transfer consumes net goods, not gross goods plus transport packaging', () => {
  expect(transferStockQuantity({ quantity: 1415.5, net_quantity: 1000, unit: 'kg' })).toBe(1000);
  expect(transferStockQuantity({ quantity: 100, net_quantity: 0, unit: 'kg' })).toBe(0);
  expect(transferStockQuantity({ quantity: 2000, unit: 'g' })).toBe(2);
});
test('snapshot quantities aggregate all matching lots and convert units, without inventing zeros', () => {
  const totals = aggregateSnapshots([
    { name: 'Rucola', quantity: 2000, unit: 'kg', snapshot_date: '2026-10-27' },
    { name: 'Rucola', quantity: 1000000, unit: 'g', snapshot_date: '2026-10-27' },
    { name: 'Baby spanac', quantity: 0, unit: 'kg', snapshot_date: '2026-10-28' },
  ], row => row.name);
  expect(totals.Rucola['2026-10-27']).toBe(3000);
  expect(totals.Rucola['2026-10-28']).toBeUndefined();
  expect(totals['Baby spanac']['2026-10-28']).toBe(0);
});
test('warehouse returns restore balance without counting production consumption again', () => {
  const result = reconcileProjection({ dates: ['2026-10-27'], today: '2026-11-02', anchor: 1855,
    snapshots: { '2026-10-27': 3000, '2026-10-28': 2417 }, ordered: { '2026-10-27': 1540 },
    received: { '2026-10-27': 293.5 }, returned: { '2026-10-27': 123.5 },
    outbound: { '2026-10-27': 1000 }, demand: [1415.5] });
  expect(result[0].closing).toBe(2417);
  expect(result[0].residual).toBe(0);
});
test('today includes receipts already arrived and only outstanding supplier deliveries', () => {
  const result = reconcileProjection({ dates: ['2026-11-02'], today: '2026-11-02', anchor: 1855,
    snapshots: { '2026-11-02': 1855 }, ordered: { '2026-11-02': 200 },
    received: { '2026-11-02': 800 }, outbound: {}, demand: [1000] });
  expect(result[0].closing).toBe(1855);
});
test('explainStockGap splits the missing rucola stock into exact causes', async () => {
  const { explainStockGap } = await import('../../src/lib/forecastReconciliation');
  const r = explainStockGap({
    dates: ['2026-10-26', '2026-10-27', '2026-10-28'], today: '2026-10-28',
    snapshots: { '2026-10-26': 1500, '2026-10-27': 1200, '2026-10-28': 1855 },
    ordered: { '2026-10-26': 1100, '2026-10-27': 1100 }, received: { '2026-10-26': 372, '2026-10-27': 1132 },
    returned: { '2026-10-27': 210 }, outbound: { '2026-10-26': 658.5, '2026-10-27': 700 },
    planned: { '2026-10-26': 400, '2026-10-27': 400 }, advances: { '2026-10-26': 40 }, otherDays: {}, qualityLoss: {},
  });
  expect(r.expected).toBe(2900);
  expect(r.actual).toBe(1855);
  expect(r.receivedVsOrdered).toBe(-696);
  expect(r.consumedOverPlan).toBe(558.5);
  expect(r.unexplained).toBe(-0.5);
  expect(r.gap).toBe(-1045);
  expect(r.receivedVsOrdered + r.returned - r.consumedOverPlan + (r.unexplained ?? 0)).toBeCloseTo(r.gap!, 6);
});
