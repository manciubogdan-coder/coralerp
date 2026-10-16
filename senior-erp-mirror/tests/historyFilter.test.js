const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHistoryPlanner } = require("../src/historyFilter");
const column = (n, col, type = "datetime") => ({ s: "dbo", n, col, type });

test("accounting uses YYYYMM bounds; master data remains complete", () => {
  const plan = createHistoryPlanner([column("AccountingStatistics", "PeriodID", "nvarchar"), column("Products", "Created_On"), column("Products", "DocumentDate")], []);
  assert.match(plan("dbo", "AccountingStatistics").where, /TRY_CONVERT\(int/);
  assert.match(plan("dbo", "AccountingStatistics").where, /historyPeriodEnd/);
  assert.equal(plan("dbo", "Products").filtered, false);
});
test("Senior lines follow header business date; nullable/orphan links retained", () => {
  const plan = createHistoryPlanner([column("C_H_Note_Contabile", "Data"), column("C_H_Note_Contabile", "H_ID", "int"), column("C_D_Note_Contabile", "H_ID", "int"), column("C_D_Note_Contabile", "DataScadenta")], []);
  const rule = plan("dbo", "C_D_Note_Contabile").where;
  assert.match(rule, /EXISTS.*C_H_Note_Contabile/);
  assert.match(rule, /NOT EXISTS/);
  assert.match(rule, /\[Data\].*historyStart/);
  assert.doesNotMatch(rule, /DataScadenta/);
});
test("composite foreign keys propagate time scopes and cycles terminate", () => {
  const cols = [column("Header", "DocumentDate"), column("Line", "Created_On"), column("Loop", "Modified_On")];
  const fk = ["Tenant", "ID"].map((col) => ({ fk_id: 1, child_schema: "dbo", child_table: "Line", child_col: col, parent_schema: "dbo", parent_table: "Header", parent_col: col }));
  fk.push({ fk_id: 2, child_schema: "dbo", child_table: "Loop", child_col: "ID", parent_schema: "dbo", parent_table: "Loop", parent_col: "ID" });
  const plan = createHistoryPlanner(cols, fk);
  assert.match(plan("dbo", "Line").where, /\[Tenant\].* AND .*\[ID\]/);
  assert.equal(plan("dbo", "Loop").filtered, false);
});
test("unknown and expiration-only tables are not silently truncated", () => {
  const plan = createHistoryPlanner([column("Unknown", "Data_Expirarii")], []);
  assert.equal(plan("dbo", "Unknown").where, "");
});