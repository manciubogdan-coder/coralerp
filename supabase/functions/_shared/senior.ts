// Live reads from Senior ERP through the queue served by the program on the Senior server.
import { jsonSchema, tool } from "npm:ai@7.0.123";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => any };

export class SeniorLiveError extends Error {}

export async function seniorLive(sb: Rpc, kind: string, payload: unknown, waitMs = 30000) {
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  };
  const id = await call("erp_live_enqueue", { p_kind: kind, p_payload: payload });
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 600));
    const s = await call("erp_live_get", { p_id: id });
    if (s?.status === "done") return s.result;
    if (s?.status === "error") throw new SeniorLiveError(s.error || "Eroare la citirea din Senior.");
  }
  throw new SeniorLiveError("Serverul Senior nu a răspuns în timp util. Verifică dacă programul de citire rulează pe server.");
}

export async function seniorCatalog(sb: Rpc): Promise<any[]> {
  const { data } = await sb.rpc("erp_live_state", { p_key: "catalog" });
  if (Array.isArray(data?.value) && Date.now() - new Date(data.updated_at).getTime() < 6 * 3600_000) return data.value;
  try { return await seniorLive(sb, "catalog", {}); } catch (e) { if (Array.isArray(data?.value)) return data.value; throw e; }
}

export const SENIOR_GUIDE = `Baza Senior ERP (SQL Server, citire directă, date la zi).
SCHEMA VERIFICATĂ (scrie SQL direct cu ea; caută alte tabele cu senior_cauta_tabele doar dacă întrebarea iese din schema de mai jos):
- dbo.C_H_Note_Contabile h — antet document: H_ID, Tip_Document_ID, Data (data documentului), Serie_Document_Primar, Numar_Document_Primar, Valoare_Rol (total document în lei), Anulat (bit; exclude mereu: ISNULL(h.Anulat,0)=0), Descriere.
- dbo.C_Tipuri_Document t — Tip_Document_ID, Cod, Descriere. Coduri: CC comandă client, CF comandă furnizor, FC factură client, FF factură furnizor, FFI factură furnizor import, AEC aviz expediție client, BC bon consum, NCICV închidere lunară conturi 6/7 (exclude-o din venituri/cheltuieli).
- dbo.C_H_Note_Contabile_Parteneri pp — H_ID, Partener_ID, Partener_Denumire, Partener_Cod_Fiscal (partenerul documentului; client la FC/CC, furnizor la FF/CF).
- dbo.C_D_Note_Contabile d — linii document: D_ID, H_ID, Articol_ID, Cod, Denumire (articol), Cantitate, UM_ID → dbo.D_Articole_UM.UM_ID (Cod = unitatea), Pret_Final_Rol, Valoare_Neta_Rol (fără TVA), Valoare_TVA_Rol, Valoare_Bruta_Rol (cu TVA).
- dbo.D_Parteneri — Partener_ID, Cod, Denumire, IsClient, IsFurnizor. dbo.D_Articole — Articol_ID, Cod, Denumire.
- dbo.C_H_Note_Contabile_Detalii_Conturi dc — registrul contabil LA ZI: H_ID, AnaliticId → dbo.C_Plan_Contabil.Analitic_ID, IsDebit (bit), Valoare_Rol, LunaContabila (int YYYYMM), SubiectDenumire. dbo.C_Plan_Contabil — Analitic_ID, Cont, Descriere. Venituri = clasa 7 (credit−debit), cheltuieli = clasa 6 (debit−credit), excluzând documentele NCICV. Tabel mare: filtrează mereu pe LunaContabila.
REȚETE:
- Achiziții de la un furnizor: FROM C_H_Note_Contabile h JOIN C_Tipuri_Document t ON t.Tip_Document_ID=h.Tip_Document_ID JOIN C_H_Note_Contabile_Parteneri pp ON pp.H_ID=h.H_ID JOIN C_D_Note_Contabile d ON d.H_ID=h.H_ID WHERE t.Cod IN ('FF','FFI') AND ISNULL(h.Anulat,0)=0 AND pp.Partener_Denumire LIKE N'%nume%' AND h.Data >= '...' AND h.Data < DATEADD(day,1,'...').
- Vânzări către clienți: la fel cu t.Cod = 'FC'. Comenzi: 'CC' (clienți) / 'CF' (furnizori).
- Totaluri pe documente (fără linii): folosește h.Valoare_Rol, fără JOIN pe linii, ca să nu dublezi sumele.
REGULI SQL: un singur SELECT T-SQL (TOP n, nu LIMIT; GETDATE(); CONVERT(char(7), h.Data, 120) = lună YYYY-MM). Pune WITH (NOLOCK) după fiecare tabel. Filtrează mereu pe dată. Agregă în SQL (SUM/COUNT/GROUP BY), max ~200 rânduri. Numele de parteneri/articole caută-le cu LIKE N'%...%' (nu egalitate), fără diacritice obligatorii.
Dacă o interogare dă eroare, citește mesajul, corectează și reîncearcă (folosește senior_descrie_tabel pentru coloane). Spune din ce tabele și ce filtre vin cifrele.`;

