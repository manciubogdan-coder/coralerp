import { expect, test } from 'bun:test';
import { claimSessionFinish, distributeGroupQuantity, validateSessionQuantity, wholeUnits } from '../../src/lib/productie/finishSession';

test('186 saved pieces cannot be overwritten by a second finish with zero', async () => {
  const row = { id: 'session', status: 'activa', cantitate_produsa: 0 };
  const client = { from: () => ({ update: (payload: any) => {
    const filters: Record<string, string> = {};
    const query = {
      eq: (key: string, value: string) => { filters[key] = value; return query; },
      select: () => query,
      maybeSingle: async () => {
        if (row.id !== filters.id || row.status !== filters.status) return { data: null, error: null };
        Object.assign(row, payload);
        return { data: { ...row }, error: null };
      },
    };
    return query;
  } }) };
  await claimSessionFinish(client, 'session', 186, 'finalizata');
  await expect(claimSessionFinish(client, 'session', 0, 'partial')).rejects.toThrow('deja încheiată');
  expect(row.cantitate_produsa).toBe(186);
  expect(row.status).toBe('finalizata');
});

test('invalid numeric editing cannot reach a session write', () => {
  for (const quantity of [NaN, Infinity, -1]) expect(() => validateSessionQuantity(quantity)).toThrow();
  expect(() => validateSessionQuantity(0)).not.toThrow();
  expect(() => validateSessionQuantity(186)).not.toThrow();
});
test('an 8,4 kg order is covered by 9 whole kg', () => {
  expect(wholeUnits(8.4)).toBe(9);
  expect(wholeUnits(1.2)).toBe(2);
  expect(wholeUnits(5)).toBe(5);
});

test('Iceberg group 3 + 3 + 8,4 + 1,2 + 5 kg splits into whole kg only', () => {
  const assigns = distributeGroupQuantity([3, 3, 8.4, 1.2, 5], 22);
  expect(assigns).toEqual([3, 3, 9, 2, 5]);
  for (const a of assigns) expect(Number.isInteger(a)).toBe(true);
});

test('group surplus goes to the last order and shortage leaves the last ones short', () => {
  expect(distributeGroupQuantity([3, 8.4, 5], 20)).toEqual([3, 9, 8]);
  expect(distributeGroupQuantity([3, 8.4, 5], 10)).toEqual([3, 7, 0]);
});
