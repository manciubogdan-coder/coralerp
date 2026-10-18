import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { fillTemplate, validTemplate } from "./templates.ts";

const base = {
  kind: "sql",
  sql: "SELECT pp.Partener_Denumire AS furnizor FROM dbo.X WHERE h.Data >= {{de_la}} AND h.Data < DATEADD(day, 1, {{pana_la}}) AND pp.Partener_Denumire LIKE N'%' + {{partener}} + N'%'",
  params: [
    { name: "de_la", label: "De la", type: "date" },
    { name: "pana_la", label: "Până la", type: "date" },
    { name: "partener", label: "Furnizor", type: "text" },
  ],
  defaults: { de_la: "2026-09-01", pana_la: "2026-09-30", partener: "Kaufland" },
};

Deno.test("date and supplier filters are filled as quoted literals", () => {
  const t = validTemplate(base)!;
  const sql = fillTemplate(t, { de_la: "2026-10-01", pana_la: "2026-10-18", partener: "O'Brien" });
  assertEquals(sql.includes("h.Data >= '2026-10-01'"), true);
  assertEquals(sql.includes("DATEADD(day, 1, '2026-10-18')"), true);
  assertEquals(sql.includes("N'O''Brien'"), true);
});

Deno.test("empty supplier keeps every supplier", () => {
  const sql = fillTemplate(validTemplate(base)!, { partener: "" });
  assertEquals(sql.includes("N'%' + N'' + N'%'"), true);
});

Deno.test("invalid date is refused", () => {
  assertThrows(() => fillTemplate(validTemplate(base)!, { de_la: "2026-13-45; DROP" }));
});

Deno.test("undeclared placeholder makes the template invalid", () => {
  assertEquals(validTemplate({ ...base, sql: base.sql + " AND x = {{articol}}" }), null);
});

Deno.test("only SELECT templates are accepted", () => {
  assertEquals(validTemplate({ ...base, sql: "DELETE FROM dbo.X" }), null);
});
