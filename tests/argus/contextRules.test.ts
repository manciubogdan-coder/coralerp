import { test, expect } from 'bun:test';
import { compactData, attachmentExcerpt, contextHash, RECENT_MESSAGES, attachmentManifest } from '../../supabase/functions/argus/contextRules';

test('compact table preserves exact identifiers, business dates, nulls and amounts without mutating data', () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({ document_id: `order-${i}`, receipt_date: '2026-10-28', product_name: 'Rucola', quantity_received_kg: 638, quality_credit_kg: 191.4, unknown: null }));
  const original = JSON.stringify(rows);
  const compact = compactData(rows);
  const parsed = JSON.parse(compact);
  expect(parsed.rows[0]).toEqual(['order-0', '2026-10-28', 'Rucola', 638, 191.4, null]);
  expect(JSON.stringify(rows)).toBe(original);
  expect(compact.length).toBeLessThan(original.length / 2);
});
test('recent raw window keeps six messages; cached prefix invalidates on edit, not append', async () => {
  const messages = Array.from({ length: 201 }, (_, i) => ({ id: i, text: `turn ${i}` }));
  expect(RECENT_MESSAGES).toBe(6);
  expect(messages.slice(-RECENT_MESSAGES).map(m => m.id)).toEqual([195,196,197,198,199,200]);
  const prefix = messages.slice(0, -RECENT_MESSAGES);
  expect(await contextHash(prefix)).toBe(await contextHash([...prefix]));
  expect(await contextHash(prefix)).not.toBe(await contextHash([{ id: 0, text: 'corrected' }, ...prefix.slice(1)]));
});
test('rereading returns exact source lines, continuation and rejects unbounded ranges', () => {
  expect(attachmentExcerpt('header\n638\n33\n191.4', 2, 2)).toEqual({ total_lines: 4, start: 2, lines: ['638','33'], next_line: 4, oversized_line: false });
  expect(() => attachmentExcerpt('data', 0, 10)).toThrow();
  expect(() => attachmentExcerpt('data', 1, 101)).toThrow();
});
test('attachment manifest retains older references even outside the recent window', () => {
  const messages = [{ parts: [{ type: 'file', url: 'argus-file:scoped', filename: 'receptie.xlsx' }] }, ...Array.from({ length: 10 }, () => ({ parts: [] }))];
  expect(attachmentManifest(messages)).toEqual([{ reference: 'argus-file:scoped', filename: 'receptie.xlsx' }]);
});