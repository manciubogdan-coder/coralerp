// Conectare & citire COMENZI REALE din Senior ERP (C_H_Note_Contabile & C_D_Note_Contabile)
require("dotenv").config();

const type = (process.env.ERP_DB_TYPE || "mssql").toLowerCase();

let query;
let close;

if (type === "mssql" || type === "sqlserver") {
  const mssql = require("mssql");
  let pool;

  const getPool = async () => {
    if (!pool) {
      const config = {
        server: process.env.ERP_DB_HOST,
        database: process.env.ERP_DB_NAME,
        user: process.env.ERP_DB_USER,
        password: process.env.ERP_DB_PASSWORD,
        options: {
          encrypt: process.env.ERP_DB_SSL === "true",
          trustServerCertificate: true,
          enableArithAbort: true,
          connectTimeout: 30000,
        },
        pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      };
      pool = await mssql.connect(config);
    }
    return pool;
  };

  query = async (sql, params) => {
    const p = await getPool();
    const request = p.request();
    if (params && params.length) {
      params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });
    }
    const res = await request.query(sql);
    return res.recordset;
  };

  close = async () => {
    if (pool) await pool.close();
  };
} else {
  throw new Error(`Suport exclusiv mssql.`);
}

async function fetchAvizeSince(sinceDate) {
  // 1. Antet comenzi CC din C_H_Note_Contabile
  const sqlAntet = `
    SELECT
      h.H_Id                        AS nr_aviz,
      h.Data                        AS data_aviz,
      h.Numar_Document_Primar       AS nr_document_text,
      p.cod                         AS cod_magazin,
      p.denumire                    AS nume_magazin,
      h.Descriere                   AS observatie
    FROM [dbo].[C_H_Note_Contabile] h
    LEFT JOIN [dbo].[D_Parteneri] p ON h.PartenerId = p.partener_id
    WHERE h.[Anulat] = 0
      AND h.[Serie_Document_Primar] = 'CC'
      AND h.[Created_On] >= @param0
    ORDER BY h.[Created_On] ASC
  `;

  const antete = await query(sqlAntet, [sinceDate]);
  if (!antete || !antete.length) return [];

  const nrs = antete.map((a) => a.nr_aviz);
  const placeholders = nrs.map((_, i) => `@param${i}`).join(",");

  // 2. Linii produse din C_D_Note_Contabile
  const sqlLinii = `
    SELECT
      l.H_Id                        AS nr_aviz,
      l.Cod                         AS cod_produs,
      l.Denumire                    AS denumire_produs,
      l.Cantitate                   AS cantitate,
      l.UM_Id                       AS um,
      l.Descriere                   AS observatie
    FROM [dbo].[C_D_Note_Contabile] l
    WHERE l.H_Id IN (${placeholders})
  `;

  const linii = await query(sqlLinii, nrs);

  const byAviz = new Map();
  antete.forEach((a) => {
    byAviz.set(a.nr_aviz, {
      // Trimitem nr_document_text (ex: 103271) ca cheie vizibilă în aplicație
      nr_aviz: String(a.nr_document_text || a.nr_aviz),
      data_aviz:
        a.data_aviz instanceof Date
          ? a.data_aviz.toISOString()
          : String(a.data_aviz),
      cod_magazin: a.cod_magazin ? String(a.cod_magazin) : "",
      nume_magazin: String(a.nume_magazin || "Client Direct").trim(),
      observatie: a.observatie || null,
      linii: [],
    });
  });

  if (linii && linii.length) {
    linii.forEach((l) => {
      const aviz = byAviz.get(l.nr_aviz);
      if (!aviz) return;
      aviz.linii.push({
        cod_produs: String(l.cod_produs || "").trim(),
        denumire_produs: l.denumire_produs || "Produs Fără Nume",
        cantitate: Number(l.cantitate) || 0,
        um: l.um ? String(l.um) : null,
        observatie: l.observatie || null,
      });
    });
  }

  return Array.from(byAviz.values()).filter((a) => a.linii.length > 0);
}

module.exports = { fetchAvizeSince, close };
