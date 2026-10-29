import { test, expect } from 'bun:test';
import { rollingContext } from '../../supabase/functions/argus/context';

test('rolling memory persists, reuses retries, retains corrections and leaves 201 originals unchanged', async () => {
  let stored: any = null;
  let calls = 0;
  const c: any = { cloud: { from: () => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: stored, error: null }), upsert: async (row: any) => { stored = row; return { error: null }; } };
    return q;
  } } };
  const messages: any[] = Array.from({ length: 201 }, (_, i) => ({ id: `${i}`, role: i % 2 ? 'assistant' : 'user', parts: [{ type: 'text', text: i === 0 ? '638 kg, minus 33 kg, credit 191.4 kg' : `turn ${i}` }] }));
  const original = JSON.stringify(messages);
  const summarize = async (prompt: string) => { calls++; return prompt.includes('638 kg') ? '638 kg; minus 33 kg; credit 191.4 kg' : 'Corecție 637 kg'; };
  const result = await rollingContext(messages, c, 'user', 'thread', summarize);
  expect(result.summary).toContain('191.4 kg');
  expect(result.recent).toHaveLength(6);
  expect(stored.covered_messages).toBe(195);
  const firstCalls = calls;
  await rollingContext(messages, c, 'user', 'thread', summarize);
  expect(calls).toBe(firstCalls);
  messages[0] = { ...messages[0], parts: [{ type: 'text', text: 'Corecție: 637 kg' }] };
  const updated = await rollingContext(messages, c, 'user', 'thread', summarize);
  expect(calls).toBeGreaterThan(firstCalls);
  expect(updated.summary).toBe('Corecție 637 kg');
  expect(JSON.parse(original)).toHaveLength(201);
});

test('failed synthesis does not store an empty summary or silently drop history', async () => {
  let saved = false;
  const c: any = { cloud: { from: () => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null }), upsert: async () => { saved = true; return {}; } };
    return q;
  } } };
  const messages: any[] = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, role: 'user', parts: [{ type: 'text', text: 'important' }] }));
  await expect(rollingContext(messages, c, 'user', 'thread', async () => '')).rejects.toThrow('Memoria');
  expect(saved).toBe(false);
  expect(messages).toHaveLength(10);
});