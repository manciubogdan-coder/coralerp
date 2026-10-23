import { test, expect } from 'bun:test';
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
test('saved attachment references expand into document text and correctly typed images on follow-up turns', async () => {
  const { expandAttachments } = await import('../../supabase/functions/argus/files');
  let reads = 0;
  const c = { cloud: { storage: { from: () => ({ download: async () => { reads++; return { data: new Blob([JSON.stringify({ text: 'Rucola 120 bucati', images: ['data:image/png;base64,YWJj'], filename: 'comanda.pdf', originalPath: 'user/thread/file.pdf' })]), error: null }; } }) } } };
  const messages = [{ id: 'one', role: 'user', parts: [{ type: 'file', mediaType: 'application/pdf', filename: 'comanda.pdf', url: 'argus-file:user/thread/12345678-1234-1234-1234-123456789abc.json' }] }, { id: 'two', role: 'assistant', parts: [{ type: 'text', text: '120 bucati' }] }, { id: 'three', role: 'user', parts: [{ type: 'text', text: 'Cate kilograme?' }] }];
  const expanded = await expandAttachments(messages as any, c as any, 'user', 'thread');
  expect(reads).toBe(1);
  expect((expanded[0].parts[0] as any).text).toContain('Rucola 120 bucati');
  expect(expanded[0].parts[1]).toEqual({ type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,YWJj' });
  expect(messages[0].parts[0].url).toStartWith('argus-file:');
  await expect(expandAttachments(messages as any, c as any, 'other', 'thread')).rejects.toThrow();
});