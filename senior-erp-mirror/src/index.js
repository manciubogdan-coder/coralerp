// Senior ERP Mirror — oglindeste TOATE tabelele din Senior ERP (SQL Server) in Coral ERP.
// Conexiunea la ERP este strict READ-ONLY: doar SELECT, ApplicationIntent=ReadOnly, NOLOCK.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const mssql = require("mssql");
const fetch = require("node-fetch");

const VERSION = "1.4.0";
const ROOT = path.join(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const STATE_FILE = path.join(ROOT, "mirror-state.json");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const URL = process.env.MIRROR_URL;
const TOKEN = process.env.BRIDGE_TOKEN;
const CHUNK = Number(process.env.CHUNK_SIZE || 1000);
const CHUNK_DELAY_MS = Number(process.env.CHUNK_DELAY_MS || 300);
const INTERVAL_MIN = Number(process.env.MIRROR_INTERVAL_MIN || 30);
const ONCE = process.argv.includes("--once");
if (!URL || !TOKEN || TOKEN.includes("INLOCUIESTE")) {
  console.error("❌ Config lipsa: MIRROR_URL sau BRIDGE_TOKEN in .env");
  process.exit(1);
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(path.join(LOG_DIR, `mirror-${new Date().toISOString().slice(0, 10)}.log`), line + "\n"); } catch (_) {}
}
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; } };
const saveState = (s) => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 1)); } catch (_) {} };

// ---------- conexiune READ-ONLY ----------
let pool;
// Incearca mai multe variante de conectare (instanta numita, port fix, fara ReadOnlyIntent)
// si reincearca, ca o problema de moment a retelei/SQL Browser sa nu opreasca oglindirea.
function connectVariants() {
  let host = process.env.ERP_DB_HOST || "";
  let instance = process.env.ERP_DB_INSTANCE || "";
  const m = host.match(/^([^/\\]+)[/\\](.+)$/);
  if (m) { host = m[1]; instance = m[2]; }
  const port = Number(process.env.ERP_DB_PORT || 0) || undefined;
  const base = (opts, p, label) => ({
    label,
    cfg: {
      server: host,
      port: p,
      database: process.env.ERP_DB_NAME,
      user: process.env.ERP_DB_USER,
      password: process.env.ERP_DB_PASSWORD,
      requestTimeout: 0,
      connectionTimeout: 60000,
      options: {
        encrypt: process.env.ERP_DB_SSL === "true",
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 60000,
        ...opts,
      },
      pool: { max: 2, min: 0, idleTimeoutMillis: 60000 },
    },
  });
  const v = [];
  // 1) Exact ca bridge-ul existent (care merge): hostul din .env neschimbat, fara port, fara ReadOnlyIntent.
  const raw = process.env.ERP_DB_HOST || "";
  v.push({ label: `${raw} (ca bridge-ul)`, cfg: {
    server: raw, database: process.env.ERP_DB_NAME, user: process.env.ERP_DB_USER,
    password: process.env.ERP_DB_PASSWORD, requestTimeout: 0,
    options: { encrypt: process.env.ERP_DB_SSL === "true", trustServerCertificate: true, enableArithAbort: true, connectTimeout: 30000 },
    pool: { max: 2, min: 0, idleTimeoutMillis: 60000 },
  } });
  if (instance) v.push(base({}, 1433, `${host}:1433`));
  if (instance && !port) {
    v.push(base({ instanceName: instance, readOnlyIntent: true }, undefined, `${host}\\${instance}`));
    v.push(base({ instanceName: instance }, undefined, `${host}\\${instance} (fara ReadOnlyIntent)`));
  }
  if (port) v.push(base({ readOnlyIntent: true }, port, `${host}:${port}`));
  if (!instance && !port) v.push(base({ readOnlyIntent: true }, 1433, `${host}:1433`));
  return v;
}
async function getPool() {
  if (pool) return pool;
  const variants = connectVariants();
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const { label, cfg } of variants) {
      try {
        const p = new mssql.ConnectionPool(cfg);
        await p.connect();
        log(`🔌 Conectat la ${label}`);
        pool = p;
        return pool;
      } catch (e) {
        lastErr = e;
        log(`   ⚠ conectare ${label} (incercarea ${attempt}/3): ${e.code || ""} ${e.message}${e.originalError?.message ? " | " + e.originalError.message : ""}`);
      }
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 20000));
  }
  throw lastErr;
}
// Garda: orice interogare trimisa catre ERP trebuie sa fie SELECT.
function assertSelect(sql) {
  const s = sql.trim().toUpperCase();
  if (!s.startsWith("SELECT") || /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|GRANT)\b/.test(s.replace(/'[^']*'/g, ""))) {
    throw new Error("Interogare interzisa (doar SELECT): " + sql.slice(0, 80));
  }
}
async function select(sql, params = {}) {
  assertSelect(sql);
  const r = (await getPool()).request();
  Object.entries(params).forEach(([k, v]) => r.input(k, v));
  return (await r.query(sql)).recordset;
}

