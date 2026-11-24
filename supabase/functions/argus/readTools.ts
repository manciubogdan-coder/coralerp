// Shared read-only capabilities for the main Argus chat and Viziune copilot.
import { jsonSchema, tool, type UIMessage } from "npm:ai@7.0.123";
import { SENIOR_GUIDE, seniorTools } from "../_shared/senior.ts";
import { priceTools } from "./priceTool.ts";
import { forecastTools } from "./forecastTool.ts";
import { memoryTools } from "./memory.ts";
import { searchConversations, threadOwners } from "./conversationSearch.ts";
import { messageText } from "./contextRules.ts";
import { makeClients, overviewWithTrend, runQuery, TABLES, type QuerySpec } from "./data.ts";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const querySchema = {
  type: "object",
  additionalProperties: false,
  required: ["tabel", "coloane", "filtre", "ordonare", "descrescator", "grupare", "sume", "limita"],
  properties: {
    tabel: { type: "string", enum: Object.keys(TABLES) },
    coloane: { type: "array", items: { type: "string" }, description: "Coloanele de citit; gol = toate" },
    filtre: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["coloana", "operator", "valoare"],
        properties: {
          coloana: { type: "string" },
          operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is_null", "not_null"] },
          valoare: { type: "string", description: "Pentru date folosește ISO cu fus orar, ex 2026-09-01T00:00:00+03:00. 'in' = listă separată prin virgulă." },
        },
      },
    },
    ordonare: { type: ["string", "null"] },
    descrescator: { type: "boolean" },
    grupare: { type: "array", items: { type: "string" }, description: "Coloane după care se grupează (numar + sume)" },
    sume: { type: "array", items: { type: "string" }, description: "Coloane numerice însumate pe grup" },
    limita: { type: "integer", description: "Câte rânduri să primești înapoi (max 200)" },
  },
} as const;

export function readTools(c: ReturnType<typeof makeClients>, threadId = "", messages?: UIMessage[]) {
  return {
    schema_context: tool({
      description: "Schema și reguli la cerere. Domeniu 'senior' sau nume de tabel din aplicație.",
      inputSchema: jsonSchema<{ domeniu: string }>({ type: 'object', additionalProperties: false, required: ['domeniu'], properties: { domeniu: { type: 'string' } } }),
      execute: async ({ domeniu }) => domeniu === 'senior' ? { ghid: SENIOR_GUIDE } : TABLES[domeniu] ?? { eroare: 'Tabel necunoscut' },
    }),
    citeste_istoric: tool({
      description: "Recuperează exact mesaje dintr-o conversație Argus (a ta sau a altui utilizator al firmei), pe poziții 1-based (max 20). Id-ul vine din cauta_conversatii.",
      inputSchema: jsonSchema<{ conversatie: string; de_la: number }>({ type: 'object', additionalProperties: false, required: ['conversatie','de_la'], properties: { conversatie: { type: 'string' }, de_la: { type: 'integer', minimum: 1 } } }),
      execute: async ({ conversatie, de_la }) => {
        if (!Number.isInteger(de_la) || de_la < 1) return { eroare: 'Poziție invalidă' };
        if (messages && conversatie === threadId) return { total: messages.length, de_la, mesaje: messages.slice(de_la - 1, de_la + 19).map(m => ({ id: m.id, role: m.role, text: messageText(m) })) };
        const { data: th, error: thErr } = await c.cloud.from('argus_threads').select('id,title,user_id').eq('id', conversatie).maybeSingle();
        if (thErr) return { eroare: thErr.message };
        if (!th) return { eroare: 'Conversația nu există' };
        const { data, error, count } = await c.cloud.from('argus_messages').select('message', { count: 'exact' }).eq('thread_id', conversatie).order('created_at').order('id').range(de_la - 1, de_la + 18);
        if (error) return { eroare: error.message };
        const owners = await threadOwners(c, [th.user_id]);
        return { conversatie: th.title, utilizator: owners.get(th.user_id) ?? th.user_id, total: count, de_la, mesaje: data?.map(r => ({ role: r.message?.role, text: messageText(r.message).slice(0, 6000) })) };
      },
    }),
    cauta_conversatii: tool({
      description: "Caută în conversațiile Argus ale TUTUROR utilizatorilor firmei (titlu și conținutul mesajelor). Filtrează opțional după utilizator (nume sau email, ex. 'Petrica'). Cuvinte gol = cele mai recente conversații. Nu este sursă de date live.",
      inputSchema: jsonSchema<{ cuvinte: string; utilizator: string }>({ type: 'object', additionalProperties: false, required: ['cuvinte','utilizator'], properties: { cuvinte: { type: 'string', maxLength: 100 }, utilizator: { type: 'string', maxLength: 100 } } }),
      execute: async ({ cuvinte, utilizator }) => {
        try { return { conversatii: await searchConversations(c, cuvinte, utilizator) }; }
        catch (e) { return { eroare: (e as Error).message }; }
      },
    }),
    metrici_perioada: tool({
      description: "Tablou complet pe o perioadă: oameni activi/inactivi, timp pe huburi, producție pe linii și operatori, depozite, anomalii și greșeli pe persoană, comparație cu perioada anterioară.",
      inputSchema: jsonSchema<{ de_la: string; pana_la: string }>({
        type: "object", additionalProperties: false, required: ["de_la", "pana_la"],
        properties: { de_la: { type: "string", description: "YYYY-MM-DD" }, pana_la: { type: "string", description: "YYYY-MM-DD" } },
      }),
      execute: async ({ de_la, pana_la }) => {
        if (!DAY_RE.test(de_la) || !DAY_RE.test(pana_la)) return { eroare: "Date invalide" };
        try { const o: any = await overviewWithTrend(c, de_la, pana_la); o.calitate.probleme = o.calitate.probleme.slice(0, 60).map(({ poze, ...x }: any) => ({ ...x, poze: poze.length })); for (const k of Object.keys(o.depozite)) delete o.depozite[k].lista; o.rebut.inregistrari = o.rebut.inregistrari.slice(0, 60); return o; } catch (e) { return { eroare: String((e as Error).message) }; }
      },
    }),
    interogare_date: tool({
      description: "Interogare sigură (doar citire) pe un tabel, cu filtre, grupare și sume.",
      inputSchema: jsonSchema<QuerySpec>(querySchema as any),
      execute: async (spec) => {
        try {
          const r = await runQuery(c, spec);
          const lim = Math.min(Math.max(1, spec.limita || 50), 200);
          return { total_randuri_sursa: r.total_randuri_sursa, randuri_returnate: Math.min(lim, r.randuri.length), total_grupuri_sau_randuri: r.randuri.length, randuri: r.randuri.slice(0, lim) };
        } catch (e) { return { eroare: String((e as Error).message) }; }
      },
    }),
    ...seniorTools(c.cloud),
    ...priceTools(c),
    ...forecastTools(c),
    dosar_produs: memoryTools(c, "", "").dosar_produs,
  };
}
