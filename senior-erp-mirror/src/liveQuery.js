// Construieste interogari SELECT read-only pentru citirea directa din Senior (SQL Server).
// Primeste doar configuratii validate: tabelele si coloanele trebuie sa existe in catalogul citit din Senior.
const q = (id) => "[" + String(id).replace(/]/g, "]]") + "]";
const FNS = ["sum", "count", "avg", "min", "max", "count_distinct"];
const NUMERIC = ["numeric", "bigint"];
const DATES = ["date", "timestamp", "timestamptz"];

function buildAggregate(cfg, meta) {
  if (!meta) throw new Error("Tabel necunoscut in Senior.");
  const col = (name) => {
    const c = meta.columns.find((x) => x.name === name);
    if (!c) throw new Error(`Coloana necunoscuta: ${name}`);
    return c;
  };
  const params = {};
  let p = 0;
  const param = (v) => { const k = `p${++p}`; params[k] = v; return "@" + k; };
  const sel = [], grp = [], whr = [];
  (cfg.groups || []).forEach((g, i) => {
    const c = col(g.col);
    const ref = `src.${q(c.src)}`;
    let expr;
    if (g.bucket && DATES.includes(c.type)) {
      expr = `CONVERT(char(${g.bucket === "year" ? 4 : g.bucket === "month" ? 7 : 10}), ${ref}, 120)`;
    } else if (g.bucket && /period/i.test(c.name)) {
      // Perioade contabile YYYYMM pastrate ca text in Senior.
      expr = g.bucket === "year" ? `LEFT(CAST(${ref} AS nvarchar(20)), 4)` : `CAST(${ref} AS nvarchar(20))`;
    } else {
      expr = `CAST(${ref} AS nvarchar(400))`;
    }
    sel.push(`${expr} AS ${q("g" + (i + 1))}`);
    grp.push(expr);
  });
  const measures = (cfg.measures || []).length ? cfg.measures : [{ col: null, fn: "count" }];
  measures.forEach((m, i) => {
    if (!FNS.includes(m.fn)) throw new Error("Functie invalida.");
    let expr;
    if (!m.col) expr = "COUNT_BIG(*)";
    else {
      const c = col(m.col);
      const ref = `src.${q(c.src)}`;
      if (["sum", "avg"].includes(m.fn) && !NUMERIC.includes(c.type)) throw new Error(`Suma si media se pot calcula doar pe coloane numerice (${m.col}).`);
      expr = m.fn === "count_distinct" ? `COUNT_BIG(DISTINCT ${ref})`
        : m.fn === "count" ? `COUNT_BIG(${ref})`
        : m.fn === "sum" || m.fn === "avg" ? `${m.fn.toUpperCase()}(CAST(${ref} AS float))`
        : `${m.fn.toUpperCase()}(${ref})`;
    }
    sel.push(`${expr} AS ${q("m" + (i + 1))}`);
  });
  for (const f of cfg.filters || []) {
    const c = col(f.col);
    const ref = `src.${q(c.src)}`;
    const v = f.value ?? "";
    const typed = NUMERIC.includes(c.type) && v !== "" && !isNaN(Number(v)) ? Number(v) : String(v);
    switch (f.op) {
      case "eq": whr.push(`CAST(${ref} AS nvarchar(400)) = ${param(String(v))}`); break;
      case "neq": whr.push(`CAST(${ref} AS nvarchar(400)) <> ${param(String(v))}`); break;
      case "contains": whr.push(`CAST(${ref} AS nvarchar(400)) LIKE ${param("%" + v + "%")}`); break;
      case "starts": whr.push(`CAST(${ref} AS nvarchar(400)) LIKE ${param(v + "%")}`); break;
      case "gte": whr.push(`${ref} >= ${param(typed)}`); break;
      case "lte": whr.push(`${ref} <= ${param(typed)}`); break;
      case "notnull": whr.push(`${ref} IS NOT NULL`); break;
      default: throw new Error("Filtru invalid.");
    }
  }
  const limit = Math.min(Math.max(Number(cfg.limit) || 200, 1), 2000);
  const order = cfg.order === "group" && grp.length ? grp.map((_, i) => q("g" + (i + 1))).join(", ") : `${q("m1")} DESC`;
  const sql = `SELECT TOP (${limit}) ${sel.join(", ")} FROM ${q(meta.schema)}.${q(meta.name)} src WITH (NOLOCK)` +
    (whr.length ? ` WHERE ${whr.join(" AND ")}` : "") +
    (grp.length ? ` GROUP BY ${grp.join(", ")}` : "") +
    ` ORDER BY ${order}`;
  return { sql, params };
}

module.exports = { buildAggregate };
