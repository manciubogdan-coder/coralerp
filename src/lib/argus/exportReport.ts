import { displayedTable, excelCell, reportTables, type ReportView } from "./reportTables";
import type { ArgusContent } from "@/components/argus/ArgusWidgetRenderer";

export async function exportReport(content: ArgusContent, view?: ReportView | null) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const tables = reportTables(content).map(t => displayedTable(t, view?.tables?.[t.id]));
  tables.forEach((t, i) => {
    const sheet = XLSX.utils.aoa_to_sheet([t.headers, ...t.rows.map(r => t.headers.map((_, j) => excelCell(r[j])))]);
    sheet["!cols"] = t.headers.map((h, j) => ({ wch: Math.min(50, Math.max(14, h.length + 2, ...t.rows.slice(0, 100).map(r => String(r[j] ?? "").length + 2))) }));
    if (t.rows.length) sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: t.rows.length, c: t.headers.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, sheet, `${i + 1} ${t.title}`.replace(/[\\/?*\[\]:]/g, " ").slice(0, 31));
  });
  if (!tables.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[content.title ?? "Raport"], ...(content.markdown_text ?? content.summary ?? "").split("\n").map(line => [line])]), "Raport");
  XLSX.writeFile(wb, `${(content.title ?? "Raport Argus").replace(/[\\/:*?"<>|]/g, " ").slice(0, 80)}.xlsx`);
}