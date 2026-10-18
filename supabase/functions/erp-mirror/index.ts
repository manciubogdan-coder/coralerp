// Primește datele oglindite din Senior ERP (scriptul senior-erp-mirror) și le scrie
// în schema privată erp_mirror din Cloud. Autentificare: header X-Bridge-Token.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { streamText } from "npm:ai@7.0.123";
import { createLovableAiGatewayRunIdFetch } from "../_shared/run-id.ts";

// Asistentul de rapoarte: transformă o cerere în limbaj natural într-o configurație de raport
// (tabel, grupări, măsuri, filtre, grafic) executată apoi prin agregarea sigură erp_mirror_aggregate.
async function assist(prompt: string, catalog: any[]) {
  if (!prompt) return { error: "Scrie ce raport vrei." };
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY lipsește");
  const run = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: run.fetch,
  });
  const cat = (catalog ?? []).slice(0, 600).map((t) =>
    `${t.table} (${t.source}, ${t.rows} rânduri): ${(t.columns ?? []).slice(0, 60).map((c: any) => `${c.name}:${c.type}`).join(", ")}`
  ).join("\n");
  const system = `Ești asistentul de rapoarte pentru CEO-ul Coral Biogreens. Datele vin din Senior ERP (copie read-only).
Răspunde DOAR cu un obiect JSON valid, fără text în plus, cu forma:
{"title": string, "explanation": string (în română, 1-2 propoziții), "config": {"table": string, "groups": [{"col": string, "bucket": "month"|"year"|"day"|null}], "measures": [{"col": string|null, "fn": "sum"|"count"|"avg"|"min"|"max"|"count_distinct"}], "filters": [{"col": string, "op": "eq"|"neq"|"contains"|"starts"|"gte"|"lte"|"notnull", "value": string}], "chart": "table"|"bar"|"line"|"pie", "limit": number, "order": "value"|"group"}}
Folosește doar tabele și coloane din catalog. Pentru evoluții în timp folosește bucket month și order group. Contabilitate: accountingstatistics (periodid YYYYMM, tipsubiectid=1 pentru total pe cont, analiticid → c_plan_contabil.analitic_id). Dacă datele cerute nu sunt încă în catalog, pune "config": null și explică în explanation că tabelele respective încă se copiază.
Catalog:
${cat}`;
  const result = streamText({ model: provider("google/gemini-3.8-flash"), system, prompt });
  const text = await result.text;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { error: "Asistentul nu a putut construi raportul. Reformulează cererea." };
  try { return JSON.parse(m[0]); } catch { return { error: "Asistentul a dat un răspuns invalid. Încearcă din nou." }; }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-bridge-token, x-app-token, apikey, authorization",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const expected = Deno.env.get("SENIOR_ERP_BRIDGE_TOKEN") || "";
  const isBridge = expected && req.headers.get("x-bridge-token") === expected;

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  // Acțiunea "status" e pentru interfață: cere sesiune de admin din aplicația operațională.
  if (!isBridge) {
    const UI_ACTIONS = ["status", "retry", "catalog", "aggregate", "browse", "commercial_summary", "pnl", "reports_list", "reports_save", "reports_delete", "assist"];
    if (!UI_ACTIONS.includes(body.action)) return json({ error: "unauthorized" }, 401);
    const token = req.headers.get("x-app-token") || "";
    const LEGACY_URL = "https://mfcdlifjxxdrekzdatfb.supabase.co";
    const LEGACY_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk";
    const r = await fetch(`${LEGACY_URL}/auth/v1/user`, { headers: { apikey: LEGACY_ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return json({ error: "Sesiune invalidă. Reautentifică-te." }, 401);
    const user = await r.json();
    const rr = await fetch(`${LEGACY_URL}/rest/v1/app_user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`, { headers: { apikey: LEGACY_ANON, Authorization: `Bearer ${token}` } });
    const roles = rr.ok ? ((await rr.json()) as Array<{ role: string }>) : [];
    if (!roles.some((x) => x.role === "admin")) return json({ error: "Disponibil doar administratorilor." }, 403);
    const rpc = async (fn: string, args?: Record<string, unknown>) => {
      const { data, error } = await sb.rpc(fn, args ?? {});
      if (error) throw new Error(error.message);
      return data;
    };
    try {
      switch (body.action) {
        case "retry": {
          const tables = Array.isArray(body.tables)
            ? body.tables.filter((t: unknown) => typeof t === "string" && /^[a-z0-9_]{1,63}$/.test(t)).slice(0, 2000)
            : null;
          return json({ ok: true, marked: await rpc("erp_mirror_request_retry", { p_tables: tables }) });
        }
        case "catalog":
          return json({ tables: await rpc("erp_mirror_catalog") });
        case "aggregate":
          return json({ rows: await rpc("erp_mirror_aggregate", { p: body.config ?? {} }) });
        case "commercial_summary": {
          if (typeof body.start !== "string" || typeof body.end !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.start) || !/^\d{4}-\d{2}-\d{2}$/.test(body.end)) return json({ error: "Perioadă invalidă." }, 400);
          return json(await rpc("erp_mirror_commercial_summary", { p_start: body.start, p_end: body.end }));
        }
        case "browse": {
          const c = body.config;
          if (!c || typeof c.table !== "string" || !/^[a-z0-9_]{1,63}$/.test(c.table) || !Number.isInteger(c.offset) || c.offset < 0 || c.offset > 10000000) return json({ error: "Sursă sau pagină invalidă." }, 400);
          for (const k of ["date_col", "search_col", "search", "start", "end"]) if (c[k] != null && (typeof c[k] !== "string" || c[k].length > 200)) return json({ error: "Filtru invalid." }, 400);
          return json(await rpc("erp_mirror_browse", { p: c }));
        }
        case "pnl": {
          const y = Number(body.year) || new Date().getFullYear();
          return json(await rpc("erp_mirror_pnl", { p_year: y }));
        }
        case "reports_list": {
          return json({ reports: await rpc("erp_mirror_reports", { p_action: "list" }) });
        }
        case "reports_save": {
          const title = String(body.title || "").slice(0, 200).trim();
          if (!title || typeof body.config !== "object") return json({ error: "Titlu și configurație obligatorii." }, 400);
          return json({ report: await rpc("erp_mirror_reports", { p_action: "save", p_data: { title, config: body.config, created_by: user.email } }) });
        }
        case "reports_delete": {
          if (!/^[0-9a-f-]{36}$/.test(String(body.id))) return json({ error: "id invalid" }, 400);
          return json(await rpc("erp_mirror_reports", { p_action: "delete", p_data: { id: body.id } }));
        }
        case "assist":
          return json(await assist(String(body.prompt || "").slice(0, 2000), await rpc("erp_mirror_catalog")));
        default:
          return json(await rpc("erp_mirror_status"));
      }
    } catch (e) {
      const msg = (e as Error).message || "";
      // Database briefly unavailable (restart / overload): tell the client it can retry.
      if (/schema cache|connection|timeout|terminat|starting up|fetch failed/i.test(msg)) {
        return json({ error: "Baza de date tocmai repornește sau e ocupată. Mai încearcă într-un minut." }, 503);
      }
      return json({ error: msg }, 500);
    }
  }

  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };

  try {
    switch (body.action) {
      case "ensure_table":
        await call("erp_mirror_ensure_table", { p_table: body.table, p_source: body.source, p_columns: body.columns, p_pk: body.pk ?? [] });
        return json({ ok: true });
      case "upsert": {
        const n = await call("erp_mirror_upsert", { p_table: body.table, p_run: body.run, p_rows: body.rows ?? [] });
        return json({ ok: true, upserted: n });
      }
      case "finish_table": {
        const d = await call("erp_mirror_finish_table", { p_table: body.table, p_run: body.run, p_rows: body.rows ?? 0 });
        return json({ ok: true, deleted: d });
      }
      case "log":
        await call("erp_mirror_log", { p_run: body.run, p_data: body.data ?? {} });
        return json({ ok: true });
      case "pending_retries":
        return json({ ok: true, tables: (await call("erp_mirror_pending_retries", {})) ?? [] });
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
