// Citire directa: preia cererile de rapoarte din Coral ERP, le ruleaza read-only in Senior si trimite rezultatul.
// Conexiunea este doar spre exterior (catre Coral ERP); nu trebuie deschise porturi in firma.
const { buildAggregate, checkFreeSql } = require("./liveQuery");

const MAX_ROWS = 5000;

function createLive({ select, api, log, tableName, pgName, pgType, skipTypes }) {
  let catalog = null; // Map table -> { schema, name, rows, columns:[{name, src, type}] }
  let catalogAt = 0;

  async function loadCatalog() {
    const cols = await select(`SELECT c.TABLE_SCHEMA AS s, c.TABLE_NAME AS n, c.COLUMN_NAME AS col, c.DATA_TYPE AS type
      FROM INFORMATION_SCHEMA.COLUMNS c JOIN INFORMATION_SCHEMA.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
      WHERE t.TABLE_TYPE = 'BASE TABLE' ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`);
    const counts = await select(`SELECT s.name AS s, t.name AS n, SUM(p.rows) AS c FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
      GROUP BY s.name, t.name`);
    const rowCount = new Map(counts.map((r) => [`${r.s}.${r.n}`, Number(r.c || 0)]));
    const map = new Map();
    for (const r of cols) {
      if (skipTypes.includes(String(r.type).toLowerCase())) continue;
      const key = tableName(r.s, r.n);
      if (!map.has(key)) map.set(key, { schema: r.s, name: r.n, rows: rowCount.get(`${r.s}.${r.n}`) || 0, columns: [], used: new Set() });
      const t = map.get(key);
      let p = pgName(r.col);
      while (t.used.has(p) || ["_pk", "_run", "_synced_at"].includes(p)) p = (p + "_").slice(-63);
      t.used.add(p);
      t.columns.push({ name: p, src: r.col, type: pgType(r.type) });
    }
    catalog = map;
    catalogAt = Date.now();
    return [...map.entries()].map(([table, t]) => ({
      table, source: `${t.schema}.${t.name}`, rows: t.rows, synced_at: new Date().toISOString(), error: null,
      columns: t.columns.map(({ name, type }) => ({ name, type })),
    }));
  }

  const clean = (v) => (v instanceof Date ? v.toISOString().slice(0, 19).replace("T", " ") : typeof v === "bigint" ? Number(v) : v);

  async function handle(reqItem) {
    if (reqItem.kind === "catalog") return loadCatalog();
    if (reqItem.kind === "aggregate") {
      if (!catalog || Date.now() - catalogAt > 6 * 3600_000 || !catalog.has(reqItem.payload.table)) await loadCatalog();
      const { sql, params } = buildAggregate(reqItem.payload, catalog.get(reqItem.payload.table));
      const rows = await select(sql, params);
      return rows.slice(0, MAX_ROWS).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, clean(v)])));
    }
    if (reqItem.kind === "sql") {
      const rows = await select(checkFreeSql(reqItem.payload.sql));
      return rows.slice(0, 500).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, clean(v)])));
    }
    if (reqItem.kind === "pnl") {
      if (!catalog || Date.now() - catalogAt > 6 * 3600_000) await loadCatalog();
      const a = catalog.get("accountingstatistics"), p = catalog.get("c_plan_contabil");
      if (!a || !p) throw new Error("Balanta nu a fost gasita in Senior.");
      const y = Math.trunc(Number(reqItem.payload.year));
      if (!(y > 2000 && y < 2100)) throw new Error("An invalid.");
      const T = (m) => `[${m.schema}].[${m.name}]`;
      const rows = await select(`SELECT a.PeriodId AS period, p.Cont AS cont, MAX(p.Descriere) AS name,
        SUM(CASE WHEN p.Cont LIKE '7%' THEN CAST(a.CreditTurnover AS float) - CAST(a.DebitTurnover AS float) ELSE 0 END) AS rev,
        SUM(CASE WHEN p.Cont LIKE '6%' THEN CAST(a.DebitTurnover AS float) - CAST(a.CreditTurnover AS float) ELSE 0 END) AS exp
        FROM ${T(a)} a WITH (NOLOCK) JOIN ${T(p)} p WITH (NOLOCK) ON p.Analitic_ID = a.AnaliticId
        WHERE a.TipSubiectId = 1 AND (p.Cont LIKE '6%' OR p.Cont LIKE '7%') AND LEN(a.PeriodId) = 6
          AND LEFT(a.PeriodId, 4) IN (@y1, @y2)
        GROUP BY a.PeriodId, p.Cont`, { y1: String(y), y2: String(y - 1) });
      const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
      const accounts = rows.map((r) => ({ period: String(r.period), cont: r.cont, name: r.name, rev: r2(r.rev), exp: r2(r.exp) })).filter((r) => r.rev || r.exp);
      const byMonth = new Map();
      for (const x of accounts) { const m = byMonth.get(x.period) || { period: x.period, y: Number(x.period.slice(0, 4)), revenue: 0, expenses: 0 }; m.revenue += x.rev; m.expenses += x.exp; byMonth.set(x.period, m); }
      const months = [...byMonth.values()].map((m) => ({ ...m, revenue: r2(m.revenue), expenses: r2(m.expenses) })).sort((a, b) => a.period.localeCompare(b.period));
      const top = (k, pre) => { const t = new Map(); for (const x of accounts) if (x.period.startsWith(String(y)) && x.cont.startsWith(pre)) { const c = t.get(x.cont) || { cont: x.cont, name: x.name, value: 0 }; c.value += x[k]; t.set(x.cont, c); } return [...t.values()].map((c) => ({ ...c, value: r2(c.value) })).sort((a, b) => b.value - a.value).slice(0, 10); };
      return { months, accounts, top_revenue: top("rev", "7"), top_expenses: top("exp", "6"), last_period: months.at(-1)?.period ?? null, live: true };
    }
    throw new Error("Tip de cerere necunoscut.");
  }

  async function loop() {
    log("🔎 Citire directa pornita — astept cereri de rapoarte din Coral ERP");
    let quietErrors = 0;
    for (;;) {
      try {
        const { requests = [] } = await api({ action: "live_pull" });
        quietErrors = 0;
        await Promise.all(requests.map(async (r) => {
          const t0 = Date.now();
          try {
            const result = await handle(r);
            await api({ action: "live_result", id: r.id, result });
            log(`   🔎 ${r.kind} ${r.payload?.table || ""}: ${Array.isArray(result) ? result.length : result?.months?.length ?? 0} rezultate (${Date.now() - t0}ms)`);
          } catch (e) {
            log(`   ⚠ citire directa ${r.kind}: ${e.message}`);
            await api({ action: "live_result", id: r.id, error: e.message }).catch(() => {});
          }
        }));
        await new Promise((res) => setTimeout(res, requests.length ? 200 : 1000));
      } catch (e) {
        if (quietErrors++ % 30 === 0) log(`   ⚠ citire directa: ${e.message}`);
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
  }

  return { loop, handle };
}

module.exports = { createLive };
