require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const fetch = require("node-fetch");
const { fetchAvizeSince } = require("./db");

const VERSION = "1.0.0";
const HOSTNAME = os.hostname();
const STATE_FILE = path.join(__dirname, "..", "last-sync.json");
const LOG_DIR = path.join(__dirname, "..", "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const POLL = Number(process.env.POLL_INTERVAL_MS || 120000);
const LOOKBACK_DAYS = Number(process.env.INITIAL_LOOKBACK_DAYS || 0);
const INGEST_URL = process.env.LOVABLE_INGEST_URL;
const TOKEN = process.env.BRIDGE_TOKEN;

if (!INGEST_URL || !TOKEN || TOKEN.includes("INLOCUIESTE")) {
  console.error("❌ Config lipsă: LOVABLE_INGEST_URL sau BRIDGE_TOKEN");
  process.exit(1);
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  const file = path.join(
    LOG_DIR,
    `bridge-${new Date().toISOString().slice(0, 10)}.log`
  );
  try {
    fs.appendFileSync(file, line + "\n");
  } catch (_) {}
}

// Fereastră mobilă: la fiecare poll refetch-uim toate avizele cu Data >= azi - REFRESH_WINDOW_DAYS.
// Așa prindem și modificările făcute în Senior pe avize existente (cantități schimbate etc.).
const REFRESH_WINDOW_DAYS = Number(process.env.REFRESH_WINDOW_DAYS || 2);

function loadLastSync() {
  const d = new Date();
  d.setDate(d.getDate() - REFRESH_WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}
function saveLastSync(_date) {
  // no-op: fereastra e mereu relativă la azi
  try { fs.writeFileSync(STATE_FILE, JSON.stringify({ last_sync: _date })); } catch (_) {}
}

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000);

async function sendBatch(avize) {
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bridge-Token": TOKEN,
    },
    body: JSON.stringify({
      bridge_version: VERSION,
      bridge_host: HOSTNAME,
      avize,
    }),
    timeout: REQUEST_TIMEOUT_MS,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function tick() {
  const since = loadLastSync();
  log(`▶ Poll (since ${since})...`);
  let avize = [];
  try {
    avize = await fetchAvizeSince(since);
  } catch (e) {
    log(`❌ Eroare la citire DB Senior ERP: ${e.message}`);
    return;
  }
  if (!avize.length) {
    log("   nimic nou — trimit heartbeat");
    try {
      await sendBatch([]);
    } catch (e) {
      log(`❌ Eroare heartbeat: ${e.message}`);
    }
    return;
  }
  log(`   găsit ${avize.length} avize — trimit în batch-uri de ${BATCH_SIZE}`);

  let totCreate = 0, totSkip = 0, totErr = 0, totNemap = 0;
  const totalBatches = Math.ceil(avize.length / BATCH_SIZE);

  for (let i = 0; i < avize.length; i += BATCH_SIZE) {
    const batch = avize.slice(i, i + BATCH_SIZE);
    const idx = Math.floor(i / BATCH_SIZE) + 1;
    try {
      const body = await sendBatch(batch);
      totCreate += body.linii_create || 0;
      totSkip += body.skipped_duplicat || 0;
      totErr += (body.erori || []).length;
      totNemap +=
        (body.unmapped_produse || []).length +
        (body.unmapped_magazine || []).length;
      log(`   batch ${idx}/${totalBatches}: create=${body.linii_create} skip=${body.skipped_duplicat}`);

      const maxDate = batch.map((a) => a.data_aviz).sort().pop();
      if (maxDate) saveLastSync(maxDate);
    } catch (e) {
      log(`❌ batch ${idx}/${totalBatches}: ${e.message}`);
      return;
    }
  }

  log(`✅ Total: create=${totCreate} skipped=${totSkip} nemapate=${totNemap} erori=${totErr}`);
}

log(`Senior ERP Bridge v${VERSION} pornit — poll la fiecare ${POLL / 1000}s`);
tick();
setInterval(tick, POLL);
