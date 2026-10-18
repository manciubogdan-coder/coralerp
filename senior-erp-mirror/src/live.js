// Citire directa: preia cererile de rapoarte din Coral ERP, le ruleaza read-only in Senior si trimite rezultatul.
// Conexiunea este doar spre exterior (catre Coral ERP); nu trebuie deschise porturi in firma.
const { buildAggregate } = require("./liveQuery");

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
            log(`   🔎 ${r.kind} ${r.payload?.table || ""}: ${Array.isArray(result) ? result.length : 0} rezultate (${Date.now() - t0}ms)`);
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
