import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  isStepCount,
  jsonSchema,
  streamText,
  tool,
  type UIMessage,
} from "npm:ai@7.0.123";
import { createLovableAiGatewayRunIdFetch } from "../_shared/run-id.ts";
import { isDue, runAgent } from "./agents.ts";
import {
  LEGACY_ANON,
  addDays,
  bucharestDay,
  makeClients,
  overviewWithTrend,
  requireAdmin,
  runQuery,
  TABLES,
  type QuerySpec,
} from "./data.ts";

const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers": `${baseCors["Access-Control-Allow-Headers"] ?? "authorization, x-client-info, apikey, content-type"}, x-app-token`,
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "google/gemini-3.8-flash";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function gateway() {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY lipsește");
  const run = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: run.fetch,
  });
  return provider(MODEL);
}

function friendlyError(e: unknown): string {
  const any = e as any;
  const status = any?.statusCode ?? any?.status ?? any?.cause?.statusCode;
  if (status === 402) return "Creditele AI ale spațiului de lucru s-au terminat. Adaugă credite din Settings → Plans & credits.";
  if (status === 429) return "Prea multe cereri către AI în acest moment. Încearcă din nou în câteva secunde.";
  if (status === 403) return any?.message || "Accesul la modelul AI a fost refuzat.";
  return any?.message ? `Eroare: ${any.message}` : "A apărut o eroare neașteptată.";
}

const tableList = Object.entries(TABLES).map(([k, v]) => `- ${k}: ${v.desc}`).join("\n");

