// Selectable Senior lists for agent/report filters (products, clients, suppliers), cached per instance for 30 minutes
// so dropdowns open fast and repeated lookups don't hit Senior.
import { seniorLive } from "../_shared/senior.ts";

type Rpc = any;
const TTL = 30 * 60_000;
const cache = new Map<string, { at: number; names: string[] }>();
const docs = `dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID`;

const QUERIES: Record<string, (since: string) => string> = {
  produs: (since) => `SELECT TOP 1500 MAX(d.Denumire) name FROM ${docs} JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
    WHERE t.Cod IN ('FC','FCE','FCEC','NIR') AND ISNULL(h.Anulat,0)=0 AND h.Data>='${since}' AND d.Articol_ID IS NOT NULL
    GROUP BY d.Articol_ID ORDER BY MAX(d.Denumire)`,
  client: (since) => `SELECT TOP 800 MAX(pp.Partener_Denumire) name FROM ${docs} JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID
    WHERE t.Cod IN ('FC','FCE','FCEC') AND ISNULL(h.Anulat,0)=0 AND h.Data>='${since}' GROUP BY pp.Partener_ID ORDER BY MAX(pp.Partener_Denumire)`,
  furnizor: (since) => `SELECT TOP 800 MAX(pp.Partener_Denumire) name FROM ${docs} JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID
    WHERE t.Cod IN ('NIR','FF','FFI','FFIC') AND ISNULL(h.Anulat,0)=0 AND h.Data>='${since}' GROUP BY pp.Partener_ID ORDER BY MAX(pp.Partener_Denumire)`,
};

export async function filterOptions(sb: Rpc, source: string): Promise<{ names: string[] }> {
  const q = QUERIES[source];
  if (!q) throw new Error("Listă necunoscută.");
  const hit = cache.get(source);
  if (hit && Date.now() - hit.at < TTL) return { names: hit.names };
  const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const rows = await seniorLive(sb, "sql", { sql: q(since) }, 55000);
  const names = [...new Set((Array.isArray(rows) ? rows : []).map((r: any) => String(r.name ?? "").trim()).filter(Boolean))];
  cache.set(source, { at: Date.now(), names });
  return { names };
}