/** Live P&L from the accounting journal (up to date, monthly closing notes excluded). Shape matches erp_mirror_pnl. */
export async function seniorPnl(sb: Rpc, year: number) {
  const y = Math.trunc(year);
  if (!(y > 2000 && y < 2100)) throw new Error("An invalid.");
  const base = `FROM dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK)
    JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID = dc.AnaliticId
    JOIN dbo.C_H_Note_Contabile h WITH (NOLOCK) ON h.H_ID = dc.H_ID
    JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID = h.Tip_Document_ID
    WHERE (p.Cont LIKE '6%' OR p.Cont LIKE '7%') AND t.Cod <> 'NCICV' AND ISNULL(h.Anulat, 0) = 0`;
  const sums = `SUM(CASE WHEN p.Cont LIKE '7%' THEN CASE WHEN dc.IsDebit = 1 THEN -CAST(dc.Valoare_Rol AS float) ELSE CAST(dc.Valoare_Rol AS float) END ELSE 0 END) AS rev,
    SUM(CASE WHEN p.Cont LIKE '6%' THEN CASE WHEN dc.IsDebit = 1 THEN CAST(dc.Valoare_Rol AS float) ELSE -CAST(dc.Valoare_Rol AS float) END ELSE 0 END) AS exp`;
  const accountsSql = (from: number, to: number) =>
    `SELECT CAST(dc.LunaContabila AS varchar(6)) AS period, p.Cont AS cont, MAX(p.Descriere) AS name, ${sums} ${base}
     AND dc.LunaContabila BETWEEN ${from} AND ${to} GROUP BY dc.LunaContabila, p.Cont`;
  const run = async (from: number, to: number): Promise<any[]> => {
    const rows = await seniorLive(sb, "sql", { sql: accountsSql(from, to) }, 55000);
    if (Array.isArray(rows) && rows.length >= 500 && to - from > 0) {
      const mid = from + Math.floor((to - from) / 2);
      return [...(await run(from, mid)), ...(await run(mid + 1, to))];
    }
    return rows ?? [];
  };
  const [h1, h2, prev] = await Promise.all([
    run(y * 100 + 1, y * 100 + 6),
    run(y * 100 + 7, y * 100 + 12),
    seniorLive(sb, "sql", { sql: `SELECT CAST(dc.LunaContabila AS varchar(6)) AS period, ${sums} ${base} AND dc.LunaContabila BETWEEN ${(y - 1) * 100 + 1} AND ${(y - 1) * 100 + 12} GROUP BY dc.LunaContabila` }, 55000),
  ]);
  const r2 = (n: unknown) => Math.round(Number(n || 0) * 100) / 100;
  const accounts = [...h1, ...h2].map((r) => ({ period: String(r.period), cont: String(r.cont), name: r.name, rev: r2(r.rev), exp: r2(r.exp) })).filter((r) => r.rev || r.exp);
  const byMonth = new Map<string, any>();
  for (const a of accounts) {
    const m = byMonth.get(a.period) ?? { period: a.period, y, revenue: 0, expenses: 0 };
    m.revenue += a.rev; m.expenses += a.exp; byMonth.set(a.period, m);
  }
  for (const r of prev ?? []) byMonth.set(String(r.period), { period: String(r.period), y: y - 1, revenue: r2(r.rev), expenses: r2(r.exp) });
  const months = [...byMonth.values()].map((m) => ({ ...m, revenue: r2(m.revenue), expenses: r2(m.expenses) })).sort((a, b) => a.period.localeCompare(b.period));
  return { months, accounts, last_period: months.filter((m) => m.y === y).at(-1)?.period ?? null, live: true, source: "journal" };
}

