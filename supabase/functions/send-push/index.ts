// Edge function: send-push
// Trimite Web Push notifications. Apelat de trigger-ul SQL din DB-ul legacy.
// Primește direct lista de subscriptions în body — NU citește din DB.
// Public endpoint (verify_jwt = false).

import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface SubInput {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

interface PushPayload {
  title: string;
  body?: string | null;
  link?: string | null;
  notification_id?: string;
  subscriptions: SubInput[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json()) as PushPayload;

    if (!payload?.title || !Array.isArray(payload?.subscriptions)) {
      return new Response(
        JSON.stringify({ error: "missing title or subscriptions[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.subscriptions.length === 0) {
      return new Response(JSON.stringify({ delivered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notif = JSON.stringify({
      title: payload.title,
      body: payload.body ?? "",
      link: payload.link ?? "/",
      id: payload.notification_id,
    });

    let delivered = 0;
    const expired: string[] = [];

    await Promise.all(
      payload.subscriptions.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
            notif,
            { TTL: 60 * 60 * 24 }
          );
          delivered += 1;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            expired.push(s.endpoint);
          } else {
            console.warn("[send-push] failed", s.endpoint, e?.statusCode, e?.body);
          }
        }
      })
    );

    return new Response(
      JSON.stringify({ delivered, expired }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[send-push] exception:", e?.message);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