const querySchema = {
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

function instructions(today: string) {
  return `Ești **Argus**, ochiul atotvăzător al CEO-ului firmei Coral Biogreens (producție de verdețuri/microplante ambalate, depozite de Materii Prime, Ambalaje, Etichete, producție pe linii, picking, livrări la magazine precum Auchan, Metro, Mega Image).
Vorbești în română, direct, ca un director de operațiuni sincer: cifre concrete, ce merge bine, ce nu merge, cine greșește, riscuri și recomandări. Nu inventa niciodată cifre — folosește doar instrumentele. Dacă datele lipsesc sau sunt incomplete, spune clar.
Azi este ${today} (fus orar Europe/Bucharest).

Instrumente:
1. metrici_perioada — tablou complet (oameni, producție, depozite, anomalii, rebut pe motive, calitate la recepție: pierdere calitativă kg/%, defecte, furnizori, comparație cu perioada anterioară). Începe cu el pentru întrebări generale.
2. interogare_date — citește/agregă orice tabel de mai jos. Folosește grupare+sume pentru totaluri.
3. genereaza_raport — când CEO-ul cere un raport/Excel: definește interogarea; utilizatorul primește un buton de descărcare.

Tabele:
${tableList}

Observații: cantitate_produsa în sesiuni e în bucăți; rebutul e în kg; comenzile cu tip_comanda PRODUCTIE_AVANS sunt producție în avans, REAMBALARE sunt reambalări, restul sunt comenzi ferme. Recepțiile cu document_number care conține "corec" sunt corecții de stoc. Timpul din aplicație (app_activity_pings) poate fi incomplet dacă utilizatorii nu au pagina deschisă.
Formatează răspunsul în markdown, cu tabele scurte și concluzii la final ("Ce aș face eu").`;
}

async function handleChat(req: Request, c: ReturnType<typeof makeClients>, userId: string) {
  const body = await req.json();
  const threadId = String(body.threadId ?? "");
  const messages = body.messages as UIMessage[];
  if (!threadId || !Array.isArray(messages)) return json({ error: "Cerere invalidă" }, 400);
  const { data: th } = await c.cloud.from("argus_threads").select("id,title").eq("id", threadId).eq("user_id", userId).maybeSingle();
  if (!th) return json({ error: "Conversația nu există" }, 404);

  const today = bucharestDay();
  const tools = {
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
    genereaza_raport: tool({
      description: "Pregătește un raport Excel descărcabil pe baza unei interogări.",
      inputSchema: jsonSchema<{ titlu: string; descriere: string; interogare: QuerySpec }>({
        type: "object", additionalProperties: false, required: ["titlu", "descriere", "interogare"],
        properties: { titlu: { type: "string" }, descriere: { type: "string" }, interogare: querySchema as any },
      }),
      execute: async ({ titlu, descriere, interogare }) => {
        try {
          const r = await runQuery(c, interogare);
          return { titlu, descriere, interogare, total_randuri: r.randuri.length, previzualizare: r.randuri.slice(0, 5) };
        } catch (e) { return { eroare: String((e as Error).message) }; }
      },
    }),
  };

  // Gemini rejects replayed tool calls from earlier turns (missing signatures / unpaired calls).
  // Send earlier turns as plain text only; tools run fresh in the current turn.
  const history: UIMessage[] = messages
    .map((m) => m.role !== "assistant" ? m : {
      ...m,
      parts: (m.parts as any[]).filter((p) => p.type === "text" && String(p.text ?? "").trim()),
    } as UIMessage)
    .filter((m) => (m.parts as any[]).length > 0);

  const result = streamText({
    model: gateway(),
    instructions: instructions(today),
    messages: await convertToModelMessages(history),
    tools,
    stopWhen: isStepCount(30),
    // Before the step budget runs out, force a written answer from the data already gathered.
    prepareStep: ({ stepNumber }: { stepNumber: number }) =>
      stepNumber >= 27
        ? { toolChoice: "none" as const, system: instructions(today) + "\n\nAi adunat suficiente date. NU mai apela instrumente. Scrie ACUM răspunsul final complet, cu cifrele obținute; spune clar ce date lipsesc." }
        : undefined,
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    headers: corsHeaders,
    originalMessages: messages,
    sendReasoning: true,
    onError: friendlyError,
    onFinish: async ({ messages: all }) => {
      const { error: delErr } = await c.cloud.from("argus_messages").delete().eq("thread_id", threadId);
      if (delErr) { console.error("argus delete", delErr); return; }
      const base = Date.now() - all.length;
      const rows = all.map((m, i) => ({
        thread_id: threadId, sdk_id: m.id, role: m.role, message: m,
        created_at: new Date(base + i).toISOString(),
      }));
      const { error } = await c.cloud.from("argus_messages").insert(rows);
      if (error) console.error("argus insert", error);
      const firstUser = all.find((m) => m.role === "user");
      const text = firstUser?.parts.map((p: any) => (p.type === "text" ? p.text : "")).join(" ").trim();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (th.title === "Conversație nouă" && text) patch.title = text.slice(0, 70);
      const { error: upErr } = await c.cloud.from("argus_threads").update(patch).eq("id", threadId);
      if (upErr) console.error("argus thread update", upErr);
    },
  });
}

async function handleSummary(c: ReturnType<typeof makeClients>, refresh: boolean) {
  const today = bucharestDay();
  if (!refresh) {
    const { data } = await c.cloud.from("argus_daily_summaries").select("content,created_at").eq("day", today).maybeSingle();
    if (data) return json({ day: today, content: data.content, created_at: data.created_at });
  }
  const y = addDays(today, -1);
  const full = await overviewWithTrend(c, y, y);
  const stats = { ...full, calitate: { ...full.calitate, probleme: full.calitate.probleme.slice(0, 25).map(({ poze, ...x }: any) => ({ ...x, poze: poze.length })) }, depozite: Object.fromEntries(Object.entries(full.depozite).map(([k, v]: any) => [k, { ...v, lista: undefined }])), rebut: { ...full.rebut, inregistrari: full.rebut.inregistrari.slice(0, 20) } };
  const result = streamText({
    model: gateway(),
    instructions: `Ești Argus, analistul CEO-ului Coral Biogreens. Scrie rezumatul de dimineață în română, markdown, maxim 300 de cuvinte, cu secțiunile: **Ce a mers bine**, **Ce nu a mers**, **Pierderi, rebut și calitate** (rebut kg și pe motive, pierdere calitativă la recepție în kg și %, defecte, furnizori cu marfă proastă, câte poze de neconformitate), **Oameni**, **De urmărit azi**. Folosește doar cifrele primite, compară cu ziua anterioară. Fără introducere.`,
    prompt: `Date pentru ziua ${y} (JSON):\n${JSON.stringify(stats).slice(0, 60000)}`,
  });
  let content = "";
  try {
    content = (await result.text).trim();
  } catch (e) {
    return json({ error: friendlyError(e) }, (e as any)?.statusCode ?? 500);
  }
  if (!content) return json({ error: "Modelul nu a returnat un rezumat." }, 502);
  const { error } = await c.cloud.from("argus_daily_summaries").upsert({ day: today, content, created_at: new Date().toISOString() }, { onConflict: "day" });
  if (error) console.error("argus summary save", error);
  return json({ day: today, content, created_at: new Date().toISOString() });
}

async function latestReports(c: ReturnType<typeof makeClients>, ids: string[]) {
  const out: Record<string, any> = {};
  if (!ids.length) return out;
  const { data } = await c.cloud.from("argus_generated_reports").select("template_id,status,content_json,executed_at,error")
    .in("template_id", ids).order("executed_at", { ascending: false }).limit(ids.length * 4);
  const pending: Record<string, boolean> = {};
  for (const r of data ?? []) {
    if (r.status === "pending" && Date.now() - new Date(r.executed_at).getTime() < 5 * 60_000) pending[r.template_id] = true;
    if (!out[r.template_id] && r.status !== "pending") out[r.template_id] = r;
  }
  for (const id of ids) if (pending[id]) out[id] = { ...(out[id] ?? {}), running: true };
  return out;
}

async function handleAgents(action: string, url: URL, req: Request, c: ReturnType<typeof makeClients>, userId: string, email: string) {
  const id = url.searchParams.get("id") ?? "";
  switch (action) {
    case "agents_list": {
      const { data: cards, error } = await c.cloud.from("argus_user_dashboard_cards")
        .select("id,template_id,position_order,column_span,argus_report_templates(*)").eq("user_id", userId).order("position_order");
      if (error) throw error;
      const { data: job } = await c.cloud.from("argus_job_state").select("paused_reason").eq("job", "agents").maybeSingle();
      return json({ cards, reports: await latestReports(c, (cards ?? []).map((x: any) => x.template_id)), paused: job?.paused_reason ?? null, me: userId });
    }
    case "agents_library": {
      const { data, error } = await c.cloud.from("argus_report_templates").select("*").eq("is_public", true).order("created_at", { ascending: false });
      if (error) throw error;
      const { data: mine } = await c.cloud.from("argus_user_dashboard_cards").select("template_id").eq("user_id", userId);
      return json({ templates: data, mine: (mine ?? []).map((x: any) => x.template_id) });
    }
    case "agent_create": {
      const b = await req.json();
      const title = String(b.title ?? "").trim().slice(0, 150), prompt = String(b.prompt_instructions ?? "").trim().slice(0, 4000);
      if (!title || !prompt) return json({ error: "Titlul și instrucțiunile sunt obligatorii." }, 400);
      const w = ["auto", "bar_chart", "line_chart", "pie_chart", "kpi", "table", "markdown"].includes(b.preferred_widget_type) ? b.preferred_widget_type : "auto";
      const s = ["on_demand", "daily", "weekly", "monthly"].includes(b.schedule_type) ? b.schedule_type : "on_demand";
      const { data: t, error } = await c.cloud.from("argus_report_templates").insert({
        title, description: String(b.description ?? "").slice(0, 500), prompt_instructions: prompt,
        preferred_widget_type: w, schedule_type: s, is_public: !!b.is_public, created_by: userId, created_by_name: email,
        last_scheduled_at: s === "on_demand" ? null : new Date().toISOString(),
      }).select("*").single();
      if (error) throw error;
      await addCard(c, userId, t.id, w.endsWith("chart") || w === "table" ? 2 : 1);
      return json(t);
    }
    case "agent_add": {
      const { data: t } = await c.cloud.from("argus_report_templates").select("id,is_public,created_by").eq("id", id).maybeSingle();
      if (!t || (!t.is_public && t.created_by !== userId)) return json({ error: "Șablonul nu există." }, 404);
      await addCard(c, userId, id, 1);
      return json({ ok: true });
    }
    case "agent_run": {
      const { data: card } = await c.cloud.from("argus_user_dashboard_cards").select("id").eq("user_id", userId).eq("template_id", id).maybeSingle();
      if (!card) return json({ error: "Agentul nu e pe tabloul tău." }, 404);
      const { data: t } = await c.cloud.from("argus_report_templates").select("*").eq("id", id).single();
      const r = await runAgent(c, gateway(), querySchema, t, "manual");
      if (!r.ok && (r.status === 402 || r.status === 403 || r.status === 429)) return json({ error: friendlyError({ status: r.status }) }, r.status);
      return json({ ok: r.ok });
    }
    case "agent_card_update": {
      const b = await req.json();
      const patch: Record<string, unknown> = {};
      if ([1, 2, 3].includes(b.column_span)) patch.column_span = b.column_span;
      if (Number.isInteger(b.position_order)) patch.position_order = b.position_order;
      const { error } = await c.cloud.from("argus_user_dashboard_cards").update(patch).eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return json({ ok: true });
    }
    case "agents_reorder": {
      const ids = ((await req.json()).ids ?? []) as string[];
      for (let i = 0; i < ids.length; i++) await c.cloud.from("argus_user_dashboard_cards").update({ position_order: i }).eq("id", ids[i]).eq("user_id", userId);
      return json({ ok: true });
    }
    case "agent_card_remove": {
      const { error } = await c.cloud.from("argus_user_dashboard_cards").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return json({ ok: true });
    }
    case "agent_update": {
      const b = await req.json();
      const patch: Record<string, unknown> = {};
      if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 150);
      if (typeof b.description === "string") patch.description = b.description.slice(0, 500);
      if (typeof b.prompt_instructions === "string" && b.prompt_instructions.trim()) patch.prompt_instructions = b.prompt_instructions.trim().slice(0, 4000);
      if (["auto", "bar_chart", "line_chart", "pie_chart", "kpi", "table", "markdown"].includes(b.preferred_widget_type)) patch.preferred_widget_type = b.preferred_widget_type;
      if (["on_demand", "daily", "weekly", "monthly"].includes(b.schedule_type)) {
        patch.schedule_type = b.schedule_type;
        if (b.schedule_type !== "on_demand") patch.last_scheduled_at = new Date().toISOString();
      }
      if (typeof b.is_public === "boolean") patch.is_public = b.is_public;
      if (!Object.keys(patch).length) return json({ error: "Nimic de modificat." }, 400);
      const { data: t, error } = await c.cloud.from("argus_report_templates").update(patch).eq("id", id).eq("created_by", userId).select("id").maybeSingle();
      if (error) throw error;
      if (!t) return json({ error: "Poți edita doar agenții creați de tine." }, 403);
      return json({ ok: true });
    }
    case "agent_delete": {
      const { error } = await c.cloud.from("argus_report_templates").delete().eq("id", id).eq("created_by", userId);
      if (error) throw error;
      return json({ ok: true });
    }
    case "agents_resume": {
      await c.cloud.from("argus_job_state").upsert({ job: "agents", paused_reason: null, locked_until: null, updated_at: new Date().toISOString() });
      return json({ ok: true });
    }
  }
  return json({ error: "Acțiune necunoscută" }, 400);
}

