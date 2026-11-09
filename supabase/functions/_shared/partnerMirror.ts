// Senior reads for the partner mirror; maths in partnerMirrorMath.ts.
import { seniorSqlAll } from "./senior.ts";
import { cf } from "./priceScope.ts";
export * from "./partnerMirrorMath.ts";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => any };
const SALES = "('FC','FCE','FCEC')";
const CLIENT_NAME = "LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(pp.Partener_Central)),''), pp.Partener_Denumire)))";
const isDay = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Sales of every central partner × finished product (active recipe) invoiced in [start, end). */
export async function partnerMirrorSales(sb: Rpc, body: { start?: unknown; end?: unknown }) {
  if (!isDay(body.start) || !isDay(body.end) || String(body.start) >= String(body.end)) throw new Error("Perioadă invalidă.");
  const start = String(body.start), end = String(body.end);
  const rows = await seniorSqlAll(sb, `SELECT COALESCE(${cf("pp")}, ${CLIENT_NAME}) k,
      COALESCE(MIN(CASE WHEN LTRIM(RTRIM(pp.Partener_Denumire))=LTRIM(RTRIM(pp.Partener_Central)) THEN pp.Partener_ID END), MIN(pp.Partener_ID)) pid,
      MIN(${CLIENT_NAME}) pname, d.Articol_ID aid, MAX(d.Denumire) aname,
      SUM(CAST(d.Cantitate AS float)) q, SUM(CAST(d.Valoare_Neta_Rol AS float)) v
    FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
    JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
    JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID AND pp.TipPartener=1
    WHERE t.Cod IN ${SALES} AND ISNULL(h.Anulat,0)=0 AND h.Data>='${start}' AND h.Data<'${end}'
      AND EXISTS (SELECT 1 FROM dbo.DArticoleCompuseHVersiuni v WITH (NOLOCK) WHERE v.ArticolId=d.Articol_ID AND v.IsActiv=1)
    GROUP BY COALESCE(${cf("pp")}, ${CLIENT_NAME}), d.Articol_ID`, "k, aid");
  const by = new Map<string, { id: number; name: string; qty: number; value: number; articles: Array<{ id: number; name: string; qty: number; value: number }> }>();
  for (const r of rows) {
    const key = String(r.k);
    const p = by.get(key) ?? { id: Number(r.pid), name: String(r.pname ?? "").trim(), qty: 0, value: 0, articles: [] };
    const qty = Number(r.q) || 0, value = Number(r.v) || 0;
    if (qty <= 0) continue;
    p.qty += qty; p.value += value;
    p.articles.push({ id: Number(r.aid), name: String(r.aname ?? "").trim(), qty, value });
    by.set(key, p);
  }
  const partners = [...by.values()].map((p) => ({ ...p, articles: p.articles.sort((a, b) => b.value - a.value) })).sort((a, b) => b.value - a.value);
  return { start, end, partners };
}
