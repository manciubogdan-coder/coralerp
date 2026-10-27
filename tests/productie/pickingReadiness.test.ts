import { expect, test } from 'bun:test';
import { matchesPickingDay, pickingDay, pickingReadiness } from '../../src/lib/productie/pickingReadiness';
import { compensateAdvanceQuantities } from '../../src/lib/productie/advanceCompensation';

test('Picking recognizes completed production even when the restock record is absent', () => {
  expect(pickingReadiness(1000, 1000, 0, 0)).toEqual({ realized: 1000, ready: true });
});
test('work sessions and own pool cannot double-count the same goods', () => {
  expect(pickingReadiness(1000, 600, 0, 600)).toEqual({ realized: 600, ready: false });
});
test('Picking credits the same-day Rucola advance once, but never tomorrow', () => {
  const advance = { data_productie: '2026-10-27', created_at: '2026-10-27T03:00:00Z', cantitate: 402, cantitate_reala_produsa: 402 };
  const firms = [258, 174].map(cantitate => ({ data_productie: '2026-10-27', created_at: '2026-10-26T00:00:00Z', cantitate, cantitate_reala_produsa: 0 }));
  const tomorrow = { ...firms[0], data_productie: '2026-10-28', cantitate: 1000 };
  compensateAdvanceQuantities([{ order: advance, automatic: false }], [...firms, tomorrow]);
  expect(firms.map(f => pickingReadiness(f.cantitate, f.cantitate_reala_produsa, 0, 0))).toEqual([{ realized: 258, ready: true }, { realized: 144, ready: false }]);
  expect(pickingReadiness(1000, tomorrow.cantitate_reala_produsa, 0, 0).realized).toBe(0);
});
test('today excludes older open sessions, selectable only through explicit date or overdue mode', () => {
  expect(matchesPickingDay('2026-10-26', '2026-10-27', 'zi', '2026-10-27')).toBe(false);
  expect(matchesPickingDay('2026-10-26', '2026-10-26', 'zi', '2026-10-27')).toBe(true);
  expect(matchesPickingDay('2026-10-26', '2026-10-27', 'restante', '2026-10-27')).toBe(true);
});
test('undated legacy orders use the Bucharest creation day, not UTC', () => {
  expect(pickingDay({ created_at: '2026-10-26T22:30:00Z' })).toBe('2026-10-27');
});