// ---------- Coral ERP ----------
// Un lot esuat din cauza retelei NU mai opreste tabelul: reincercam de pana la 10 ori,
// cu pauze crescande (max 60s). Abia dupa 10 esecuri consecutive renuntam la tabel.
async function api(payload, attempt = 1) {
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Token": TOKEN },
      body: JSON.stringify(payload),
      timeout: 180000,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.error || JSON.stringify(body)}`);
    return body;
  } catch (e) {
    if (attempt < 10 && !/HTTP 4\d\d/.test(e.message)) {
      const wait = Math.min(60000, attempt * 10000);
      log(`   ⚠ lot esuat (${e.message}) — reincercarea ${attempt}/10 peste ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      return api(payload, attempt + 1);
    }
    throw e;
  }
}

// ---------- mapare ----------
const pgName = (s) => String(s).toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+/, "").slice(0, 63) || "col";
const tableName = (schema, name) => pgName(schema.toLowerCase() === "dbo" ? name : `${schema}__${name}`);
function pgType(t) {
  t = t.toLowerCase();
  if (["int", "bigint", "smallint", "tinyint"].includes(t)) return "bigint";
  if (["decimal", "numeric", "money", "smallmoney", "float", "real"].includes(t)) return "numeric";
  if (t === "bit") return "boolean";
  if (t === "date") return "date";
  if (["datetime", "datetime2", "smalldatetime"].includes(t)) return "timestamp";
  if (t === "datetimeoffset") return "timestamptz";
  return "text";
}
const SKIP_TYPES = ["geography", "geometry", "hierarchyid", "sql_variant"];
function toValue(v) {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return "0x" + v.toString("hex");
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString().replace("Z", "");
  if (typeof v === "number" && !isFinite(v)) return null;
  if (typeof v === "string") return v.replace(/\u0000/g, "");
  return v;
}
function matchList(full, list) {
  return list.some((p) => new RegExp("^" + p.trim().replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i").test(full));
}

// ---------- descoperire tabele ----------
async function listTables() {
  const rows = await select(`
    SELECT TABLE_SCHEMA AS s, TABLE_NAME AS n FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME`);
  const inc = (process.env.INCLUDE_TABLES || "").split(",").filter((x) => x.trim());
  const exc = (process.env.EXCLUDE_TABLES || "").split(",").filter((x) => x.trim());
  return rows.filter((r) => {
    const full = `${r.s}.${r.n}`;
    if (inc.length && !matchList(full, inc)) return false;
    return !(exc.length && matchList(full, exc));
  });
}
async function describe(s, n) {
  const cols = await select(`
    SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @s AND TABLE_NAME = @n ORDER BY ORDINAL_POSITION`, { s, n });
  const pk = await select(`
    SELECT k.COLUMN_NAME AS name FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS c
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON k.CONSTRAINT_NAME = c.CONSTRAINT_NAME
      AND k.TABLE_SCHEMA = c.TABLE_SCHEMA AND k.TABLE_NAME = c.TABLE_NAME
    WHERE c.CONSTRAINT_TYPE = 'PRIMARY KEY' AND c.TABLE_SCHEMA = @s AND c.TABLE_NAME = @n
    ORDER BY k.ORDINAL_POSITION`, { s, n });
  const used = new Set();
  const out = cols.filter((c) => !SKIP_TYPES.includes(c.type.toLowerCase())).map((c) => {
    let p = pgName(c.name);
    while (used.has(p) || ["_pk", "_run", "_synced_at"].includes(p)) p = (p + "_").slice(-63);
    used.add(p);
    return { src: c.name, name: p, type: pgType(c.type), srcType: c.type };
  });
  return { cols: out, pk: pk.map((p) => p.name) };
}
const q = (id) => "[" + String(id).replace(/]/g, "]]") + "]";

// Numar aproximativ de randuri din metadate (instant, fara scanare).
async function approxRows(s, n) {
  try {
    const r = await select(`SELECT SUM(p.rows) AS c FROM sys.partitions p
      WHERE p.object_id = OBJECT_ID(@full) AND p.index_id IN (0, 1)`, { full: `${q(s)}.${q(n)}` });
    return Number(r[0]?.c || 0);
  } catch { return -1; }
}

async function fingerprint(s, n) {
  try {
    const r = await select(`SELECT COUNT_BIG(*) AS c, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS h FROM ${q(s)}.${q(n)} WITH (NOLOCK)`);
    return `${r[0].c}:${r[0].h}`;
  } catch {
    return null; // nu se poate calcula — sincronizam mereu
  }
}

const STALL_MS = Number(process.env.STALL_MINUTES || 10) * 60000;

// ---------- sincronizare tabel (streaming, in loturi) ----------
async function syncTable(run, s, n, state) {
  const table = tableName(s, n);
  const key = `${s}.${n}`;
  const { cols, pk } = await describe(s, n);
  if (!cols.length) return { skipped: true };

  const approx = await approxRows(s, n);
  if (approx > 50000) log(`   … ${key}: ~${approx.toLocaleString("ro-RO")} randuri, verific daca s-a schimbat`);
  const fp = await fingerprint(s, n);
  if (fp && state[key]?.fp === fp && state[key]?.cols === cols.length) return { skipped: true };
  if (approx > 50000) log(`   … ${key}: incep copierea`);

  await api({ action: "ensure_table", table, source: key, columns: cols.map(({ name, type }) => ({ name, type })), pk });

  const pkCols = pk.map((p) => cols.find((c) => c.src === p)).filter(Boolean);
  const sql = `SELECT ${cols.map((c) => q(c.src)).join(", ")} FROM ${q(s)}.${q(n)} WITH (NOLOCK)`;
  assertSelect(sql);

  const request = (await getPool()).request();
  request.stream = true;
  let buf = [], total = 0, failed = null, sending = Promise.resolve();
  let lastActivity = Date.now(), lastProgress = Date.now();
  const dup = new Map();

  const flush = (rows) => api({ action: "upsert", table, run, rows });

  await new Promise((resolve) => {
    let finished = false;
    const finish = () => { if (!finished) { finished = true; clearInterval(watch); resolve(); } };
    // Paza: daca nu vine nimic din ERP sau din Coral ERP mai mult de STALL_MINUTES, oprim tabelul.
    const watch = setInterval(() => {
      if (Date.now() - lastActivity > STALL_MS) {
        failed = failed || new Error(`blocat peste ${STALL_MS / 60000} min (dupa ${total} randuri) — trec mai departe`);
        try { request.cancel(); } catch (_) {}
        finish();
      }
    }, 15000);
    request.on("row", (r) => {
      lastActivity = Date.now();
      const row = {};
      for (const c of cols) row[c.name] = toValue(r[c.src]);
      let k;
      if (pkCols.length) k = pkCols.map((c) => String(row[c.name])).join("|");
      else {
        const h = crypto.createHash("sha1").update(JSON.stringify(row)).digest("hex");
        const i = (dup.get(h) || 0) + 1;
        dup.set(h, i);
        k = i > 1 ? `${h}#${i}` : h;
      }
      row._pk = k;
      buf.push(row);
      if (buf.length >= CHUNK) {
        const batch = buf; buf = [];
        request.pause();
        sending = sending.then(() => failed ? null : flush(batch)).then(() => {
          total += batch.length; lastActivity = Date.now();
          if (Date.now() - lastProgress > 30000) {
            lastProgress = Date.now();
            log(`   … ${key}: ${total.toLocaleString("ro-RO")}${approx > 0 ? " / ~" + approx.toLocaleString("ro-RO") : ""} randuri trimise`);
          }
          request.resume();
        }).catch((e) => { failed = failed || e; try { request.cancel(); } catch (_) {} finish(); });
      }
    });
    request.on("error", (e) => { failed = failed || e; finish(); });
    request.on("done", finish);
    request.query(sql);
  });
  await sending.catch(() => {});
  if (failed) throw failed;
  if (buf.length) { await flush(buf); total += buf.length; }

  // Rândurile care nu mai exista in ERP sunt sterse din oglinda (doar dupa citire completa).
  const fin = await api({ action: "finish_table", table, run, rows: total });
  state[key] = { fp, cols: cols.length, rows: total, at: new Date().toISOString() };
  saveState(state);
  return { rows: total, deleted: fin.deleted || 0 };
}

// ---------- ciclu ----------
let running = false;
async function cycle() {
  if (running) return log("⏳ Ciclul anterior inca ruleaza — sar.");
  running = true;
  const run = crypto.randomUUID();
  const state = loadState();
  const errors = [];
  let synced = 0, skipped = 0, rows = 0;
  try {
    const tables = await listTables();
    log(`▶ Oglindire pornita — ${tables.length} tabele`);
    await api({ action: "log", run, data: { host: os.hostname(), tables_total: tables.length } });
    let idx = 0;
    for (const t of tables) {
      idx++;
      const t0 = Date.now();
      if (idx % 50 === 0) log(`   — progres: ${idx}/${tables.length} tabele (${synced} copiate, ${skipped} neschimbate)`);
      try {
        const r = await syncTable(run, t.s, t.n, state);
        if (r.skipped) { skipped++; continue; }
        synced++; rows += r.rows;
        log(`   ✓ ${t.s}.${t.n}: ${r.rows} randuri, ${r.deleted} sterse (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      } catch (e) {
        errors.push({ table: `${t.s}.${t.n}`, error: e.message });
        log(`   ❌ ${t.s}.${t.n}: ${e.message}`);
        api({ action: "log", run, data: { table_error: { table: tableName(t.s, t.n), error: e.message } } }).catch(() => {});
      }
    }
  } catch (e) {
    errors.push({ table: "*", error: e.message });
    log(`❌ ${e.message}`);
    try { await pool?.close(); } catch (_) {}
    pool = null;
  }
  await api({ action: "log", run, data: { finished: true, tables_synced: synced, tables_skipped: skipped, rows_synced: rows, errors } }).catch(() => {});
  log(`✅ Gata: ${synced} sincronizate, ${skipped} neschimbate, ${rows} randuri, ${errors.length} erori`);
  running = false;
}

log(`Senior ERP Mirror v${VERSION} — interval ${INTERVAL_MIN} min, lot ${CHUNK}`);
cycle().then(() => { if (ONCE) process.exit(0); });
if (!ONCE) setInterval(cycle, INTERVAL_MIN * 60000);
