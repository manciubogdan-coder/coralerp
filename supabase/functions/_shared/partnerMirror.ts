// Senior reads for the partner mirror; maths in partnerMirrorMath.ts.
import { seniorSqlAll } from "./senior.ts";
import { cf } from "./priceScope.ts";
import { lastMonthStart } from "./partnerMirrorMath.ts";
export * from "./partnerMirrorMath.ts";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => any };
const SALES = "('FC','FCE','FCEC')";
const CLIENT_NAME = "LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(pp.Partener_Central)),''), pp.Partener_Denumire)))";
const isDay = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
/** Senior partner classifications "Subgrupa" and "subgrupa 2" (D_Parteneri_Clasificari), one row per partner; "--" = none. */
const CLASSES = `SELECT pc.Partener_ID,
    MAX(CASE WHEN LOWER(LTRIM(RTRIM(c.Descriere)))='subgrupa' THEN LTRIM(RTRIM(v.Val_Text)) END) g1,
    MAX(CASE WHEN LOWER(LTRIM(RTRIM(c.Descriere)))='subgrupa 2' THEN LTRIM(RTRIM(v.Val_Text)) END) g2
  FROM dbo.D_Parteneri_Clasificari pc WITH (NOLOCK)
  JOIN dbo.D_Clasificari_Valori v WITH (NOLOCK) ON v.D_Clasificari_Valori_ID=pc.D_Clasificari_Valori_ID
  JOIN dbo.D_Clasificari c WITH (NOLOCK) ON c.D_Clasificari_ID=v.D_Clasificari_ID
  WHERE LOWER(LTRIM(RTRIM(c.Descriere))) IN ('subgrupa','subgrupa 2') AND LTRIM(RTRIM(v.Val_Text))<>'--'
  GROUP BY pc.Partener_ID`;

type Article = { id: number; name: string; qty: number; value: number; lastQty: number; lastValue: number };

/** Sales of every central partner × finished product (active recipe) invoiced in [start, end), with the partner's Senior
 * classification and the sales of the period's last month (current price for the projection). */
export async function partnerMirrorSales(sb: Rpc, body: { start?: unknown; end?: unknown }) {
  if (!isDay(body.start) || !isDay(body.end) || String(body.start) >= String(body.end)) throw new Error("Perioadă invalidă.");
  const start = String(body.start), end = String(body.end), lastStart = lastMonthStart(start, end);
  const rows = await seniorSqlAll(sb, `SELECT COALESCE(${cf("pp")}, ${CLIENT_NAME}) k,
      COALESCE(MIN(CASE WHEN LTRIM(RTRIM(pp.Partener_Denumire))=LTRIM(RTRIM(pp.Partener_Central)) THEN pp.Partener_ID END), MIN(pp.Partener_ID)) pid,
      MIN(${CLIENT_NAME}) pname, d.Articol_ID aid, MAX(d.Denumire) aname, MAX(cl.g1) g1, MAX(cl.g2) g2,
      SUM(CAST(d.Cantitate AS float)) q, SUM(CAST(d.Valoare_Neta_Rol AS float)) v,
      SUM(CASE WHEN h.Data>='${lastStart}' THEN CAST(d.Cantitate AS float) ELSE 0 END) ql,
      SUM(CASE WHEN h.Data>='${lastStart}' THEN CAST(d.Valoare_Neta_Rol AS float) ELSE 0 END) vl
    FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
    JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
    JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID AND pp.TipPartener=1
    LEFT JOIN (${CLASSES}) cl ON cl.Partener_ID=pp.Partener_ID
    WHERE t.Cod IN ${SALES} AND ISNULL(h.Anulat,0)=0 AND h.Data>='${start}' AND h.Data<'${end}'
      AND EXISTS (SELECT 1 FROM dbo.DArticoleCompuseHVersiuni v WITH (NOLOCK) WHERE v.ArticolId=d.Articol_ID AND v.IsActiv=1)
    GROUP BY COALESCE(${cf("pp")}, ${CLIENT_NAME}), d.Articol_ID`, "k, aid");
  const by = new Map<string, { key: string; id: number; name: string; group: string | null; subgroup: string | null; qty: number; value: number; articles: Article[] }>();
  for (const r of rows) {
    const key = String(r.k);
    const p = by.get(key) ?? { key, id: Number(r.pid), name: String(r.pname ?? "").trim(), group: null, subgroup: null, qty: 0, value: 0, articles: [] };
    p.group ??= r.g1 ? String(r.g1) : null;
    p.subgroup ??= r.g2 ? String(r.g2) : null;
    const qty = Number(r.q) || 0, value = Number(r.v) || 0;
    by.set(key, p);
    if (qty <= 0) continue;
    p.qty += qty; p.value += value;
    p.articles.push({ id: Number(r.aid), name: String(r.aname ?? "").trim(), qty, value, lastQty: Math.max(0, Number(r.ql) || 0), lastValue: Number(r.vl) || 0 });
  }
  const partners = [...by.values()].filter((p) => p.articles.length).map((p) => ({ ...p, articles: p.articles.sort((a, b) => b.value - a.value) })).sort((a, b) => b.value - a.value);
  return { start, end, lastStart, partners };
}
