import { test, expect } from 'bun:test';
import { loadMemory } from '../../supabase/functions/argus/memoryStore';

test('shared permanent memory retains all facts beyond the old 400 cap and API page limit', async () => {
  const rows = Array.from({ length: 1201 }, (_, i) => ({ id: String(i), fact: `regula ${i}`, category: 'cost' }));
  const ranges: number[][] = [];
  const c = { cloud: { from: (table: string) => {
    expect(table).toBe('argus_memory');
    const q: any = { select: () => q, order: () => q, range: async (a: number, b: number) => {
      ranges.push([a, b]); return { data: rows.slice(a, b + 1), error: null };
    } };
    return q;
  } } };
  const memory = await loadMemory(c);
  expect(memory.split('\n')).toHaveLength(1201);
  expect(memory).toContain('[cost] regula 0\n');
  expect(memory).toContain('[cost] regula 1200');
  expect(ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
});

test('unavailable permanent memory is an error rather than an empty memory', async () => {
  const q: any = { select: () => q, order: () => q, range: async () => ({ data: null, error: { message: 'permission denied' } }) };
  await expect(loadMemory({ cloud: { from: () => q } })).rejects.toThrow('Memoria permanentă Argus nu a putut fi citită: permission denied');
});

test('a genuinely empty memory is reported as empty', async () => {
  const q: any = { select: () => q, order: () => q, range: async () => ({ data: [], error: null }) };
  expect(await loadMemory({ cloud: { from: () => q } })).toBe('(încă goală)');
});