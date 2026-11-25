import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAI } from "npm:@ai-sdk/openai@4";
import { createAnthropic } from "npm:@ai-sdk/anthropic@4";
import { loadMemory, memoryTools, backfillMemory } from "./memory.ts";
import { querySchema, readTools } from "./readTools.ts";
import { instructions } from "./instructions.ts";
import { answerCopilot, copilotResponse } from "./copilot.ts";
import {
  consumeStream,
  convertToModelMessages,
  generateText,
  isStepCount,
  jsonSchema,
  streamText,
  tool,
  type UIMessage,
} from "npm:ai@7.0.123";
import { createLovableAiGatewayRunIdFetch, withLovableAiGatewayRunIdHeader } from "../_shared/run-id.ts";
import { isDue, runAgent } from "./agents.ts";
import { validFilters } from "./agentFilters.ts";
import { validReportView } from "./reportView.ts";
import { actionTools, handleActionDecision } from "./actions.ts";
import { syncSeniorPackaging } from '../_shared/seniorPackaging.ts';
import { filtersForTemplate, parameterizeSql, validLiveSpec, type LiveSpec } from "./liveReports.ts";
import { filterOptions } from "./filterOptions.ts";
import { agentBuilderTools } from "./agentBuilder.ts";
import { priceCalcData, priceHistoryData, priceListData, priceOptions } from "../_shared/priceCalcSenior.ts";
import { partnerMirrorSales } from "../_shared/partnerMirror.ts";
import { DEFAULT_PRICE_RULES, loadPriceRules, rememberPriceRoute, savePriceRules } from "../_shared/priceRules.ts";
import { SALES_PRICING_ACTIONS, PURCHASING_RADAR_ACTIONS } from "../_shared/crmRules.ts";
import { validateHallLayout } from "../_shared/hallLayoutRules.ts";
import { officeActivity, saveOfficeConfig } from "../_shared/officeActivity.ts";
import { viziunePallets } from "../_shared/viziunePallets.ts";
import { cleanCopilotRequest, parseCopilotReply, voiceText, COPILOT_LIMITS } from "../_shared/viziuneCopilotRules.ts";
import { generateSpeech, streamSpeech, transcribeAudio, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.13";
import type {} from "../_shared/generated/ai-gateway/models.d.ts";
import { speechRetryResponse, transcriptText } from "../_shared/copilotTranscription.ts";
import { purchasingProjectionStep } from '../_shared/forecastProjectionRules.ts';
import { encodeBase64, decodeBase64 } from "jsr:@std/encoding@1/base64";
import { receptionPriceSafety } from '../_shared/receiptPriceSafety.ts';
import { recipeCaseAudit } from "../_shared/recipeCaseAudit.ts";
import { scanPrompt, parseScan } from "../_shared/futureScan.ts";
import { argusMode, futureInstructions } from "../_shared/futureConversationRules.ts";
import { futureTools } from "./futureTools.ts";
import { rawMaterialPrices } from "../_shared/rawMaterialPrices.ts";
import { validSubstitutions } from "../_shared/substitutionRules.ts";
import { packagingStoreKey, packagingUnits } from '../_shared/packagingRules.ts';
import { uploadAttachment, attachmentDownload, expandAttachments, deleteThreadAttachments, attachmentSummaries, rereadAttachment } from "./files.ts";
import { validChatMessages, readChatHistory, repairChatMessageIds, isEmptyAssistant, markFailedTurn } from "./chatHistory.ts";
import { rollingContext } from "./context.ts";
import { radarSettings, saveRadarSettings, radarSnapshot } from "./radar.ts";
import { supplierPriceList, saveSupplierPriceList, supplierPriceAudit } from "./supplierPrices.ts";
import { compactData, attachmentManifest, messageText } from "./contextRules.ts";
import {
  LEGACY_ANON,
  addDays,
  bucharestDay,
  makeClients,
  overviewWithTrend,
  requireAdmin,
  requirePricing,
  requirePurchasing,
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

// All Argus calls (chat, compaction, summaries, memory backfill) run on one OpenAI reasoning model.
const MODEL = "openai/gpt-6-astra";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function gateway(run = createLovableAiGatewayRunIdFetch()) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY lipsește");
  // gpt-6-astra supports tools only on the Responses surface.
  return createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key, headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" }, fetch: run.fetch }).responses(MODEL);
}

// Main chat brain: Claude Sonnet (messages surface) — direct tables/SQL without long hidden reasoning loops.
const CHAT_MODEL = "anthropic/claude-sonnet-5";
function brain(run: ReturnType<typeof createLovableAiGatewayRunIdFetch>) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY lipsește");
  return createAnthropic({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key, headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" }, fetch: run.fetch })(CHAT_MODEL);
}

function friendlyError(e: unknown): string {
  const any = e as any;
  const status = any?.statusCode ?? any?.status ?? any?.cause?.statusCode;
  if (status === 402) return "Creditele AI ale spațiului de lucru s-au terminat. Adaugă credite din Settings → Plans & credits.";
  if (status === 429) return "Prea multe cereri către AI în acest moment. Încearcă din nou în câteva secunde.";
  if (status === 403) return any?.message || "Accesul la modelul AI a fost refuzat.";
  return any?.message ? `Eroare: ${any.message}` : "A apărut o eroare neașteptată.";
}

async function handleChat(req: Request, c: ReturnType<typeof makeClients>, userId: string, email = "") {
  const body = await req.json();
  const threadId = String(body.threadId ?? "");
  const messages = repairChatMessageIds(body.messages as UIMessage[], threadId);
  if (!threadId || !validChatMessages(messages)) return json({ error: "Mesaj invalid. Reîncarcă această conversație și încearcă din nou." }, 400);
  const { data: th } = await c.cloud.from("argus_threads").select("id,title,mode").eq("id", threadId).eq("user_id", userId).maybeSingle();
  if (!th) return json({ error: "Conversația nu există" }, 404);
  const mode = argusMode(th.mode);

  const today = bucharestDay();
  const run = createLovableAiGatewayRunIdFetch();
  const model = gateway(run);
  const smart = brain(run);
  const summarize = async (prompt: string, limit: number) => {
    // Gemini's reasoning consumes the output budget too; never cache a cut-off summary.
    const summary = streamText({ model, providerOptions: { openai: { store: false } }, prompt, maxOutputTokens: Math.max(4096, limit), abortSignal: req.signal, maxRetries: 0 });
    const text = (await summary.text).trim();
    if (await summary.finishReason === 'length') throw new Error('Sinteza a fost întreruptă; memoria anterioară rămâne păstrată.');
    return text;
  };
  let context: Awaited<ReturnType<typeof rollingContext>>;
  let summaries: Map<string, string>;
  try {
    summaries = await attachmentSummaries(messages, c, userId, threadId, summarize);
    context = await rollingContext(messages, c, userId, threadId, summarize);
  } catch (e) { return json({ error: friendlyError(e) }, (e as any)?.statusCode ?? 500); }
  const manifest = attachmentManifest(messages);
  const tools = {
    ...readTools(c, threadId, messages),
    ...(mode === "future" ? futureTools(today) : {}),
    reciteste_atasament: tool({
      description: "Recitește originalul: interval de linii (max 100), sau o imagine scanată după indice 1-based. Referința trebuie să fie din manifest. Imaginea este indice în lista scanărilor, NU număr de pagină PDF.",
      inputSchema: jsonSchema<{ referinta: string; linie: number; numar: number; imagine: number | null }>({ type: 'object', additionalProperties: false, required: ['referinta','linie','numar','imagine'], properties: { referinta: { type: 'string' }, linie: { type: 'integer', minimum: 1 }, numar: { type: 'integer', minimum: 1, maximum: 100 }, imagine: { type: ['integer','null'] } } }),
      execute: async ({ referinta, linie, numar, imagine }) => {
        if (!manifest.some(f => f.reference === referinta)) return { eroare: 'Atașamentul nu este în conversație.' };
        try { return await rereadAttachment(c, referinta, userId, threadId, linie, numar, imagine); }
        catch (e) { return { eroare: (e as Error).message }; }
      },
      toModelOutput: ({ output }: any) => {
        const { image, ...text } = output;
        return image ? { type: 'content' as const, value: [{ type: 'text' as const, text: compactData(text) }, { type: 'file' as const, mediaType: image.slice(5, image.indexOf(';')), data: { type: 'data' as const, data: image.split(',')[1] } }] } : { type: 'text' as const, value: compactData(text) };
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
    ...(mode === "future" ? {} : agentBuilderTools(c, userId, email)),
    ...(mode === "future" ? {} : actionTools(c, userId)),
    ...memoryTools(c, userId, threadId),
  };
  const memory = await loadMemory(c);
  // One-time learning from all past conversations; never blocks the answer.
  (globalThis as any).EdgeRuntime?.waitUntil?.(backfillMemory(c, summarize).catch((e) => console.error("backfill", e)));

  // Gemini rejects replayed tool calls from earlier turns (missing signatures / unpaired calls).
  // Send earlier turns as plain text only; tools run fresh in the current turn.
  let expanded: UIMessage[];
  try { expanded = await expandAttachments(context.recent, c, userId, threadId, summaries); }
  catch (e) { return json({ error: (e as Error).message }, 400); }
  const history: UIMessage[] = expanded
    .filter((m) => !(m.metadata as any)?.failed && !isEmptyAssistant(m as any))
    .map((m) => m.role !== "assistant" ? m : {
      ...m,
      parts: (m.parts as any[]).filter((p) => p.type === "text" && String(p.text ?? "").trim()),
    } as UIMessage)
    .filter((m) => (m.parts as any[]).length > 0);

  // Compress only model-facing output, keeping UI reports/action cards unchanged.
  for (const [name, t] of Object.entries(tools)) {
    if (name !== 'reciteste_atasament') (t as any).toModelOutput = ({ output }: any) => ({ type: 'text', value: compactData(output) });
  }
  const result = streamText({
    model: smart,
    // The SDK does not recognise the gateway slug as a reasoning model; without forceReasoning it drops reasoningEffort.
    maxOutputTokens: 32000,
    instructions: instructions(today) + (mode === "future" ? futureInstructions(today) : "") + `\nMemorie permanentă Coral (reguli din toate conversațiile):\n${memory}\nConversația: ${threadId}. Memorie comprimată (detalii recuperabile):\n${context.summary}\nManifest documente:\n${compactData(manifest.map(f => ({ ...f, summary: attachmentManifest(context.recent).some(r => r.reference === f.reference) ? 'Context recent' : summaries.get(f.reference) ?? 'Nesintetizat; recitește originalul.' })))}`,
    maxRetries: 0,
    messages: await convertToModelMessages(history),
    tools,
    stopWhen: isStepCount(30),
    // Before the step budget runs out, force a written answer from the data already gathered.
    prepareStep: ({ stepNumber }: { stepNumber: number }) =>
      stepNumber >= 22
        ? { toolChoice: "none" as const }
        : purchasingProjectionStep(messageText([...messages].reverse().find(m => m.role === 'user')), stepNumber),
    // No client abort: the answer keeps running and is saved even if the user leaves the page.
  });

  let lastError = "";
  return withLovableAiGatewayRunIdHeader(keepAlive(result.toUIMessageStreamResponse({
    headers: corsHeaders,
    originalMessages: messages,
    generateMessageId: () => crypto.randomUUID(),
    sendReasoning: true,
    // Tee the stream so generation and onFinish complete after the browser disconnects.
    consumeSseStream: ({ stream }) => { (globalThis as any).EdgeRuntime?.waitUntil?.(consumeStream({ stream })); },
    onError: (e) => { lastError = friendlyError(e); console.error("argus chat error", threadId, e); return lastError; },
    onFinish: async ({ messages: finished, isAborted }) => {
      if (isAborted) return;
      // Never save a blank reply: it hides the real error and looks like "Argus finished without answering".
      const all = finished.map((m, i) => i === finished.length - 1 ? markFailedTurn(m, lastError) : m);
      const answer = messageText(all.at(-1) ?? {});
      if (answer) for (const file of manifest.filter(f => !summaries.has(f.reference))) {
        // No extra model call; preserve the first visual analysis, never the pixels.
        const { error } = await c.cloud.from('argus_attachment_summaries').upsert({ thread_id: threadId, user_id: userId, reference: file.reference,
          summary: `Prima analiză (${file.filename}); poate include și alte documente și NU înlocuiește originalul. Recitește imaginea pentru cifre exacte.\n${answer.slice(0, 4000)}` });
        if (error) console.error('argus attachment summary save', error.message);
      }
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
  })), run);
}

// SSE comment pings keep the connection alive while Senior queries or long reasoning emit no bytes; the UI parser ignores comments.
function keepAlive(res: Response, everyMs = 10_000): Response {
  if (!res.body) return res;
  const reader = res.body.getReader();
  const ping = new TextEncoder().encode(": ping\n\n");
  let timer: number | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(ctrl) { timer = setInterval(() => { try { ctrl.enqueue(ping); } catch { clearInterval(timer); } }, everyMs); },
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) { clearInterval(timer); ctrl.close(); } else ctrl.enqueue(value);
    },
    cancel(r) { clearInterval(timer); return reader.cancel(r); },
  });
  return new Response(body, { status: res.status, headers: res.headers });
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
    model: gateway(), providerOptions: { openai: { store: false, include: ["reasoning.encrypted_content"] } },
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
    if (r.status === "pending" && Date.now() - new Date(r.executed_at).getTime() < 10 * 60_000) pending[r.template_id] = true;
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
        .select("id,template_id,position_order,column_span,report_view,argus_report_templates(*)").eq("user_id", userId).order("position_order");
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
        params: validFilters(b.params),
        live_spec: b.live_spec ? validLiveSpec(b.live_spec) : null,
      }).select("*").single();
      if (error) throw error;
      await addCard(c, userId, t.id, w.endsWith("chart") || w === "table" ? 2 : 1);
      return json(t);
    }
    case "agent_propose_filters": {
      // Argus proposes editable filters for a report saved from chat; the user confirms/edits before saving.
      const b = await req.json();
      const q = String(b.question ?? "").slice(0, 2000), a = String(b.answer ?? "").slice(0, 3000);
      try {
        const res = await generateText({
          model: gateway(), providerOptions: { openai: { store: false, include: ["reasoning.encrypted_content"] } },
          instructions: `Ești Argus. Utilizatorul salvează un raport ca agent reutilizabil. Propune filtrele pe care ar vrea să le schimbe la fiecare rulare (perioadă, produs, client/magazin, furnizor, linie etc.), doar cele relevante cererii, max 5.
Răspunde DOAR cu JSON: {"mesaj": str (o frază scurtă în română care explică de ce le propui), "filtre": [{"label": str, "type": "period"|"lookup"|"text"|"choice", "source": "produs"|"client"|"furnizor" (doar la lookup), "options": [str] (doar la choice), "default": str}]}
Pentru produs, client sau furnizor folosește OBLIGATORIU type "lookup" cu source potrivit (utilizatorul alege dintr-o listă Senior, nu scrie).
La period, default este unul din: today, yesterday, last_7, last_30, this_month, last_month. La text/choice, default este valoarea folosită în cerere sau "" pentru toate.`,
          prompt: `Cererea:\n${q}\n\nRăspunsul lui Argus:\n${a}`,
        });
        const raw = res.text.trim(), s = raw.indexOf("{"), e = raw.lastIndexOf("}");
        const parsed = s >= 0 && e > s ? JSON.parse(raw.slice(s, e + 1)) : {};
        return json({ mesaj: String(parsed.mesaj ?? "").slice(0, 300), filtre: validFilters(parsed.filtre) });
      } catch (e) {
        return json({ mesaj: "", filtre: [{ name: "perioada", label: "Perioadă", type: "period", default: "last_30" }], eroare: friendlyError(e) });
      }
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
      const body = await req.json().catch(() => ({}));
      if (t?.live_spec) {
        // Saved live report: code-only refresh, a few seconds, no AI credits.
        const r: any = await runAgent(c, null, querySchema, t, "manual", body?.values && typeof body.values === "object" ? body.values : {});
        return json({ ok: !!r?.ok });
      }
      // Live Senior reads can take minutes: run in the background; the dashboard polls the pending report.
      const job = runAgent(c, gateway(), querySchema, t, "manual", body?.values && typeof body.values === "object" ? body.values : {}).catch((e) => console.error("agent_run", e));
      const wu = (globalThis as any).EdgeRuntime?.waitUntil;
      if (wu) { wu.call((globalThis as any).EdgeRuntime, job); return json({ ok: true, background: true }); }
      const r: any = await job;
      if (r && !r.ok && (r.status === 402 || r.status === 403 || r.status === 429)) return json({ error: friendlyError({ status: r.status }) }, r.status);
      return json({ ok: !!r?.ok });
    }
    case "agent_card_update": {
      const b = await req.json();
      const patch: Record<string, unknown> = {};
      if ([1, 2, 3].includes(b.column_span)) patch.column_span = b.column_span;
      if (Number.isInteger(b.position_order)) patch.position_order = b.position_order;
      if (Object.prototype.hasOwnProperty.call(b, "report_view")) {
        try { patch.report_view = validReportView(b.report_view); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
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
      if (Array.isArray(b.params)) patch.params = validFilters(b.params);
      // Only an explicit user choice in the editor converts a live report into an AI agent.
      if (Object.prototype.hasOwnProperty.call(b, "live_spec") && b.live_spec === null) patch.live_spec = null;
      if (!Object.keys(patch).length) return json({ error: "Nimic de modificat." }, 400);
      const { data: t, error } = await c.cloud.from("argus_report_templates").update(patch).eq("id", id).eq("created_by", userId).select("id").maybeSingle();
      if (error) throw error;
      if (!t) return json({ error: "Poți edita doar agenții creați de tine." }, 403);
      return json({ ok: true });
    }
    case "live_save": {
      const b = await req.json();
      const title = String(b.title ?? "").trim().slice(0, 150) || "Raport live";
      let spec: LiveSpec | null = null;
      if (b.kind === "sql") {
        const sql = String(b.sql ?? "").trim();
        if (!sql) return json({ error: "Lipsește interogarea." }, 400);
        try { spec = { kind: "sql", template: await parameterizeSql(gateway(), sql, String(b.question ?? ""), bucharestDay()) }; }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      } else spec = validLiveSpec(b);
      if (!spec) return json({ error: "Raportul nu poate fi salvat." }, 400);
      const params = spec.kind === "sql" ? filtersForTemplate(spec.template) : [];
      const { data: t, error } = await c.cloud.from("argus_report_templates").insert({
        title, description: spec.kind === "sql" ? "Raport live din chat · se actualizează direct din Senior, fără credite AI" : "Fișă de preț live · recalculată din Senior, fără credite AI",
        prompt_instructions: spec.kind === "sql" ? `[raport live] ${String(b.question ?? "").slice(0, 1000)}` : `[fișă preț live] ${spec.product}`,
        preferred_widget_type: "table", schedule_type: "on_demand", is_public: false, created_by: userId, created_by_name: email,
        params, live_spec: spec,
      }).select("*").single();
      if (error) throw error;
      await addCard(c, userId, t.id, 2);
      const run: any = await runAgent(c, null, querySchema, t, "manual", {});
      return json({ ...t, firstRunOk: !!run?.ok });
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

async function handlePackaging(action: string, url: URL, req: Request, c: ReturnType<typeof makeClients>) {
  const id = url.searchParams.get("id") ?? "";
  if (action === 'packaging_senior_sync' || action === 'packaging_store_save') {
    const b = await req.json();
    if (typeof b.produs_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.produs_id)) return json({ error: 'Produs invalid.' }, 400);
    const { data: product, error: productError } = await c.legacyUser.from('productie_produse').select('id').eq('id', b.produs_id).maybeSingle();
    if (productError) throw productError;
    if (!product) return json({ error: 'Produsul nu există.' }, 404);
    if (action === 'packaging_senior_sync') return json(await syncSeniorPackaging(c.legacy, c.cloud, b.produs_id));
    const store = typeof b.magazin === 'string' ? b.magazin.trim() : '';
    const units = b.units === null ? null : packagingUnits(b.units);
    if (!store || store.length > 200 || (b.units !== null && !units)) return json({ error: 'Alege magazinul și o baxare validă.' }, 400);
    const { data, error } = await c.cloud.from('productie_baxare_magazine').upsert({
      produs_id: b.produs_id, magazin_key: packagingStoreKey(store), magazin: store,
      manual_units: units, updated_at: new Date().toISOString(),
    }, { onConflict: 'produs_id,magazin_key' }).select().single();
    if (error) throw error;
    return json(data);
  }
  if (action === "packaging_save") {
    const b = await req.json();
    const clean = (value: unknown, max = 200) => String(value ?? "").trim().slice(0, max);
    const row = {
      client_name: clean(b.client_name, 150),
      client_order: Math.max(0, Number.isInteger(b.client_order) ? b.client_order : 0),
      subgroup: clean(b.subgroup, 200) || null,
      product_name: clean(b.product_name, 200),
      weight: clean(b.weight, 80),
      primary_packaging: clean(b.primary_packaging),
      tertiary_packaging: clean(b.tertiary_packaging),
      units_per_case: clean(b.units_per_case, 80),
      position: Math.max(1, Number.isInteger(b.position) ? b.position : 1),
    };
    if (!row.client_name || !row.product_name || !row.weight || !row.primary_packaging || !row.tertiary_packaging || !row.units_per_case) {
      return json({ error: "Completează toate câmpurile obligatorii." }, 400);
    }
    if (id) {
      const { error } = await c.cloud.from("packaging_methods").update(row).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }
    const { data, error } = await c.cloud.from("packaging_methods").insert(row).select("id").single();
    if (error) throw error;
    return json(data);
  }
  if (action === "packaging_delete") {
    if (!id) return json({ error: "Înregistrarea lipsește." }, 400);
    const { error } = await c.cloud.from("packaging_methods").delete().eq("id", id);
    if (error) throw error;
    return json({ ok: true });
  }
  return json({ error: "Acțiune necunoscută" }, 400);
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
    const auth = SALES_PRICING_ACTIONS.has(action) ? await requirePricing(token)
      : PURCHASING_RADAR_ACTIONS.has(action) ? await requirePurchasing(token) : await requireAdmin(token);
    if ("error" in auth) return json({ error: auth.error }, auth.status);
    const userId = auth.user.id;
    if (!token) return json({ error: "Autentificare necesară." }, 401);
    const c = makeClients(token);
    if (action.startsWith("agents_") || action.startsWith("agent_") || action === "live_save") return await handleAgents(action, url, req, c, userId, auth.user.email);
    if (action.startsWith("packaging_")) return await handlePackaging(action, url, req, c);


    switch (action) {
      case 'receipt_price_safety': {
        try { return json(await receptionPriceSafety(c.cloud, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "price_options": {
        try { return json(await priceOptions(c.cloud, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "future_scan": {
        try {
          const run = createLovableAiGatewayRunIdFetch();
          const key = Deno.env.get("LOVABLE_API_KEY");
          if (!key) throw new Error("LOVABLE_API_KEY lipsește");
          const anthropic = createAnthropic({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key, headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" }, fetch: run.fetch });
          const today = new Date().toISOString().slice(0, 10);
          const r = await generateText({ model: anthropic(CHAT_MODEL), prompt: scanPrompt(today), tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 12 }) } as any, stopWhen: isStepCount(15) } as any);
          return json(parseScan(r.text, today));
        } catch (e) { return json({ error: friendlyError(e) }, 400); }
      }
      case "recipe_case_audit": {
        try { return json(await recipeCaseAudit(c.cloud)); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "filter_options": {
        try { return json(await filterOptions(c.cloud, String(url.searchParams.get("source") ?? ""))); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "price_calc": {
        try { return json(await priceCalcData(c.cloud, c.legacyUser, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "price_rules": {
        try { return json({ ...(await loadPriceRules(c.cloud)), defaults: DEFAULT_PRICE_RULES }); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "price_rules_save": {
        if (req.method !== "POST") return json({ error: "Metodă invalidă." }, 405);
        try { return json({ ...(await savePriceRules(c.cloud, (await req.json())?.rules, auth.user.email ?? userId)), defaults: DEFAULT_PRICE_RULES }); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "price_route_remember": {
        if (req.method !== "POST") return json({ error: "Metodă invalidă." }, 405);
        try { return json({ ...(await rememberPriceRoute(c.cloud, await req.json(), auth.user.email ?? userId)), defaults: DEFAULT_PRICE_RULES }); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "partner_mirror_sales": {
        try { return json(await partnerMirrorSales(c.cloud, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "price_history": {
        try { return json(await priceHistoryData(c.cloud, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "price_list": {
        try { return json(await priceListData(c.cloud, c.legacyUser, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'restock_mode_save': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        const body = await req.json();
        if (typeof body.auto_enabled !== 'boolean') return json({ error: 'Alege pornit sau oprit.' }, 400);
        const { data, error } = await c.cloud.from('productie_restock_settings').upsert({
          id: true, auto_enabled: body.auto_enabled, updated_by: userId, updated_at: new Date().toISOString(),
        }).select('auto_enabled').single();
        if (error) throw error;
        return json(data);
      }
      case 'retetar_mp_prices': {
        try { return json(await rawMaterialPrices(c.cloud, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'retetar_substitutions_save': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        let s;
        try { s = validSubstitutions(await req.json()); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
        const { error } = await c.cloud.from('productie_retetar_inlocuiri').upsert({
          id: true, rules: s.rules, max_increase_pct: s.maxIncreasePct, updated_by: auth.user.email ?? userId, updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return json(s);
      }
      case 'viziune_pallets': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        try { return json(await viziunePallets(c, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'viziune_offices': {
        try { return json(await officeActivity(c)); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'viziune_offices_save': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        try { return json(await saveOfficeConfig(c, await req.json(), auth.user.email ?? userId)); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'supplier_prices': {
        try { return json(await supplierPriceList(c.cloud)); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'supplier_prices_save': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        try { return json(await saveSupplierPriceList(c.cloud, await req.json(), auth.user.email ?? userId)); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'supplier_price_audit': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        try { return json(await supplierPriceAudit(c.cloud, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'radar_settings': {
        try { return json(await radarSettings(c.cloud)); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'radar_settings_save': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        try { return json(await saveRadarSettings(c.cloud, await req.json(), auth.user.email ?? userId)); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'radar_snapshot': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        try { return json(await radarSnapshot(c.cloud, await req.json())); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case 'voice_transcribe': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        const body = await req.json().catch(() => ({}));
        if (typeof body.audio !== 'string' || body.audio.length > Math.ceil(COPILOT_LIMITS.audioBytes * 4 / 3) + 4) return json({ error: 'Înregistrarea e prea lungă sau invalidă.' }, 400);
        let bytes;
        try { bytes = decodeBase64(body.audio); }
        catch { return json({ error: 'Înregistrare invalidă.' }, 400); }
        if (!bytes.length) return speechRetryResponse(corsHeaders);
        if (bytes.length > COPILOT_LIMITS.audioBytes) return json({ error: 'Înregistrarea e prea lungă.' }, 400);
        const type = /^audio\/[a-z0-9.+-]+/i.exec(String(body.type ?? ''))?.[0] ?? 'audio/webm';
        try {
          const question = transcriptText(await transcribeAudio({ model: 'openai/gpt-transcribe', file: new Blob([bytes], { type }), language: 'ro' }));
          return question ? json({ question }) : speechRetryResponse(corsHeaders);
        } catch (error) { return json({ error: error instanceof GatewayError ? `Nu am înțeles înregistrarea (${error.code}).` : friendlyError(error) }, 400); }
      }
      case 'viziune_copilot': {
        // Same admin-validated read capabilities as the main chat, plus the current 3D picture.
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        const body = await req.json().catch(() => ({}));
        let question = String(body?.question ?? '');
        if (!question.trim() && typeof body?.audio === 'string') {
          const bytes = decodeBase64(body.audio);
          if (!bytes.length) return speechRetryResponse(corsHeaders);
          if (bytes.length > COPILOT_LIMITS.audioBytes) return json({ error: 'Înregistrarea e prea lungă.' }, 400);
          const type = /^audio\/[a-z0-9.+-]+/i.exec(String(body?.type ?? ''))?.[0] ?? 'audio/webm';
          try {
            const t = await transcribeAudio({ model: 'openai/gpt-transcribe', file: new Blob([bytes], { type }), language: 'ro' });
            question = transcriptText(t);
          } catch (e) { return json({ error: e instanceof GatewayError ? `Nu am înțeles înregistrarea (${e.code}).` : friendlyError(e) }, 400); }
          if (!question) return speechRetryResponse(corsHeaders);
        }
        let r;
        try { r = cleanCopilotRequest({ ...body, question }); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
        return copilotResponse(async () => {
          try { return { question: r.question, ...parseCopilotReply(await answerCopilot(c, r), r.lineIds) }; }
          catch (e) { return { question: r.question, error: friendlyError(e) }; }
        }, corsHeaders);
      }
      case 'viziune_voice': {
        // Argus speaks Romanian with a real voice; the browser falls back to its own voice if this fails.
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        const text = voiceText((await req.json().catch(() => ({})))?.text);
        if (!text) return json({ error: 'Nimic de spus.' }, 400);
        try {
          const audio = await generateSpeech({
            model: 'google/gemini-3.1-flash-tts-preview',
            contents: [{ role: 'user', parts: [{ text: `Spune pe un ton calm, sigur și prietenos, ca un prezentator: ${text}` }] }],
            generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } } },
          } as any);
          const blob = await audio.blob();
          return json({ audio: encodeBase64(new Uint8Array(await blob.arrayBuffer())), type: audio.contentType || 'audio/wav' });
        } catch (e) { return json({ error: e instanceof GatewayError ? `Vocea nu e disponibilă (${e.code}).` : friendlyError(e) }, 400); }
      }
      case 'viziune_voice_stream': {
        // Same voice, streamed: raw 16-bit 24 kHz mono PCM bytes as they are synthesised, so Argus starts talking in under a second.
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        const text = voiceText((await req.json().catch(() => ({})))?.text);
        if (!text) return json({ error: 'Nimic de spus.' }, 400);
        let events: AsyncIterable<any>;
        try {
          events = await streamSpeech({
            model: 'google/gemini-3.1-flash-tts-preview',
            contents: [{ role: 'user', parts: [{ text: `Spune pe un ton calm, sigur și prietenos, ca un prezentator: ${text}` }] }],
            generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } } },
          } as any, { signal: req.signal }) as any;
        } catch (e) { return json({ error: e instanceof GatewayError ? `Vocea nu e disponibilă (${e.code}).` : friendlyError(e) }, 400); }
        const body = new ReadableStream<Uint8Array>({
          async start(ctrl) {
            try {
              for await (const e of events) if (e?.type === 'speech.audio.delta' && e.audio) ctrl.enqueue(decodeBase64(e.audio));
            } catch (e) { console.error('viziune_voice_stream', e); }
            ctrl.close();
          },
        });
        return new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'audio/L16; rate=24000; channels=1', 'Cache-Control': 'no-store' } });
      }
      case 'viziune_layout': {
        const { data, error } = await c.cloud.from('viziune_hala_layout').select('stations, updated_by, updated_at').maybeSingle();
        if (error) throw error;
        return json({ layout: data ?? null });
      }
      case 'viziune_layout_save': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        let stations;
        try { stations = validateHallLayout((await req.json())?.stations); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
        const { error } = await c.cloud.from('viziune_hala_layout').upsert({
          id: true, stations, updated_by: auth.user.email ?? userId, updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return json({ stations });
      }
      case 'direct_picking_save':
      case 'direct_picking_delete': {
        if (req.method !== 'POST') return json({ error: 'Metodă invalidă.' }, 405);
        const body = await req.json();
        const produsId = String(body?.produs_id ?? '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(produsId)) return json({ error: 'Alege un produs.' }, 400);
        if (action === 'direct_picking_delete') {
          const { error } = await c.cloud.from('productie_direct_picking').delete().eq('produs_id', produsId);
          if (error) throw error;
          return json({ ok: true });
        }
        const nume = String(body?.produs_nume ?? '').trim().slice(0, 200);
        if (!nume) return json({ error: 'Produsul nu are denumire.' }, 400);
        const { error } = await c.cloud.from('productie_direct_picking').upsert({
          produs_id: produsId, produs_nume: nume, updated_by: auth.user.email ?? userId,
        });
        if (error) throw error;
        return json({ ok: true });
      }
      case "attachment_upload": {
        try { return json(await uploadAttachment(req, c, userId)); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
      case "attachment_download": {
        try { return json(await attachmentDownload(c, url.searchParams.get('file') ?? '', userId, url.searchParams.get('threadId') ?? '')); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      }
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
        const mode = url.searchParams.has("mode") ? argusMode(url.searchParams.get("mode")) : null;
        const rows: unknown[] = [];
        for (let from = 0; ; from += 1000) {
          let query = c.cloud.from("argus_threads").select("id,title,updated_at,mode").eq("user_id", userId);
          if (mode) query = query.eq("mode", mode);
          const { data, error } = await query.order("updated_at", { ascending: false }).order("id").range(from, from + 999);
          if (error) throw error;
          rows.push(...(data ?? []));
          if ((data?.length ?? 0) < 1000) break;
        }
        return json(rows);
      }
      case "create_thread": {
        if (req.method !== "POST") return json({ error: "Metodă invalidă." }, 405);
        const mode = argusMode((await req.json()).mode);
        const { data, error } = await c.cloud.from("argus_threads").insert({ user_id: userId, mode }).select("id,title,updated_at,mode").single();
        if (error) throw error;
        return json(data);
      }
      case "delete_thread": {
        const id = url.searchParams.get("id") ?? "";
        await deleteThreadAttachments(c, userId, id);
        const { error } = await c.cloud.from("argus_threads").delete().eq("id", id).eq("user_id", userId);
        if (error) throw error;
        return json({ ok: true });
      }
      case "messages": {
        const id = url.searchParams.get("id") ?? "";
        const { data: th } = await c.cloud.from("argus_threads").select("id,title,mode").eq("id", id).eq("user_id", userId).maybeSingle();
        if (!th) return json({ error: "Conversația nu există" }, 404);
        const data = await readChatHistory<{ id: string; message: UIMessage }>((from, to) =>
          c.cloud.from("argus_messages").select("id,message").eq("thread_id", id)
            .order("created_at").order("id").range(from, to));
        return json({ thread: th, messages: data.map(r => markFailedTurn(repairChatMessageIds([r.message], r.id)[0] as any, 'Răspunsul anterior a rămas gol.')) });
      }
      case "action": {
        const b = await req.json();
        const r = await handleActionDecision(c, auth.user, String(b.id ?? ""), String(b.decision ?? "status"));
        return json(r.body, r.status);
      }
      case "chat":
        return await handleChat(req, c, userId, auth.user.email);
      default:
        return json({ error: "Acțiune necunoscută" }, 400);
    }
  } catch (e) {
    console.error("argus", e);
    return json({ error: (e as Error).message ?? "Eroare" }, 500);
  }
});
