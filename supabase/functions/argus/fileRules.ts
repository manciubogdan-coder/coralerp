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
export type PreparedFile = { text: string; images: string[] };
export const PreparedFileSchema = {
  parse(value: unknown): PreparedFile {
    const v = value as PreparedFile | null;
    if (!v || typeof v.text !== 'string' || v.text.length > MAX_TEXT || !Array.isArray(v.images) || v.images.length > 30 ||
      v.images.some(x => typeof x !== 'string' || x.length > 12 * 1024 * 1024 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(x)) ||
      (!v.text.trim() && !v.images.length)) throw new Error('Fișierul nu conține text sau imagini lizibile, sau depășește limitele acceptate.');
    return { text: v.text, images: v.images };
  },
  safeParse(value: unknown) {
    try { return { success: true, data: this.parse(value) }; }
    catch { return { success: false }; }
  },
};

export function attachmentPath(url: string, userId: string, threadId: string) {
  const prefix = `argus-file:${userId}/${threadId}/`;
  if (!url.startsWith(prefix)) throw new Error('Fișierul nu aparține conversației.');
  const id = url.slice(prefix.length);
  if (!/^[0-9a-f-]{36}\.json$/.test(id)) throw new Error('Referință de fișier invalidă.');
  return url.slice('argus-file:'.length);
}