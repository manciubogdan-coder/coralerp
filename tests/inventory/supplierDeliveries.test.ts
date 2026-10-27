import { expect, test } from 'bun:test';
import { supplierDeliverySchedules, supplierStockProjection } from '../../src/lib/supplierDeliveries';

const orders = [
  { product_id: 'rucola', quantity_ordered: 100, expected_delivery_date: '2026-10-27', status: 'ordered' },
  { product_id: 'rucola', quantity_ordered: 200, expected_delivery_date: '2026-10-29', status: 'pending' },
  { product_id: 'rucola', quantity_ordered: 50, expected_delivery_date: '2026-10-29', status: 'ordered' },
];

test('multiple delivery days stay separate, while same-day quantities add together', () => {
  expect(supplierDeliverySchedules(orders, '2026-10-27').get('rucola')).toEqual({
    qty: 350, perDate: { '2026-10-27': 100, '2026-10-29': 250 },
  });
});

test('stock receives each quantity only on its delivery day, never on the first ETA', () => {
  const projection = supplierStockProjection(10,
    ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'],
    { '2026-10-27': 100, '2026-10-29': 250, '2026-11-02': 999 }, [60, 60, 60, 60]);
  expect(projection.incoming).toEqual([100, 0, 250, 0]);
  expect(projection.start).toEqual([10, 50, 0, 190]);
  expect(projection.remaining).toEqual([50, 0, 190, 130]);
  expect(projection.outDate).toBe('2026-10-28');
});

test('undated, past, cancelled and delivered orders are not future arrivals', () => {
  expect(supplierDeliverySchedules([
    ...orders,
    { ...orders[0], quantity_ordered: 999, expected_delivery_date: null },
    { ...orders[0], quantity_ordered: 999, expected_delivery_date: '2026-10-26' },
    { ...orders[0], quantity_ordered: 999, status: 'delivered' },
    { ...orders[0], quantity_ordered: 999, status: 'cancelled' },
  ], '2026-10-27').get('rucola')?.qty).toBe(350);
});