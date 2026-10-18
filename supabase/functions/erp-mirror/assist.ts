// Asistentul CEO: streaming NDJSON cu pașii, textul și șablonul final de raport.
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { isStepCount, jsonSchema, streamText, tool } from "npm:ai@7.0.123";
import { SENIOR_GUIDE, seniorLive, seniorTools } from "../_shared/senior.ts";
import { fillTemplate, validTemplate, type SqlTemplate } from "../_shared/templates.ts";
import { createLovableAiGatewayRunIdFetch } from "../_shared/run-id.ts";
import { makeClients, runQuery, TABLES } from "../_shared/appData.ts";
const appTables = Object.entries(TABLES).map(([k, v]) => `- ${k}: ${v.desc}`).join("\n");

const STEP_LABEL: Record<string, string> = {
  senior_cauta_tabele: "Caut tabelele potrivite în Senior",
  senior_descrie_tabel: "Citesc coloanele tabelului",
  senior_sql: "Rulez o interogare în Senior",
  date_aplicatie: "Citesc datele din aplicație",
  raport_final: "Pregătesc tabelul raportului",
};

// Asistentul: agent care scrie interogări T-SQL read-only, le rulează live în Senior și
// transmite progresul pas cu pas (NDJSON). La final întoarce un șablon de raport refolosibil.
export function assistStream(prompt: string, sb: any, signal: AbortSignal, appToken = "") {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => { try { ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* closed */ } };
      try {
        if (!prompt) { send({ t: "error", error: "Scrie ce vrei să afli." }); return; }
        const key = Deno.env.get("LOVABLE_API_KEY");
        if (!key) throw new Error("LOVABLE_API_KEY lipsește");
        const run = createLovableAiGatewayRunIdFetch();
        const provider = createOpenAICompatible({
          name: "lovable",
          baseURL: "https://ai.gateway.lovable.dev/v1",
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: run.fetch,
        });
        const now = new Date();
        const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
        const [yy, mm] = today.split("-").map(Number);
        const pm = mm === 1 ? 12 : mm - 1, py = mm === 1 ? yy - 1 : yy;
        const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
        const prevMonth = `${py}-${String(pm).padStart(2, "0")}`;
        let final: { title: string; template: SqlTemplate; rows: any[] } | null = null;
        const tools = {
          ...seniorTools(sb),
          date_aplicatie: tool({
            description: "Citește (doar citire) un tabel din aplicația CoralERP: producție, depozite, recepții, necesar clienți, comenzi furnizori, taskuri. Filtre: operator eq/neq/gt/gte/lt/lte/ilike/in/is_null/not_null.",
            inputSchema: jsonSchema<any>({
              type: "object", additionalProperties: false, required: ["tabel", "coloane", "filtre", "grupare", "sume", "limita"],
              properties: {
                tabel: { type: "string", enum: Object.keys(TABLES) },
                coloane: { type: "array", items: { type: "string" } },
                filtre: { type: "array", items: { type: "object", additionalProperties: false, required: ["coloana", "operator", "valoare"], properties: { coloana: { type: "string" }, operator: { type: "string" }, valoare: { type: "string" } } } },
                grupare: { type: "array", items: { type: "string" } },
                sume: { type: "array", items: { type: "string" } },
                limita: { type: "integer" },
              },
            }),
            execute: async (q: any) => {
              try {
                const r = await runQuery(makeClients(appToken), { ordonare: null, descrescator: false, ...q });
                return { total: r.randuri.length, randuri: r.randuri.slice(0, Math.min(q.limita || 50, 200)) };
              } catch (e) { return { eroare: (e as Error).message }; }
            },
          }),
          raport_final: tool({
            description: "Apelează O SINGURĂ DATĂ, la final, cu interogarea principală care produce tabelul răspunsului, scrisă ca ȘABLON reutilizabil. Perioada se scrie cu {{de_la}} și {{pana_la}} (ex. h.Data >= {{de_la}} AND h.Data < DATEADD(day,1,{{pana_la}})). Filtrele pe nume (furnizor, client, articol) se scriu ca pp.Partener_Denumire LIKE N'%' + {{partener}} + N'%' (gol = toți). Nu pune ghilimele în jurul parametrilor. Dă fiecărui parametru valoarea din întrebare.",
            inputSchema: jsonSchema<any>({
              type: "object", additionalProperties: false, required: ["titlu", "sql", "parametri", "grafic", "axa_x", "serii"],
              properties: {
                titlu: { type: "string" },
                sql: { type: "string" },
                parametri: {
                  type: "array",
                  items: {
                    type: "object", additionalProperties: false, required: ["nume", "eticheta", "tip", "valoare"],
                    properties: { nume: { type: "string" }, eticheta: { type: "string" }, tip: { type: "string", enum: ["date", "text", "number"] }, valoare: { type: "string" } },
                  },
                },
                grafic: { type: "string", enum: ["table", "bar", "line", "pie"] },
                axa_x: { type: ["string", "null"] },
                serii: { type: "array", items: { type: "string" } },
              },
            }),
            execute: async (a: any) => {
              const tpl = validTemplate({
                kind: "sql", sql: a.sql, chart: a.grafic, x: a.axa_x, series: a.serii,
                params: (a.parametri ?? []).map((p: any) => ({ name: p.nume, label: p.eticheta, type: p.tip })),
                defaults: Object.fromEntries((a.parametri ?? []).map((p: any) => [p.nume, p.valoare])),
              });
              if (!tpl) return { eroare: "Șablon invalid: un singur SELECT, iar fiecare {{parametru}} folosit trebuie declarat în parametri (nume cu litere mici)." };
              try {
                const rows = await seniorLive(sb, "sql", { sql: fillTemplate(tpl) }, 45000);
                final = { title: String(a.titlu || prompt).slice(0, 120), template: tpl, rows: Array.isArray(rows) ? rows : [] };
                return { ok: true, randuri: final.rows.length, primele: final.rows.slice(0, 15) };
              } catch (e) { return { eroare: (e as Error).message }; }
            },
          }),
        };
        send({ t: "step", msg: "Înțeleg întrebarea" });
        const result = streamText({
          model: provider("google/gemini-3.8-flash"),
          abortSignal: signal,
          system: `Ești asistentul de date al CEO-ului Coral Biogreens. Azi este ${today}. „Luna trecută” = ${prevMonth}-01 … ${prevMonth}-${lastDay}. „Anul acesta” = ${yy}-01-01 … ${today}. Răspunzi DOAR pe baza datelor citite live: din Senior (senior_*) și din aplicația CoralERP (date_aplicatie) — folosește-le pe amândouă când întrebarea privește producția, stocurile, recepțiile sau necesarul. Nu inventa cifre. raport_final se aplică doar pentru tabele Senior; dacă răspunsul vine doar din aplicație, nu-l apela.\nTabele aplicație:\n${appTables}
${SENIOR_GUIDE}
FLUX RAPID: scrie direct interogarea cu schema verificată (1–3 interogări senior_sql), apoi apelează raport_final cu interogarea principală ca șablon, apoi scrie răspunsul.
Răspunsul final: în română, markdown scurt (max 8 rânduri): concluzia și cifrele cheie (totaluri). NU copia tabelul cu toate rândurile — tabelul raportului se afișează separat sub răspuns. Încheie cu o linie „Sursa:” cu tabelele și filtrele.`,
          prompt,
          tools,
          stopWhen: isStepCount(10),
          prepareStep: ({ stepNumber }: { stepNumber: number }) => (stepNumber >= 8 ? { toolChoice: "none" as const } : undefined),
        });
        for await (const p of result.fullStream as AsyncIterable<any>) {
          if (p.type === "tool-call") {
            const input = p.input ?? p.args ?? {};
            send({ t: "step", msg: STEP_LABEL[p.toolName] ?? p.toolName, detail: p.toolName === "senior_cauta_tabele" ? input.cuvinte : undefined });
          } else if (p.type === "tool-result") {
            const out = p.output ?? p.result;
            if (out?.eroare) send({ t: "step", msg: "Corectez interogarea", detail: String(out.eroare).slice(0, 160) });
          } else if (p.type === "text-delta") {
            const d = p.text ?? p.delta ?? p.textDelta ?? "";
            if (d) send({ t: "text", d });
          } else if (p.type === "error") {
            throw p.error instanceof Error ? p.error : new Error(String(p.error?.message ?? p.error));
          }
        }
        const f = final as { title: string; template: SqlTemplate; rows: any[] } | null;
        send({ t: "done", title: f?.title ?? prompt.slice(0, 80), template: f?.template ?? null, rows: f?.rows ?? null });
      } catch (e) {
        if (!signal.aborted) send({ t: "error", error: (e as Error).message || "Eroare la asistent." });
      } finally {
        try { ctrl.close(); } catch { /* closed */ }
      }
    },
  });
}

