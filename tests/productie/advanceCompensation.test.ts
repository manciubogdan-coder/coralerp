import { expect, test } from 'bun:test';
import { canCompensateAdvance } from '../../src/lib/productie/advanceCompensation';

const babySpanacAdvance = { data_productie: '2026-10-27', created_at: '2026-10-27T03:50:23.962727+00:00' };

test('Baby spanac 100 MI: existing firm demand does not cancel a newly entered advance', () => {
  expect(canCompensateAdvance(babySpanacAdvance, { data_productie: '2026-10-27', created_at: '2026-10-26T15:00:00Z' })).toBe(false);
  expect(canCompensateAdvance(babySpanacAdvance, babySpanacAdvance)).toBe(false);
});

test('later firm orders still compensate advance within the same production day', () => {
  expect(canCompensateAdvance(babySpanacAdvance, { data_productie: '2026-10-27', created_at: '2026-10-27T04:00:00Z' })).toBe(true);
});

test('future production days never reduce today’s advance', () => {
  expect(canCompensateAdvance(babySpanacAdvance, { data_productie: '2026-10-28', created_at: '2026-10-27T04:00:00Z' })).toBe(false);
});