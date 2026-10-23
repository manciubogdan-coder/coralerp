import { test, expect } from 'bun:test';
import { plugin } from 'bun';
plugin({ name: 'deno-zod-import', setup(build) { build.onResolve({ filter: /^npm:zod@3$/ }, () => ({ path: import.meta.resolve('zod').replace('file://', '') })); } });
const { attachmentPath, FILE_TYPES, MAX_FILE_BYTES, PreparedFileSchema } = await import('../../supabase/functions/argus/fileRules');
test('attachments resolve only within their owning user and conversation', () => {
  const url = 'argus-file:user/thread/12345678-1234-1234-1234-123456789abc.json';
  expect(attachmentPath(url, 'user', 'thread')).toBe('user/thread/12345678-1234-1234-1234-123456789abc.json');
  expect(() => attachmentPath(url, 'other-user', 'thread')).toThrow();
  expect(() => attachmentPath(url, 'user', 'other-thread')).toThrow();
  expect(() => attachmentPath('https://example.com/private', 'user', 'thread')).toThrow();
  expect(() => attachmentPath('argus-file:user/thread/../secret.json', 'user', 'thread')).toThrow();
});
test('photos Excel PDF and Word have explicit accepted media types', () => {
  expect(FILE_TYPES.jpg).toBe('image/jpeg'); expect(FILE_TYPES.xlsx).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  expect(FILE_TYPES.pdf).toBe('application/pdf'); expect(FILE_TYPES.docx).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  expect(FILE_TYPES.exe).toBeUndefined(); expect(MAX_FILE_BYTES).toBe(26214400);
});
test('prepared documents reject empty content and arbitrary external image URLs', () => {
  expect(PreparedFileSchema.safeParse({ text: 'comenzi client', images: [] }).success).toBe(true);
  expect(PreparedFileSchema.safeParse({ text: '', images: [] }).success).toBe(false);
  expect(PreparedFileSchema.safeParse({ text: 'test', images: ['https://example.com/img.png'] }).success).toBe(false);
  expect(PreparedFileSchema.safeParse({ text: '', images: ['data:image/jpeg;base64,YWJj'] }).success).toBe(true);
});