import { expect, test } from 'bun:test';
import { canCompensateAdvance, compensateAdvanceQuantities } from '../../src/lib/productie/advanceCompensation';

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
  expect(canCompensateAdvance(babySpanacAdvance, { data_productie: '2026-10-28', created_at: '2026-10-27T04:00:00Z' }, true)).toBe(false);
});

test('auto-generated advance is reduced by any same-day firm order, even one imported earlier', () => {
  // Senior import poate crea comenzile ferme ÎNAINTE de generarea avansului
  // (comenzi cu dată de livrare viitoare) — avansul automat trebuie totuși redus.
  expect(canCompensateAdvance(babySpanacAdvance, { data_productie: '2026-10-27', created_at: '2026-10-26T15:00:00Z' }, true)).toBe(true);
  expect(canCompensateAdvance(babySpanacAdvance, babySpanacAdvance, true)).toBe(true);
});

test('Rucola: 402 actually produced covers 432 earlier same-day firm pieces once, leaving 30', () => {
  const advance = { ...babySpanacAdvance, cantitate: 402, cantitate_reala_produsa: 402 };
  const firms = [258, 174].map(cantitate => ({ data_productie: '2026-10-27', created_at: '2026-10-27T00:00:00Z', cantitate, cantitate_reala_produsa: 0 }));
  compensateAdvanceQuantities([{ order: advance, automatic: false }], firms);
  expect(firms.map(f => f.cantitate_reala_produsa)).toEqual([258, 144]);
  expect(advance.cantitate).toBe(0);
  expect(advance.cantitate_reala_produsa).toBe(0);
  expect(firms.reduce((sum, f) => sum + f.cantitate - f.cantitate_reala_produsa, 0)).toBe(30);
});

test('unproduced manual 600-piece advance is not completed by earlier firm orders', () => {
  const advance = { ...babySpanacAdvance, cantitate: 600, cantitate_reala_produsa: 0, status: 'pending' };
  const firm = { ...babySpanacAdvance, created_at: '2026-10-26T15:00:00Z', cantitate: 600, cantitate_reala_produsa: 0 };
  compensateAdvanceQuantities([{ order: advance, automatic: false }], [firm]);
  expect(advance.cantitate).toBe(600);
  expect(advance.status).toBe('pending');
  expect(firm.cantitate_reala_produsa).toBe(0);
});

test('today’s produced 1000 spinach pieces never cover tomorrow', () => {
  const advance = { ...babySpanacAdvance, cantitate: 1000, cantitate_reala_produsa: 1000, status: 'assigned' };
  const firm = { ...babySpanacAdvance, data_productie: '2026-10-28', cantitate: 1000, cantitate_reala_produsa: 0 };
  compensateAdvanceQuantities([{ order: advance, automatic: true }], [firm]);
  expect(advance.cantitate_reala_produsa).toBe(1000);
  expect(advance.status).toBe('assigned');
  expect(firm.cantitate_reala_produsa).toBe(0);
});

test('fully compensated automatic advances display completed without changing the stored order', () => {
  for (const status of ['pending', 'assigned', 'in_progress']) {
    const stored = { ...babySpanacAdvance, cantitate: 402, cantitate_reala_produsa: 0, status };
    const projected = { ...stored };
    const firm = { ...babySpanacAdvance, created_at: '2026-10-26T15:00:00Z', cantitate: 432, cantitate_reala_produsa: 0 };
    compensateAdvanceQuantities([{ order: projected, automatic: true }], [firm]);
    expect(projected.cantitate).toBe(0);
    expect(projected.status).toBe('completed');
    expect(stored.cantitate).toBe(402);
    expect(stored.status).toBe(status);
    expect(firm.cantitate_reala_produsa).toBe(0);
  }
});

test('partially compensated automatic advance keeps its open status and remaining quantity', () => {
  const advance = { ...babySpanacAdvance, cantitate: 600, cantitate_reala_produsa: 0, status: 'assigned' };
  const firm = { ...babySpanacAdvance, cantitate: 402, cantitate_reala_produsa: 0 };
  compensateAdvanceQuantities([{ order: advance, automatic: true }], [firm]);
  expect(advance.cantitate).toBe(198);
  expect(advance.status).toBe('assigned');
});