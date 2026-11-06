import { describe, expect, it } from "bun:test";
import { displayedTable, excelCell, moveItem, reportTables, tableDraft } from "../../src/lib/argus/reportTables";

describe("editable report values", () => {
  const table = { id: "table", title: "Cost", headers: ["Produs", "Kg", "Lei"], rows: [["Spanac", 20, 123.45]] };
  it("reorders rows and columns without changing original values", () => {
    const draft = tableDraft(table);
    draft.columnIds = moveItem(draft.columnIds, 2, 0); draft.headers = moveItem(draft.headers, 2, 0); draft.rows = draft.rows.map(r => moveItem(r, 2, 0));
    expect(displayedTable(table, draft).rows).toEqual([[123.45, "Spanac", 20]]);
    expect(table.rows).toEqual([["Spanac", 20, 123.45]]);
  });
  it("fresh Senior results replace manual amounts but retain column layout", () => {
    const draft = tableDraft(table); draft.headers[2] = "Cost lei"; draft.rows[0][2] = 999;
    expect(displayedTable({ ...table, rows: [["Spanac", 21, 150]] }, draft).rows).toEqual([["Spanac", 21, 150]]);
    expect(displayedTable({ ...table, rows: [["Spanac", 21, 150]] }, draft).headers[2]).toBe("Cost lei");
  });
  it("exports numeric Romanian quantities but retains product codes", () => {
    expect(excelCell("1234,50")).toBe(1234.5); expect(excelCell("1.234,50")).toBe(1234.5); expect(excelCell(20)).toBe(20);
    expect(excelCell("00123")).toBe("00123"); expect(excelCell("5% ")).toBe("5%");
  });
  it("extracts all markdown tables for editing and export", () => {
    expect(reportTables({ markdown_text: "| Produs | Kg |\n|---|---|\n| Spanac | 20 |\n\n| Cost | Lei |\n|---|---|\n| Total | 30 |" })).toHaveLength(2);
  });
});