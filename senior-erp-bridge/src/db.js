// Conectare & citire avize din Senior ERP.
// !!! Interogarea SQL de mai jos este un ȘABLON. După ce primim structura reală
//     a tabelelor din Senior ERP, se înlocuiește query-ul cu unul potrivit.
//     Coloanele returnate DE OBLIGATORIU:
//       nr_aviz, data_aviz (ISO date), cod_magazin, nume_magazin,
//       cod_produs, denumire_produs, cantitate, um
require("dotenv").config();

const type = (process.env.ERP_DB_TYPE || "postgres").toLowerCase();

let query;
let close;

if (type === "postgres") {
  const { Pool } = require("pg");
  const pool = new Pool({
    host: process.env.ERP_DB_HOST,
    port: Number(process.env.ERP_DB_PORT || 5432),
    database: process.env.ERP_DB_NAME,
    user: process.env.ERP_DB_USER,
    password: process.env.ERP_DB_PASSWORD,
    ssl: process.env.ERP_DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
  query = async (sql, params) => {
    const res = await pool.query(sql, params);
    return res.rows;
  };
  close = () => pool.end();
} else if (type === "mysql") {
  const mysql = require("mysql2/promise");
  let pool;
  const getPool = async () => {
    if (!pool) {
      pool = await mysql.createPool({
        host: process.env.ERP_DB_HOST,
        port: Number(process.env.ERP_DB_PORT || 3306),
        database: process.env.ERP_DB_NAME,
        user: process.env.ERP_DB_USER,
        password: process.env.ERP_DB_PASSWORD,
        ssl: process.env.ERP_DB_SSL === "true" ? {} : undefined,
        waitForConnections: true,
        connectionLimit: 5,
      });
    }
    return pool;
  };
  query = async (sql, params) => {
    const p = await getPool();
    const [rows] = await p.query(sql, params);
    return rows;
  };
  close = async () => {
    if (pool) await pool.end();
  };
} else {
  throw new Error(`ERP_DB_TYPE necunoscut: ${type}`);
}

// ============================================================
// ȘABLON: adaptează după structura reală Senior ERP
// ============================================================
// Presupunem 2 tabele: avize (antet) și avize_linii (produse).
// Placeholder-ul $1 e pentru Postgres; MySQL folosește ?.
// Funcția `fetchAvizeSince` returnează avize cu linii, filtrate după data.
async function fetchAvizeSince(sinceDate) {
  const isPg = type === "postgres";
  const ph = isPg ? "$1" : "?";

  const sqlAntet = `
    SELECT
      a.nr_aviz         AS nr_aviz,
      a.data_aviz       AS data_aviz,
      a.cod_client      AS cod_magazin,
      a.nume_client     AS nume_magazin,
      a.observatie      AS observatie
    FROM avize a
    WHERE a.data_aviz >= ${ph}
    ORDER BY a.data_aviz ASC, a.nr_aviz ASC
  `;
  const antete = await query(sqlAntet, [sinceDate]);
  if (!antete.length) return [];

  const nrs = antete.map((a) => a.nr_aviz);
  const placeholders = isPg
    ? nrs.map((_, i) => `$${i + 1}`).join(",")
    : nrs.map(() => "?").join(",");

  const sqlLinii = `
    SELECT
      l.nr_aviz         AS nr_aviz,
      l.cod_produs      AS cod_produs,
      l.denumire_produs AS denumire_produs,
      l.cantitate       AS cantitate,
      l.um              AS um,
      l.observatie      AS observatie
    FROM avize_linii l
    WHERE l.nr_aviz IN (${placeholders})
  `;
  const linii = await query(sqlLinii, nrs);

  const byAviz = new Map();
  antete.forEach((a) => {
    byAviz.set(a.nr_aviz, {
      nr_aviz: String(a.nr_aviz),
      data_aviz:
        a.data_aviz instanceof Date
          ? a.data_aviz.toISOString().slice(0, 10)
          : String(a.data_aviz).slice(0, 10),
      cod_magazin: a.cod_magazin ? String(a.cod_magazin) : "",
      nume_magazin: String(a.nume_magazin || "").trim(),
      observatie: a.observatie || null,
      linii: [],
    });
  });
  linii.forEach((l) => {
    const aviz = byAviz.get(l.nr_aviz);
    if (!aviz) return;
    aviz.linii.push({
      cod_produs: String(l.cod_produs || "").trim(),
      denumire_produs: l.denumire_produs || null,
      cantitate: Number(l.cantitate) || 0,
      um: l.um || null,
      observatie: l.observatie || null,
    });
  });

  return Array.from(byAviz.values()).filter((a) => a.linii.length > 0);
}

module.exports = { fetchAvizeSince, close };
