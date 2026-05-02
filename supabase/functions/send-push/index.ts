// Edge function: send-push
// Trimite Web Push notifications către toate device-urile unui user.
// Apelat automat de trigger-ul SQL `notifications_fire_push` la fiecare INSERT în public.notifications.
// Public endpoint (verify_jwt = false) pentru a putea fi apelat din pg_net fără auth context.
// Nu expune date sensibile: primește user_id + title + body + link și citește subscriptions cu service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

// IMPORTANT: aplicația folosește o BD legacy (mfcdlifjxxdrekzdatfb), nu Cloud-ul curent.
// Folosim aceleași credențiale ca în client.ts.
const LEGACY_URL = "https://mfcdlifjxxdrekzdatfb.supabase.co";
const LEGACY_SERVICE_ROLE = Deno.env.get("LEGACY_SUPABASE_SERVICE_ROLE_KEY") || SERVICE_ROLE;

const supabase = createClient(LEGACY_URL, LEGACY_SERVICE_ROLE);

interface PushPayload {
  user_id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  notification_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json()) as PushPayload;
    if (!payload?.user_id || !payload?.title) {
      return new Response(JSON.stringify({ error: "missing user_id or title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh_key, auth_key")
      .eq("user_id", payload.user_id);

    if (error) {
      console.error("[send-push] db error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subs || subs.length === 0) {
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
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh_key, auth: s.auth_key },
            },
            notif,
            { TTL: 60 * 60 * 24 } // 1 zi
          );
          delivered += 1;
        } catch (e: any) {
          // 404 / 410 = expired/unsubscribed -> șterge
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            expired.push(s.endpoint);
          } else {
            console.warn("[send-push] failed", s.endpoint, e?.statusCode, e?.body);
          }
        }
      })
    );

    if (expired.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expired);
    }

    return new Response(JSON.stringify({ delivered, expired: expired.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-push] exception:", e?.message);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
