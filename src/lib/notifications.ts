import { supabase } from "@/integrations/supabase/client";

/**
 * Emite un eveniment care va genera notificări către userii configurați
 * în tabela notif_rules pentru acest event_key.
 *
 * Exemplu:
 *   await emitNotification("reception.completed", "Recepție finalizată", {
 *     body: "Furnizor: ACME, NIR #1234",
 *     link: "/depozit-mp/receptie",
 *     payload: { supplier: "ACME", nir: 1234 }
 *   });
 */
export async function emitNotification(
  eventKey: string,
  defaultTitle: string,
  opts: { body?: string; link?: string; payload?: Record<string, unknown> } = {}
) {
  try {
    const { data, error } = await (supabase as any).rpc("emit_notification_event", {
      p_event_key: eventKey,
      p_title_default: defaultTitle,
      p_body: opts.body ?? null,
      p_link: opts.link ?? null,
      p_payload: opts.payload ?? {},
    });
    if (error) {
      console.warn(`[notifications] emit "${eventKey}" failed:`, error.message);
      return null;
    }
    return typeof data === "number" ? data : null;
  } catch (e: any) {
    console.warn(`[notifications] emit "${eventKey}" exception:`, e?.message);
    return null;
  }
}
