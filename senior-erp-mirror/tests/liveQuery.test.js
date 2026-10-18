const test = require("node:test");
const assert = require("node:assert");
const { buildAggregate } = require("../src/liveQuery");

const meta = {
  schema: "dbo", name: "C_H_Note_Contabile",
  columns: [
    { name: "data", src: "Data", type: "timestamp" },
    { name: "valoare_rol", src: "Valoare_Rol", type: "numeric" },
    { name: "partener", src: "Partener", type: "text" },
  ],
};

test("monthly sum uses parameters, NOLOCK and a row cap", () => {
  const { sql, params } = buildAggregate({ table: "c_h_note_contabile", groups: [{ col: "data", bucket: "month" }], measures: [{ col: "valoare_rol", fn: "sum" }], filters: [{ col: "data", op: "gte", value: "2026-01-01" }], limit: 5000, order: "group" }, meta);
  assert.match(sql, /^SELECT TOP \(2000\) CONVERT\(char\(7\), src\.\[Data\], 120\)/);
  assert.match(sql, /WITH \(NOLOCK\) WHERE src\.\[Data\] >= @p1 GROUP BY/);
  assert.deepStrictEqual(params, { p1: "2026-01-01" });
});

test("default measure is a row count", () => {
  const { sql } = buildAggregate({ table: "x", groups: [], measures: [], filters: [] }, meta);
  assert.match(sql, /COUNT_BIG\(\*\) AS \[m1\]/);
});

test("unknown columns and sums on text are rejected", () => {
  assert.throws(() => buildAggregate({ groups: [{ col: "nope" }] }, meta), /necunoscuta/);
  assert.throws(() => buildAggregate({ measures: [{ col: "partener", fn: "sum" }] }, meta), /numerice/);
});

test("filter values never enter the SQL text", () => {
  const { sql, params } = buildAggregate({ filters: [{ col: "partener", op: "contains", value: "x'; DROP TABLE y--" }] }, meta);
  assert.ok(!sql.includes("DROP"));
  assert.strictEqual(params.p1, "%x'; DROP TABLE y--%");
});
