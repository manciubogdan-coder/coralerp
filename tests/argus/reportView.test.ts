import { describe, expect, it } from "bun:test";
import { validReportView } from "../../supabase/functions/argus/reportView";
describe("presentation-only report persistence", () => {
  it("accepts reordered numeric rows without executable fields", () => {
    const value = { tables: { table: { source: "[]", originalHeaders: ["Produs", "Kg"], columnIds: [1, 0], headers: ["Kg", "Produs"], rows: [[20, "Spanac"]], sql: "DELETE" } } };
    expect((validReportView(value) as any).tables.table.rows).toEqual([[20, "Spanac"]]);
    expect((validReportView(value) as any).tables.table.sql).toBeUndefined();
  });
  it("reset removes a saved personal view", () => { expect(validReportView(null)).toBeNull(); });
  it("rejects malformed rows rather than losing columns silently", () => {
    expect(() => validReportView({ tables: { table: { source: "[]", originalHeaders: ["Kg"], columnIds: [0], headers: ["Kg"], rows: [[20, 30]] } } })).toThrow();
  });
});