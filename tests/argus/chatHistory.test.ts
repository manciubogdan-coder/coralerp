import { test, expect } from 'bun:test';
import { validChatMessages, readChatHistory, repairChatMessageIds } from '../../supabase/functions/argus/chatHistory';

const turns = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `message-${i}`, role: i % 2 ? 'assistant' : 'user',
  parts: [{ type: 'text', text: `turn ${i}` }],
}));

test('the existing 201-message conversation accepts retry and another user message', () => {
  const messages = turns(201);
  expect(validChatMessages(messages)).toBe(true);
  expect(validChatMessages([...messages, { id: 'next', role: 'user', parts: [{ type: 'text', text: 'Continuăm' }] }])).toBe(true);
  expect(messages).toHaveLength(201);
});

test('removing the turn cap still rejects malformed messages and privileged roles', () => {
  expect(validChatMessages(null)).toBe(false);
  expect(validChatMessages([])).toBe(false);
  expect(validChatMessages([{ id: '1', role: 'system', parts: [] }])).toBe(false);
  expect(validChatMessages([{ id: '1', role: 'user', parts: [null] }])).toBe(false);
  expect(validChatMessages([{ id: '1', role: 'user', parts: 'bad' }])).toBe(false);
});

test('reopening a 1001-turn chat retains every message in order', async () => {
  const messages = turns(1001);
  const ranges: number[][] = [];
  const loaded = await readChatHistory(async (from, to) => {
    ranges.push([from, to]);
    return { data: messages.slice(from, to + 1), error: null };
  });
  expect(ranges).toEqual([[0, 999], [1000, 1999]]);
  expect(loaded).toEqual(messages);
  expect(validChatMessages(loaded)).toBe(true);
});

test('failed history pages do not return a truncated transcript', async () => {
  await expect(readChatHistory(async () => ({ data: null, error: new Error('read failed') }))).rejects.toThrow('read failed');
});

test('existing chat with empty assistant IDs continues and retries without losing any parts', () => {
  const messages = turns(124);
  const parts = [{ type: 'text', text: 'Calcul folie open close' },
    { type: 'tool-genereaza_raport', output: { total: 18.5 } },
    { type: 'tool-propune_actiune', output: { id: 'pending-action' } }];
  messages[1] = { id: '', role: 'assistant', parts: parts as typeof messages[number]['parts'] };
  messages[3].id = '';
  expect(validChatMessages(messages)).toBe(false);
  const repaired = repairChatMessageIds(messages, 'existing-thread');
  expect(validChatMessages(repaired)).toBe(true);
  expect(repaired).toHaveLength(124);
  expect(repaired[1].parts).toEqual(parts);
  expect(new Set(repaired.map(m => m.id)).size).toBe(124);
  expect(repairChatMessageIds(messages, 'existing-thread')).toEqual(repaired);
  expect(repairChatMessageIds(repaired, 'existing-thread')).toEqual(repaired);
  expect(messages[1].id).toBe('');
  expect(validChatMessages([...repaired, { id: 'next', role: 'user', parts: [{ type: 'text', text: 'Continuăm' }] }])).toBe(true);
});

test('legacy repair avoids valid IDs and does not admit privileged or malformed messages', () => {
  const repaired = repairChatMessageIds([{ id: '', role: 'assistant', parts: [] },
    { id: 'legacy:thread:0', role: 'user', parts: [] }], 'thread');
  expect(repaired.map(m => m.id)).toEqual(['legacy:thread:0:1', 'legacy:thread:0']);
  expect(validChatMessages(repairChatMessageIds([{ id: '', role: 'system', parts: [] }], 'thread'))).toBe(false);
  expect(validChatMessages(repairChatMessageIds([{ id: '', role: 'user', parts: [null] }], 'thread'))).toBe(false);
});