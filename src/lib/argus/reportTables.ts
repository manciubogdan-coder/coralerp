import { markdownTables } from "./chatExtras";

export type ReportTable = { id: string; title: string; headers: string[]; rows: unknown[][] };
export type TableEdit = { source: string; originalHeaders: string[]; columnIds: number[]; headers: string[]; rows: unknown[][] };
export type ReportView = { tables: Record<string, TableEdit> };
type Content = { title?: string; summary?: string; widget_type?: string; table_data?: { headers?: string[]; rows?: unknown[][] }; markdown_text?: string; chart_data?: Record<string, unknown>[]; kpi_data?: { value?: string; unit?: string; trend?: string | null } };

export function reportTables(content: Content): ReportTable[] {
  const tables: ReportTable[] = [];
  if (content.table_data?.headers?.length) tables.push({ id: "table", title: content.title ?? "Raport", headers: content.table_data.headers, rows: content.table_data.rows ?? [] });
  markdownTables(content.markdown_text ?? "").forEach((t, i) => tables.push({ ...t, id: `markdown-${i}` }));
  if (!tables.length && content.chart_data?.length) {
    const headers = [...new Set(content.chart_data.flatMap(Object.keys))];
    tables.push({ id: "chart", title: content.title ?? "Grafic", headers, rows: content.chart_data.map(r => headers.map(h => r[h] ?? null)) });
  }
  if (!tables.length && content.kpi_data) tables.push({ id: "kpi", title: content.title ?? "Indicator", headers: ["Valoare", "Unitate", "Evoluție"], rows: [[content.kpi_data.value, content.kpi_data.unit, content.kpi_data.trend]] });
  return tables;
}

export const tableSource = (t: ReportTable) => JSON.stringify([t.headers, t.rows]);
export function tableDraft(t: ReportTable): TableEdit {
  return { source: tableSource(t), originalHeaders: [...t.headers], columnIds: t.headers.map((_, i) => i), headers: [...t.headers], rows: t.rows.map(r => [...r]) };
}
export function displayedTable(t: ReportTable, edit?: TableEdit): ReportTable {
  if (!edit) return t;
  if (edit.source === tableSource(t)) return { ...t, headers: edit.headers, rows: edit.rows };
  // New live values replace manual cell edits. Preserve order/labels of matching original columns.
  const columns = edit.columnIds.flatMap((id, i) => {
    const original = edit.originalHeaders[id];
    const index = id < 0 ? -1 : t.headers.indexOf(original);
    return index < 0 ? [] : [{ index, label: edit.headers[i] }];
  });
  t.headers.forEach((h, index) => { if (!edit.originalHeaders.includes(h)) columns.push({ index, label: h }); });
  return columns.length ? { ...t, headers: columns.map(c => c.label), rows: t.rows.map(r => columns.map(c => r[c.index])) } : t;
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}

/** Keep actual numbers and recognize Romanian decimals, but preserve identifiers and percentages. */
export function excelCell(value: unknown): string | number | boolean {
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value ?? "").trim();
  if (/^[-+]?0\d+/.test(text)) return text;
  if (/^[-+]?\d+(?:[.,]\d+)?$/.test(text)) return Number(text.replace(",", "."));
  if (/^[-+]?\d{1,3}(?:[.\s\u00a0]\d{3})+,\d+$/.test(text)) return Number(text.replace(/[.\s\u00a0]/g, "").replace(",", "."));
  return text;
}