async function addCard(c: ReturnType<typeof makeClients>, userId: string, templateId: string, span: number) {
  const { data: last } = await c.cloud.from("argus_user_dashboard_cards").select("position_order").eq("user_id", userId).order("position_order", { ascending: false }).limit(1).maybeSingle();
  await c.cloud.from("argus_user_dashboard_cards").upsert(
    { user_id: userId, template_id: templateId, position_order: (last?.position_order ?? -1) + 1, column_span: span },
    { onConflict: "user_id,template_id", ignoreDuplicates: true },
  );
}

/** Scheduled run (06:00 Bucharest). Bounded, single-flight, idempotent, paused on credit/policy errors. */
async function handleCron() {
  const c = makeClients(LEGACY_ANON);
  const now = new Date();
  const { data: st } = await c.cloud.from("argus_job_state").select("*").eq("job", "agents").maybeSingle();
  if (st?.paused_reason) return json({ skipped: "paused", reason: st.paused_reason });
  if (st?.locked_until && new Date(st.locked_until) > now) return json({ skipped: "locked" });
  await c.cloud.from("argus_job_state").upsert({ job: "agents", locked_until: new Date(now.getTime() + 10 * 60_000).toISOString(), updated_at: now.toISOString() });
  let ran = 0;
  try {
    const { data: ts } = await c.cloud.from("argus_report_templates").select("*").neq("schedule_type", "on_demand").limit(200);
    const due = (ts ?? []).filter((t) => isDue(t, now)).slice(0, 15);
    for (const t of due) {
      await c.cloud.from("argus_report_templates").update({ last_scheduled_at: now.toISOString() }).eq("id", t.id);
      const r = await runAgent(c, gateway(), querySchema, t, "cron");
      ran++;
      if (!r.ok && (r.status === 402 || r.status === 403)) {
        await c.cloud.from("argus_job_state").upsert({ job: "agents", paused_reason: friendlyError({ status: r.status }), updated_at: new Date().toISOString() });
        break;
      }
      if (!r.ok && r.status === 429) break;
    }
  } finally {
    await c.cloud.from("argus_job_state").update({ locked_until: null }).eq("job", "agents");
  }
  return json({ ran });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    if (action === "cron_agents") return await handleCron();
    const token = req.headers.get("x-app-token");
    const auth = await requireAdmin(token);
    if ("error" in auth) return json({ error: auth.error }, auth.status);
    const userId = auth.user.id;
    const c = makeClients(token!);
    if (action.startsWith("agents_") || action.startsWith("agent_")) return await handleAgents(action, url, req, c, userId, auth.user.email);


    switch (action) {
      case "overview": {
        const from = url.searchParams.get("from") ?? "", to = url.searchParams.get("to") ?? "";
        if (!DAY_RE.test(from) || !DAY_RE.test(to) || from > to) return json({ error: "Perioadă invalidă" }, 400);
        return json(await overviewWithTrend(c, from, to));
      }
      case "report": {
        const spec = (await req.json()).interogare as QuerySpec;
        const r = await runQuery(c, spec);
        return json(r);
      }
      case "summary":
        return await handleSummary(c, url.searchParams.get("refresh") === "1");
      case "threads": {
        const { data, error } = await c.cloud.from("argus_threads").select("id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
        if (error) throw error;
        return json(data);
      }
      case "create_thread": {
        const { data, error } = await c.cloud.from("argus_threads").insert({ user_id: userId }).select("id,title,updated_at").single();
        if (error) throw error;
        return json(data);
      }
      case "delete_thread": {
        const id = url.searchParams.get("id") ?? "";
        const { error } = await c.cloud.from("argus_threads").delete().eq("id", id).eq("user_id", userId);
        if (error) throw error;
        return json({ ok: true });
      }
      case "messages": {
        const id = url.searchParams.get("id") ?? "";
        const { data: th } = await c.cloud.from("argus_threads").select("id,title").eq("id", id).eq("user_id", userId).maybeSingle();
        if (!th) return json({ error: "Conversația nu există" }, 404);
        const { data, error } = await c.cloud.from("argus_messages").select("message").eq("thread_id", id).order("created_at");
        if (error) throw error;
        return json({ thread: th, messages: (data ?? []).map((r: any) => r.message) });
      }
      case "chat":
        return await handleChat(req, c, userId);
      default:
        return json({ error: "Acțiune necunoscută" }, 400);
    }
  } catch (e) {
    console.error("argus", e);
    return json({ error: (e as Error).message ?? "Eroare" }, 500);
  }
});
