// Source-side business-date filtering. Unknown dates never silently drop ERP rows.
const quote = (id) => `[${String(id).replace(/]/g, "]]")}]`;
const key = (schema, table) => `${schema}.${table}`.toLowerCase();
const DATE_TYPES = new Set(["date", "datetime", "datetime2", "smalldatetime", "datetimeoffset"]);

function createHistoryPlanner(columns, foreignKeys) {
  const catalog = new Map();
  for (const c of columns) {
    const k = key(c.s, c.n);
    if (!catalog.has(k)) catalog.set(k, []);
    catalog.get(k).push(c);
  }
  const relations = new Map();
  for (const f of foreignKeys) {
    const k = key(f.child_schema, f.child_table);
    if (!relations.has(k)) relations.set(k, new Map());
    const groups = relations.get(k);
    if (!groups.has(f.fk_id)) groups.set(f.fk_id, []);
    groups.get(f.fk_id).push(f);
  }
  // Senior's document-line/header link is explicit and both columns must exist.
  const detail = catalog.get("dbo.c_d_note_contabile") || [];
  const header = catalog.get("dbo.c_h_note_contabile") || [];
  if (detail.some((c) => c.col.toLowerCase() === "h_id") && header.some((c) => c.col.toLowerCase() === "h_id")) {
    const k = "dbo.c_d_note_contabile";
    if (!relations.has(k)) relations.set(k, new Map());
    relations.get(k).set("senior_header", [{ child_col: "H_ID", parent_schema: "dbo", parent_table: "C_H_Note_Contabile", parent_col: "H_ID" }]);
  }

  function predicate(schema, table, alias, visited = new Set()) {
    const k = key(schema, table);
    if (visited.has(k) || visited.size >= 6) return null;
    const next = new Set(visited); next.add(k);
    const cols = catalog.get(k) || [];
    const ref = (name) => `${alias}.${quote(name)}`;
    const period = cols.find((c) => c.col.toLowerCase() === "periodid");
    if (table.toLowerCase() === "accountingstatistics" && period) {
      // Older Senior SQL Server versions do not support TRY_CONVERT.
      // Canonical six-digit YYYYMM strings sort chronologically; malformed values
      // remain unknown and are retained without a potentially failing numeric cast.
      const text = `LTRIM(RTRIM(CONVERT(varchar(100), ${ref(period.col)})))`;
      const r = `(CASE WHEN LEN(${text}) = 6 AND ${text} NOT LIKE '%[^0-9]%' THEN ${text} ELSE NULL END)`;
      return `(${r} IS NULL OR (${r} >= CONVERT(varchar(6), @historyPeriodStart) AND ${r} < CONVERT(varchar(6), @historyPeriodEnd)))`;
    }
    // Never use created_on, modified_on, expiration, delivery or payment due dates.
    // Reference catalogs can contain dates too; they are not historical documents.
    if (/^(c_plan_|.*(?:products|partners|clients|suppliers|articole|parteneri|nomencl))/i.test(table)) return null;
    const names = /^c_h_/i.test(table)
      ? ["data", "documentdate", "data_document_primar"]
      : ["documentdate", "datadocument", "data_document"];
    const date = names.map((name) => cols.find((c) => c.col.toLowerCase() === name && DATE_TYPES.has(c.type.toLowerCase()))).find(Boolean);
    if (date) return `(${ref(date.col)} IS NULL OR (${ref(date.col)} >= @historyStart AND ${ref(date.col)} < @historyEnd))`;
    const candidates = [];
    for (const links of (relations.get(k) || new Map()).values()) {
      const first = links[0];
      const parentAlias = `h${next.size}`;
      const parent = predicate(first.parent_schema, first.parent_table, parentAlias, next);
      if (!parent) continue;
      const from = `${quote(first.parent_schema)}.${quote(first.parent_table)} ${parentAlias} WITH (NOLOCK)`;
      const join = links.map((f) => `${parentAlias}.${quote(f.parent_col)} = ${ref(f.child_col)}`).join(" AND ");
      // Preserve null/orphan relationships rather than guess their age.
      candidates.push(`(EXISTS (SELECT 1 FROM ${from} WHERE ${join} AND ${parent}) OR NOT EXISTS (SELECT 1 FROM ${from} WHERE ${join}))`);
    }
    return candidates.length ? `(${candidates.join(" OR ")})` : null;
  }
  return (schema, table) => {
    const where = predicate(schema, table, "src");
    return { where: where ? ` WHERE ${where}` : "", filtered: Boolean(where), scope: where || "reference-or-unclassified:full" };
  };
}

module.exports = { createHistoryPlanner };