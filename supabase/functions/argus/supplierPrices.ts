import { seniorSqlAll } from "../_shared/senior.ts";
import { supplierPriceList } from "./supplierPriceStore.ts";
export { supplierPriceList, saveSupplierPriceList } from "./supplierPriceStore.ts";

const day = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null;
const lit = (s: string) => `N'${s.replace(/'/g, "''")}'`;

/** Real supplier invoice lines (FF/FFI/FFIC) in Senior for the listed products, with the EUR unit price actually billed. */
export async function supplierPriceAudit(cloud: any, body: any) {
  const start = day(body?.start), end = day(body?.end);
  if (!start || !end || start > end) throw new Error("Perioadă invalidă.");
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 370) throw new Error("Perioada maximă este un an.");
  const { list } = await supplierPriceList(cloud);
  const names = [...new Set([...((list.items ?? []).map((i: any) => String(i.product))),
    ...(list.periods ?? []).flatMap((p: any) => p.items.map((i: any) => String(i.product)))])] as string[];
  if (!names.length) return { lines: [] };
  const lines = await seniorSqlAll(cloud, `SELECT d.D_ID id, CONVERT(char(10), h.Data, 120) day, t.Cod tip,
      LTRIM(RTRIM(ISNULL(h.Serie_Document_Primar,'')+' '+ISNULL(CAST(h.Numar_Document_Primar AS nvarchar(40)),''))) doc,
      pp.Partener_Denumire sup, d.Denumire art, um.Cod um, CAST(d.Cantitate AS float) q,
      CAST(d.Pret_Final_ROL AS float) pron, CAST(d.Valoare_Neta_ROL AS float) vron,
      CASE WHEN x.fx=1 THEN CAST(d.Pret_Final_Valuta AS float) ELSE CAST(d.Pret_Final_ROL AS float)/NULLIF(r.rate,0) END peur,
      CASE WHEN x.fx=1 THEN CAST(d.Pret_Referinta_Valuta AS float) END pref,
      CASE WHEN x.fx=1 THEN 'EUR' ELSE 'RON' END cur, CASE WHEN x.fx=1 THEN CAST(d.CursValutaReferinta AS float) ELSE r.rate END rate
    FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
    JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
    JOIN dbo.D_Articole_UM um WITH (NOLOCK) ON um.UM_ID=d.UM_ID LEFT JOIN dbo.D_Valuta v WITH (NOLOCK) ON v.Valuta_ID=d.Valuta_Id_Lista_Preturi
    -- A line is billed in EUR only when its currency price differs from its lei price (RON invoices repeat the lei price).
    CROSS APPLY (SELECT CASE WHEN v.Simbol='EUR' AND ABS(ISNULL(d.Pret_Final_ROL,0)-ISNULL(d.Pret_Final_Valuta,0))>0.001 THEN 1 ELSE 0 END fx) x
    OUTER APPLY (SELECT TOP 1 CAST(c.Curs AS float) rate FROM dbo.D_Valuta_Cursuri c WITH (NOLOCK) JOIN dbo.D_Valuta ve WITH (NOLOCK) ON ve.Valuta_ID=c.Valuta_ID
      JOIN dbo.D_Valuta_Cursuri_Tipuri tt WITH (NOLOCK) ON tt.Valuta_Cursuri_Tipuri_ID=c.Valuta_Cursuri_Tipuri_ID
      WHERE ve.Simbol='EUR' AND tt.Descriere='BNR' AND c.Data<=h.Data ORDER BY c.Data DESC) r
    WHERE t.Cod IN ('FF','FFI','FFIC') AND ISNULL(h.Anulat,0)=0 AND h.Data>='${start}' AND h.Data<DATEADD(day,1,'${end}')
      AND d.Cantitate<>0 AND d.Denumire IN (${names.map(lit).join(",")})`, "h.Data, d.D_ID", 55000);
  return { lines, list };
}
