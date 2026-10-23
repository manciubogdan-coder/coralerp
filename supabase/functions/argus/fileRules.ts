import { z } from 'npm:zod@3';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 5;
export const MAX_TEXT = 250000;
export const FILE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel', csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};
export const PreparedFileSchema = z.object({
  text: z.string().max(MAX_TEXT),
  images: z.array(z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/).max(12 * 1024 * 1024)).max(30),
}).strict().refine(v => v.text.trim() || v.images.length, 'Fișierul nu conține text sau imagini lizibile.');

export function attachmentPath(url: string, userId: string, threadId: string) {
  const prefix = `argus-file:${userId}/${threadId}/`;
  if (!url.startsWith(prefix)) throw new Error('Fișierul nu aparține conversației.');
  const id = url.slice(prefix.length);
  if (!/^[0-9a-f-]{36}\.json$/.test(id)) throw new Error('Referință de fișier invalidă.');
  return url.slice('argus-file:'.length);
}