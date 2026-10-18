// Primește datele oglindite din Senior ERP (scriptul senior-erp-mirror) și le scrie
// în schema privată erp_mirror din Cloud. Autentificare: header X-Bridge-Token.
import { createClient } from "npm:@supabase/supabase-js@2";
import { seniorLive, seniorPnl } from "../_shared/senior.ts";
import { fillTemplate, validTemplate } from "../_shared/templates.ts";
import { assistStream } from "./assist.ts";

class LiveError extends Error {}

// Validates a report configuration before it is sent to the Senior server (identifiers + bounded values).
const ID = /^[a-z0-9_]{1,63}$/;
const FNS = ["sum", "count", "avg", "min", "max", "count_distinct"];
const OPS = ["eq", "neq", "contains", "starts", "gte", "lte", "notnull"];
function validConfig(c: any) {
  if (!c || typeof c !== "object" || typeof c.table !== "string" || !ID.test(c.table)) return null;
  const groups = Array.isArray(c.groups) ? c.groups : [];
  const measures = Array.isArray(c.measures) ? c.measures : [];
  const filters = Array.isArray(c.filters) ? c.filters : [];
  if (groups.length > 4 || measures.length > 6 || filters.length > 10) return null;
  for (const g of groups) if (!g || !ID.test(String(g.col)) || (g.bucket != null && !["month", "year", "day"].includes(g.bucket))) return null;
  for (const m of measures) if (!m || !FNS.includes(m.fn) || (m.col != null && m.col !== "*" && !ID.test(String(m.col)))) return null;
  for (const f of filters) if (!f || !ID.test(String(f.col)) || !OPS.includes(f.op) || (f.value != null && String(f.value).length > 200)) return null;
  return {
    table: c.table,
    groups: groups.map((g: any) => ({ col: g.col, bucket: g.bucket ?? null })),
    measures: measures.map((m: any) => ({ col: m.col === "*" ? null : m.col ?? null, fn: m.fn })),
    filters: filters.map((f: any) => ({ col: f.col, op: f.op, value: f.value == null ? "" : String(f.value) })),
    chart: ["table", "bar", "line", "pie"].includes(c.chart) ? c.chart : "table",
    limit: Math.min(Math.max(Number(c.limit) || 200, 1), 2000),
    order: c.order === "group" ? "group" : "value",
  };
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
    const UI_ACTIONS = ["status", "retry", "catalog", "aggregate", "browse", "commercial_summary", "pnl", "reports_list", "reports_save", "reports_refresh", "reports_delete", "assist", "template_run"];
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
    // Live read: queue the request for the program on the Senior server and wait for its answer.
    const live = async (kind: string, payload: unknown) => {
      const id = await rpc("erp_live_enqueue", { p_kind: kind, p_payload: payload });
      const until = Date.now() + 30000;
      while (Date.now() < until) {
        await new Promise((res) => setTimeout(res, 700));
        const s = await rpc("erp_live_get", { p_id: id });
        if (s?.status === "done") return s.result;
        if (s?.status === "error") throw new LiveError(s.error || "Eroare la citirea din Senior.");
      }
      throw new LiveError("Serverul Senior nu a răspuns în 30 de secunde. Verifică dacă programul de citire rulează pe server.");
    };
    // Catalog of Senior tables: cached in Cloud, refreshed live at most every 6 hours (or on demand).
    const liveCatalog = async (refresh: boolean) => {
      const cached = await rpc("erp_live_state", { p_key: "catalog" });
      const fresh = cached?.updated_at && Date.now() - new Date(cached.updated_at).getTime() < 6 * 3600_000;
      if (cached?.value && fresh && !refresh) return { tables: cached.value, updated_at: cached.updated_at };
      try {
        return { tables: await live("catalog", {}), updated_at: new Date().toISOString() };
      } catch (e) {
        if (cached?.value) return { tables: cached.value, updated_at: cached.updated_at, stale: true };
        throw e;
      }
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
          return json(await liveCatalog(body.refresh === true));
        case "aggregate": {
          const cfg = validConfig(body.config);
          if (!cfg) return json({ error: "Configurație de raport invalidă." }, 400);
          return json({ rows: await live("aggregate", cfg), live: true });
        }
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
          // Up-to-date figures come from the accounting journal; the trial balance in Senior lags behind.
          try { return json(await seniorPnl(sb, y)); }
          catch (e) { return json({ ...(await rpc("erp_mirror_pnl", { p_year: y })), live: false, live_error: (e as Error).message }); }
        }
        case "reports_list":
          return json({ reports: await rpc("erp_mirror_reports", { p_action: "list" }) });
        case "reports_save": {
          const title = String(body.title || "").slice(0, 200).trim();
          const cfg = body.config?.kind === "sql" ? validTemplate(body.config) : validConfig(body.config);
          if (!title || !cfg) return json({ error: "Titlu și configurație obligatorii." }, 400);
          const data: Record<string, unknown> = { title, config: cfg, created_by: user.email };
          if (Array.isArray(body.result) && body.result.length <= 5000) data.result = body.result;
          return json({ report: await rpc("erp_mirror_reports", { p_action: "save", p_data: data }) });
        }
        case "reports_refresh": {
          if (!/^[0-9a-f-]{36}$/.test(String(body.id))) return json({ error: "id invalid" }, 400);
          let rows: unknown;
          if (body.config?.kind === "sql") {
            const tpl = validTemplate(body.config);
            if (!tpl) return json({ error: "Șablon de raport invalid." }, 400);
            try { rows = await seniorLive(sb, "sql", { sql: fillTemplate(tpl, body.values ?? {}) }, 45000); }
            catch (e) { throw new LiveError((e as Error).message); }
          } else {
            const cfg = validConfig(body.config);
            if (!cfg) return json({ error: "Configurație de raport invalidă." }, 400);
            rows = await live("aggregate", cfg);
          }
          return json({ report: await rpc("erp_mirror_reports", { p_action: "set_result", p_data: { id: body.id, result: rows } }) });
        }
        case "template_run": {
          const tpl = validTemplate(body.config);
          if (!tpl) return json({ error: "Șablon de raport invalid." }, 400);
          try { return json({ rows: await seniorLive(sb, "sql", { sql: fillTemplate(tpl, body.values ?? {}) }, 45000) }); }
          catch (e) { throw new LiveError((e as Error).message); }
        }
        case "assist":
          return new Response(assistStream(String(body.prompt || "").slice(0, 2000), sb, req.signal, req.headers.get("x-app-token") || ""), {
            headers: { ...cors, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
          });
        default:
          return json(await rpc("erp_mirror_status_live"));
      }
    } catch (e) {
      const msg = (e as Error).message || "";
      if (e instanceof LiveError) return json({ error: msg }, 504);
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
      case "live_pull":
        return json({ ok: true, requests: (await call("erp_live_pull", { p_limit: 3 })) ?? [] });
      case "live_result": {
        if (!/^[0-9a-f-]{36}$/.test(String(body.id))) return json({ error: "id invalid" }, 400);
        await call("erp_live_complete", { p_id: body.id, p_result: body.error ? null : (body.result ?? null), p_error: body.error ? String(body.error).slice(0, 2000) : null });
        return json({ ok: true });
      }
      case "pending_retries":
        return json({ ok: true, tables: (await call("erp_mirror_pending_retries", {})) ?? [] });
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
