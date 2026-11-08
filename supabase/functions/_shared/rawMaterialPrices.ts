import { seniorLive } from "./senior.ts";

/**
 * Raw-material purchase price per kg from Senior NIR entries, by article code (products.cod_produs):
 * average of the last 30 days, else of the last 180 days, else the last entry. KG lines only.
 */
export async function rawMaterialPrices(sb: any, body: { codes?: unknown }) {
  const codes = Array.isArray(body?.codes) ? [...new Set(body.codes.map((c: unknown) => String(c ?? "").trim()))] : [];
  if (!codes.length || codes.length > 300 || codes.some(c => !/^[0-9A-Za-z._-]{1,30}$/.test(c))) throw new Error("Coduri de materie primă invalide.");
  const rows = await seniorLive(sb, "sql", { sql: `SELECT x.code, MAX(x.name) name,
      SUM(CASE WHEN x.day>=DATEADD(day,-30,GETDATE()) THEN x.v ELSE 0 END)/NULLIF(SUM(CASE WHEN x.day>=DATEADD(day,-30,GETDATE()) THEN x.q ELSE 0 END),0) p30,
      SUM(x.v)/NULLIF(SUM(x.q),0) p180, MAX(CASE WHEN x.rn=1 THEN x.v/NULLIF(x.q,0) END) plast, CONVERT(char(10),MAX(x.day),120) lastd
    FROM (SELECT a.Cod code, a.Denumire name, h.Data day, CAST(d.Valoare_Neta_Rol AS float) v, CAST(d.Cantitate AS float) q,
        ROW_NUMBER() OVER(PARTITION BY a.Cod ORDER BY h.Data DESC, h.H_ID DESC, d.D_ID DESC) rn
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
      JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID JOIN dbo.D_Articole a WITH (NOLOCK) ON a.Articol_ID=d.Articol_ID
      JOIN dbo.D_Articole_UM um WITH (NOLOCK) ON um.UM_ID=d.UM_ID
      WHERE t.Cod='NIR' AND ISNULL(h.Anulat,0)=0 AND d.Cantitate>0 AND d.Valoare_Neta_Rol>0 AND um.Cod='KG'
        AND h.Data>=DATEADD(day,-180,GETDATE()) AND a.Cod IN (${codes.map(c => `N'${c}'`).join(",")})) x
    GROUP BY x.code` }, 55000);
  if (!Array.isArray(rows)) throw new Error("Răspuns Senior invalid pentru prețurile materiilor prime.");
  return {
    prices: rows.map((r: any) => {
      const p30 = Number(r.p30), p180 = Number(r.p180), last = Number(r.plast);
      const price = p30 > 0 ? p30 : p180 > 0 ? p180 : last > 0 ? last : null;
      return { code: String(r.code), name: String(r.name ?? ""), pricePerKg: price, basis: p30 > 0 ? "medie NIR 30 zile" : p180 > 0 ? "medie NIR 180 zile" : "ultima intrare NIR", lastDay: r.lastd ?? null };
    }).filter(p => p.pricePerKg != null),
  };
}
