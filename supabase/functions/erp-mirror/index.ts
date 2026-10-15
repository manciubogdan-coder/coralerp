// Primește datele oglindite din Senior ERP (scriptul senior-erp-mirror) și le scrie
// în schema privată erp_mirror din Cloud. Autentificare: header X-Bridge-Token.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-bridge-token",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const expected = Deno.env.get("SENIOR_ERP_BRIDGE_TOKEN") || "";
  if (!expected || req.headers.get("x-bridge-token") !== expected) return json({ error: "unauthorized" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

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
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
