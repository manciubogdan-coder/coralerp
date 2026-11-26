import { seniorSqlAll } from "../_shared/senior.ts";
import { bucharestDay, startIso, endIso, fetchAll } from "../_shared/appData.ts";
import { createProductionMatcher, type ProductionWork } from "../_shared/returnsProduction.ts";

const day = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null;
const shift = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

const BASE = `FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
  JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
  WHERE t.Cod='AEC' AND ISNULL(h.Anulat,0)=0`;

/**
 * Client returns = negative lines on Senior shipping notes (AEC); the reason is the line description.
 * Goods produced/dispatched on D reach the client on D+1; refusal happens at delivery, not later.
 * Negative lines on D+1 are attributed to the selected production/dispatch period D.
 */
export async function returnsReport(cloud: any, legacyUser: any, body: any) {
  const start = day(body?.start), end = day(body?.end);
  const lag = 1;
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
  let work: ProductionWork[] = [], productionWarning: string | null = null;
  try {
    const sessions = await fetchAll(legacyUser, 'productie_sesiuni_lucru',
      'id,comanda_id,nume_operator,numar_angajati,ora_start,ora_sfarsit,cantitate_produsa,productie_linii(nume),productie_comenzi!inner(id,numar_comanda,magazin,punct_livrare,productie_produse(nume))',
      (q) => q.gte('ora_start', startIso(start)).lte('ora_start', endIso(end)).gt('cantitate_produsa', 0).order('id'), 100000);
    work = sessions.map((s: any) => ({
      sessionId: s.id, orderId: s.comanda_id, order: s.productie_comenzi?.numar_comanda ?? '',
      day: bucharestDay(new Date(s.ora_start)), product: s.productie_comenzi?.productie_produse?.nume ?? '',
      store: s.productie_comenzi?.magazin ?? '', point: s.productie_comenzi?.punct_livrare ?? '',
      operator: s.nume_operator || 'Operator neînregistrat', line: s.productie_linii?.nume || 'Linie neînregistrată',
      quantity: Number(s.cantitate_produsa), start: s.ora_start, end: s.ora_sfarsit ?? null, employees: Number(s.numar_angajati) || 0,
    }));
  } catch (e) {
    productionWarning = `Operatorii nu au putut fi verificați: ${(e as Error).message}`;
  }
  const match = createProductionMatcher(work);
  return { start, end, lag, returnStart: rs, returnEnd: re, returns: returns.map((r: any) => ({ ...r, production: match(r) })), shipped, shippedDays, productionWarning };
}