export function seniorTools(sb: Rpc, onRows?: (rows: any[]) => void) {
  let catalog: any[] | null = null;
  const cat = async () => (catalog ??= await seniorCatalog(sb));
  return {
    senior_cauta_tabele: tool({
      description: "Caută tabele în Senior ERP după cuvinte din nume sau coloane (ex. 'partener', 'factura', 'stoc', 'articol'). Întoarce nume, sursă, număr rânduri.",
      inputSchema: jsonSchema<{ cuvinte: string }>({ type: "object", additionalProperties: false, required: ["cuvinte"], properties: { cuvinte: { type: "string" } } }),
      execute: async ({ cuvinte }) => {
        try {
          const words = String(cuvinte).toLowerCase().split(/[\s,]+/).filter(Boolean);
          const scored = (await cat()).map((t) => {
            const name = String(t.table), cols = (t.columns ?? []).map((c: any) => c.name).join(" ");
            const score = words.reduce((s, w) => s + (name.includes(w) ? 5 : 0) + (cols.includes(w) ? 1 : 0), 0) + (t.rows > 0 ? 0.5 : 0);
            return { t, score };
          }).filter((x) => x.score > 0.5).sort((a, b) => b.score - a.score || b.t.rows - a.t.rows).slice(0, 25);
          return scored.map(({ t }) => ({ tabel: t.table, sursa: t.source, randuri: t.rows, coloane: (t.columns ?? []).slice(0, 12).map((c: any) => c.name).join(", ") }));
        } catch (e) { return { eroare: (e as Error).message }; }
      },
    }),
    senior_descrie_tabel: tool({
      description: "Toate coloanele (nume și tip) ale unui tabel din Senior.",
      inputSchema: jsonSchema<{ tabel: string }>({ type: "object", additionalProperties: false, required: ["tabel"], properties: { tabel: { type: "string" } } }),
      execute: async ({ tabel }) => {
        try {
          const key = String(tabel).toLowerCase().replace(/^dbo\./, "").replace(/[^a-z0-9_]/g, "_");
          const t = (await cat()).find((x) => x.table === key);
          return t ? { sursa: t.source, randuri: t.rows, coloane: t.columns } : { eroare: "Tabel inexistent. Folosește senior_cauta_tabele." };
        } catch (e) { return { eroare: (e as Error).message }; }
      },
    }),
    senior_sql: tool({
      description: "Rulează un singur SELECT T-SQL read-only direct în Senior ERP (max 500 rânduri, 25s).",
      inputSchema: jsonSchema<{ sql: string }>({ type: "object", additionalProperties: false, required: ["sql"], properties: { sql: { type: "string" } } }),
      execute: async ({ sql }) => {
        try {
          const rows = await seniorLive(sb, "sql", { sql: String(sql).slice(0, 8000) }, 40000);
          if (Array.isArray(rows) && rows.length) onRows?.(rows);
          return { randuri: Array.isArray(rows) ? rows.length : 0, date: Array.isArray(rows) ? rows.slice(0, 200) : rows };
        } catch (e) { return { eroare: (e as Error).message }; }
      },
    }),
  };
}
