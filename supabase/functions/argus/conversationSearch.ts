// Company-wide Argus conversation search. Argus is restricted to validated operational admins,
// so admins may recall what Argus discussed with any colleague.
import { messageText } from "./contextRules.ts";

export const normalize = (s: string) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** user_id -> display name (from app activity), falls back to email. */
export async function threadOwners(c: { cloud: any }, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return out;
  const { data } = await c.cloud.from("app_activity_pings").select("user_id,display_name,email,occurred_at")
    .in("user_id", uniq).order("occurred_at", { ascending: false }).limit(2000);
  for (const r of data ?? []) if (!out.has(r.user_id)) out.set(r.user_id, r.display_name || r.email || r.user_id);
  return out;
}

/** Matches every word of the query (accent-insensitive). Empty query matches everything. */
export function matchesAll(text: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return true;
  const t = normalize(text);
  return words.every(w => t.includes(w));
}

export async function searchConversations(c: { cloud: any }, cuvinte: string, utilizator: string) {
  const threads: { id: string; title: string; user_id: string; updated_at: string }[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await c.cloud.from("argus_threads").select("id,title,user_id,updated_at")
      .order("updated_at", { ascending: false }).order("id").range(from, from + 499);
    if (error) throw new Error(`Conversațiile nu au putut fi citite: ${error.message}`);
    threads.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const owners = await threadOwners(c, threads.map(t => t.user_id));
  const who = normalize(utilizator);
  const pool = threads.filter(t => !who || normalize(owners.get(t.user_id) ?? "").includes(who));
  const results: any[] = [];
  // Scan the most recent conversations' content; titles alone are often "Conversație nouă".
  for (const t of pool.slice(0, 80)) {
    if (results.length >= 15) break;
    const head = { id: t.id, titlu: t.title, utilizator: owners.get(t.user_id) ?? t.user_id, actualizat: t.updated_at };
    if (!cuvinte.trim()) { results.push(head); continue; }
    if (matchesAll(t.title, cuvinte)) { results.push({ ...head, potrivire: "titlu" }); continue; }
    const { data, error } = await c.cloud.from("argus_messages").select("message").eq("thread_id", t.id).order("created_at").order("id").limit(400);
    if (error) throw new Error(`Mesajele nu au putut fi citite: ${error.message}`);
    const msgs = (data ?? []).map((r: any, i: number) => ({ i: i + 1, text: messageText(r.message) }));
    const all = msgs.map(m => m.text).join("\n");
    if (!matchesAll(all, cuvinte)) continue;
    const words = normalize(cuvinte).split(/\s+/).filter(w => w.length > 1);
    const hits = msgs.filter(m => words.some(w => normalize(m.text).includes(w))).slice(0, 3)
      .map(m => ({ pozitie: m.i, fragment: m.text.slice(0, 300) }));
    results.push({ ...head, mesaje: msgs.length, potriviri: hits });
  }
  return results;
}
