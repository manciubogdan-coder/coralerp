// Context transformations never mutate the saved transcript or tool result.
export const RECENT_MESSAGES = 6;
export function messageText(m: any): string {
  return (m.parts ?? []).filter((p: any) => p.type === 'text').map((p: any) => String(p.text ?? '')).join('\n');
}
export function compactData(value: unknown): string {
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    if (value.every(r => r && typeof r === 'object' && !Array.isArray(r))) {
      const columns = [...new Set(value.flatMap(r => Object.keys(r)))];
      // Keep IDs, dates and nulls: they can be required for drill-down or actions.
      return JSON.stringify({ columns, rows: value.map(r => columns.map(k => r[k] ?? null)) });
    }
    return JSON.stringify(value);
  }
  if (value && typeof value === 'object') {
    return '{' + Object.entries(value).map(([k, v]) => JSON.stringify(k) + ':' + compactData(v)).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
export async function contextHash(messages: unknown[]): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(messages)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export function attachmentManifest(messages: any[]) {
  const files = new Map<string, { reference: string; filename: string }>();
  for (const m of messages) for (const p of m.parts ?? []) if (p.type === 'file') files.set(p.url, { reference: p.url, filename: p.filename ?? 'Fișier' });
  return [...files.values()];
}
export function attachmentExcerpt(text: string, start: number, count: number) {
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(count) || count < 1 || count > 100) throw new Error('Interval invalid (1–100 linii).');
  const lines = text.split('\n');
  const selected = lines.slice(start - 1, start - 1 + count);
  let chars = 0;
  const visible: string[] = [];
  for (const line of selected) {
    if (chars + line.length > 16000) break;
    visible.push(line); chars += line.length;
  }
  return { total_lines: lines.length, start, lines: visible, next_line: start + visible.length <= lines.length ? start + visible.length : null,
    oversized_line: visible.length === 0 && selected.length > 0 };
}