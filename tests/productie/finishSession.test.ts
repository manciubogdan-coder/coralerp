import { expect, test } from 'bun:test';
import { claimSessionFinish, validateSessionQuantity } from '../../src/lib/productie/finishSession';

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