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
const LOOKBACK_DAYS = Number(process.env.INITIAL_LOOKBACK_DAYS || 3);
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

function loadLastSync() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")).last_sync;
  } catch (_) {
    const d = new Date();
    d.setDate(d.getDate() - LOOKBACK_DAYS);
    return d.toISOString().slice(0, 10);
  }
}
function saveLastSync(date) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ last_sync: date }));
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
    log("   nimic nou");
    return;
  }
  log(`   găsit ${avize.length} avize`);

  try {
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
      timeout: 30000,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      log(`❌ HTTP ${res.status}: ${JSON.stringify(body)}`);
      return;
    }
    log(
      `✅ create=${body.linii_create} skipped=${body.skipped_duplicat} nemapate=${
        (body.unmapped_produse || []).length + (body.unmapped_magazine || []).length
      } erori=${(body.erori || []).length}`
    );

    // Avansăm cursorul la maximul din avizele trimise
    const maxDate = avize
      .map((a) => a.data_aviz)
      .sort()
      .pop();
    if (maxDate) saveLastSync(maxDate);
  } catch (e) {
    log(`❌ Eroare rețea: ${e.message}`);
  }
}

log(`Senior ERP Bridge v${VERSION} pornit — poll la fiecare ${POLL / 1000}s`);
tick();
setInterval(tick, POLL);
