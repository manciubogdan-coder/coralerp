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

export const SENIOR_GUIDE = `Baza Senior ERP (SQL Server, citire directă, date la zi). Reguli:
- Folosește întâi senior_cauta_tabele, apoi senior_descrie_tabel, apoi senior_sql. Nu ghici nume de tabele/coloane.
- senior_sql acceptă un singur SELECT în dialect T-SQL (TOP n, nu LIMIT; GETDATE(); CONVERT). Folosește numele "sursa" (ex. dbo.C_H_Note_Contabile) și numele coloanelor date de senior_descrie_tabel (insensibile la majuscule). Adaugă WITH (NOLOCK) după tabele mari și filtrează mereu pe dată; agregă în SQL (SUM/COUNT/GROUP BY), întoarce max ~200 rânduri.
- Documente: C_H_Note_Contabile = antete documente (data, valoare_rol = valoare document în lei, anulat, tip_document_id → C_Tipuri_Document.cod: CC comandă client, CF comandă furnizor, FC factură client, FF/FFI factură furnizor, plus alte coduri — verifică descrierea). C_D_Note_Contabile = linii (h_id → antet, articol cod/denumire, cantitate, valoare_neta_rol, valoare_tva_rol). C_H_Note_Contabile_Parteneri leagă antetul (h_id) de partener (partener_id, partener_denumire). Exclude anulat = 1.
- Contabilitate: AccountingStatistics (PeriodId text YYYYMM, TipSubiectId = 1 total pe cont, AnaliticId → C_Plan_Contabil.Analitic_ID, CreditTurnover/DebitTurnover). Venituri = clasa 7 (credit−debit), cheltuieli = clasa 6 (debit−credit). Balanța există doar pentru lunile procesate în Senior; pentru lunile mai noi folosește documentele (facturi).
- Dacă o interogare dă eroare, citește mesajul, corectează și reîncearcă. Spune mereu din ce tabele și ce filtre vin cifrele.`;

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
