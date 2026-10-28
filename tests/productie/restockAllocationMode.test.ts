import { expect, test, mock } from 'bun:test';
import { offerRestockAtStart } from '../../src/lib/productie/restockAllocationMode';

test('OFF: individual and grouped production starts do not offer or allocate restock', async () => {
  const offer = mock(async () => true);
  for (const _ of ['individual', 'group order 1', 'group order 2']) {
    expect(await offerRestockAtStart(async () => false, offer)).toBe(false);
  }
  expect(offer).toHaveBeenCalledTimes(0);
});

test('ON: production start offers restock and preserves the operator confirmation result', async () => {
  const declined = mock(async () => false);
  expect(await offerRestockAtStart(async () => true, declined)).toBe(false);
  expect(declined).toHaveBeenCalledTimes(1);
  const accepted = mock(async () => true);
  expect(await offerRestockAtStart(async () => true, accepted)).toBe(true);
  expect(accepted).toHaveBeenCalledTimes(1);
});

test('unavailable setting fails closed without touching restock', async () => {
  const offer = mock(async () => true);
  expect(await offerRestockAtStart(async () => { throw new Error('offline'); }, offer)).toBe(false);
  expect(offer).toHaveBeenCalledTimes(0);
});