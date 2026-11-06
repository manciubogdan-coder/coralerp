/** Bounded presentation-only payload, never executable SQL or source record changes. */
export function validReportView(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Format de tabel invalid.");
  if (JSON.stringify(value).length > 2_000_000) throw new Error("Tabelul editat este prea mare.");
  const tables = (value as any).tables;
  if (!tables || typeof tables !== "object" || Array.isArray(tables)) throw new Error("Lipsesc tabelele.");
  const out: Record<string, unknown> = {};
  for (const [key, edit] of Object.entries(tables) as [string, any][]) {
    if (!/^(table|chart|kpi|markdown-\d+)$/.test(key) || !edit || typeof edit.source !== "string" || !Array.isArray(edit.originalHeaders) || !Array.isArray(edit.columnIds) || !Array.isArray(edit.headers) || !Array.isArray(edit.rows)) throw new Error("Tabel invalid.");
    if (!edit.headers.length || edit.headers.length > 100 || edit.rows.length > 10000 || edit.columnIds.length !== edit.headers.length || !edit.headers.every((x: unknown) => typeof x === "string" && x.length <= 300) || !edit.originalHeaders.every((x: unknown) => typeof x === "string" && x.length <= 300) || !edit.columnIds.every(Number.isInteger)) throw new Error("Coloane invalide.");
    if (!edit.rows.every((r: unknown) => Array.isArray(r) && r.length === edit.headers.length && r.every(v => v == null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))))) throw new Error("Valori de tabel invalide.");
    out[key] = { source: edit.source, originalHeaders: edit.originalHeaders, columnIds: edit.columnIds, headers: edit.headers, rows: edit.rows };
  }
  return { tables: out };
}