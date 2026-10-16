// Primește datele oglindite din Senior ERP (scriptul senior-erp-mirror) și le scrie
// în schema privată erp_mirror din Cloud. Autentificare: header X-Bridge-Token.
import { createClient } from "npm:@supabase/supabase-js@2";

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
    if (body.action !== "status" && body.action !== "retry") return json({ error: "unauthorized" }, 401);
    const token = req.headers.get("x-app-token") || "";
    const LEGACY_URL = "https://mfcdlifjxxdrekzdatfb.supabase.co";
    const LEGACY_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk";
    const r = await fetch(`${LEGACY_URL}/auth/v1/user`, { headers: { apikey: LEGACY_ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return json({ error: "Sesiune invalidă. Reautentifică-te." }, 401);
    const user = await r.json();
    const rr = await fetch(`${LEGACY_URL}/rest/v1/app_user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`, { headers: { apikey: LEGACY_ANON, Authorization: `Bearer ${token}` } });
    const roles = rr.ok ? ((await rr.json()) as Array<{ role: string }>) : [];
    if (!roles.some((x) => x.role === "admin")) return json({ error: "Disponibil doar administratorilor." }, 403);
    if (body.action === "retry") {
      const tables = Array.isArray(body.tables)
        ? body.tables.filter((t: unknown) => typeof t === "string" && /^[a-z0-9_]{1,63}$/.test(t)).slice(0, 2000)
        : null;
      const { data, error } = await sb.rpc("erp_mirror_request_retry", { p_tables: tables });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, marked: data });
    }
    const { data, error } = await sb.rpc("erp_mirror_status");
    if (error) return json({ error: error.message }, 500);
    return json(data);
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
