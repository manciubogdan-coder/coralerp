import { seniorSqlAll } from "../_shared/senior.ts";

const day = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null;
const shift = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

const BASE = `FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
  JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
  WHERE t.Cod='AEC' AND ISNULL(h.Anulat,0)=0`;

/**
 * Client returns = negative lines on Senior shipping notes (AEC); the reason is the line description.
 * Goods shipped on day D come back on D+lag, so returns are read from start+lag to end+lag and
 * compared with the shipments of start..end.
 */
export async function returnsReport(cloud: any, body: any) {
  const start = day(body?.start), end = day(body?.end);
  const lag = Number.isInteger(body?.lag) && body.lag >= 0 && body.lag <= 3 ? body.lag : 1;
  if (!start || !end || start > end) throw new Error("Perioadă invalidă.");
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 370) throw new Error("Perioada maximă este un an.");
  const rs = shift(start, lag), re = shift(end, lag);
  const [returns, shipped, shippedDays] = await Promise.all([
    seniorSqlAll(cloud, `SELECT d.D_ID id, CONVERT(char(10), h.Data, 120) day,
        LTRIM(RTRIM(ISNULL(h.Serie_Document_Primar,'')+' '+ISNULL(CAST(h.Numar_Document_Primar AS nvarchar(40)),''))) doc,
        pp.Partener_Denumire partner, d.Denumire art, CAST(-d.Cantitate AS float) q, CAST(-d.Valoare_Neta_ROL AS float) v,
        LTRIM(RTRIM(ISNULL(d.Descriere,''))) reason
      ${BASE} AND d.Cantitate<0 AND h.Data>='${rs}' AND h.Data<DATEADD(day,1,'${re}')`, "h.Data, d.D_ID"),
    seniorSqlAll(cloud, `SELECT pp.Partener_Denumire partner, d.Denumire art, SUM(CAST(d.Cantitate AS float)) q, SUM(CAST(d.Valoare_Neta_ROL AS float)) v
      ${BASE} AND d.Cantitate>0 AND h.Data>='${start}' AND h.Data<DATEADD(day,1,'${end}')
      GROUP BY pp.Partener_Denumire, d.Denumire`, "pp.Partener_Denumire, d.Denumire"),
    seniorSqlAll(cloud, `SELECT CONVERT(char(10), h.Data, 120) day, SUM(CAST(d.Cantitate AS float)) q, SUM(CAST(d.Valoare_Neta_ROL AS float)) v
      ${BASE} AND d.Cantitate>0 AND h.Data>='${start}' AND h.Data<DATEADD(day,1,'${end}')
      GROUP BY CONVERT(char(10), h.Data, 120)`, "CONVERT(char(10), h.Data, 120)"),
  ]);
  return { start, end, lag, returnStart: rs, returnEnd: re, returns, shipped, shippedDays };
}
