// Shared long-term memory for Argus: durable business facts visible to every user and chat.
import { jsonSchema, tool } from "npm:ai@7.0.123";
import { messageText } from "./contextRules.ts";

type C = { cloud: any; legacy: any };
const MAX_FACTS = 400;

export async function loadMemory(c: C): Promise<string> {
  const { data, error } = await c.cloud.from("argus_memory").select("fact,category,created_at").order("created_at", { ascending: false }).limit(MAX_FACTS);
  if (error || !data?.length) return "(încă goală)";
  return data.reverse().map((r: any) => `- [${r.category}] ${r.fact}`).join("\n");
}

export function memoryTools(c: C, userId: string, threadId: string) {
  return {
    memoreaza: tool({
      description: "Salvează permanent o regulă/fapt de business confirmat (ex. baxare, formulă de cost, preferință, corecție validată de utilizator), vizibil în toate chat-urile și pentru toți utilizatorii. NU salva cifre live care se schimbă zilnic și nici afirmații neverificate.",
      inputSchema: jsonSchema<{ fapt: string; categorie: string }>({ type: "object", additionalProperties: false, required: ["fapt", "categorie"], properties: { fapt: { type: "string", minLength: 5, maxLength: 600 }, categorie: { type: "string", enum: ["cost", "baxare", "productie", "comercial", "depozit", "preferinta", "general"] } } }),
      execute: async ({ fapt, categorie }) => {
        const { error } = await c.cloud.from("argus_memory").insert({ fact: fapt.trim().slice(0, 600), category: categorie, source_thread: threadId, created_by: userId });
        return error ? { eroare: error.message } : { salvat: true };
      },
    }),
    dosar_produs: tool({
      description: "Dosar complet 360° al unui produs finit dintr-o singură citire: rețeta activă cu ingrediente și cantități, baxarea pe magazin (bucăți/bax), metode de ambalare pe client (ambalaj primar/terțiar) și compoziția baxului mixt. Folosește-l ÎNAINTE de orice calcul de cost, consum sau baxare.",
      inputSchema: jsonSchema<{ nume: string }>({ type: "object", additionalProperties: false, required: ["nume"], properties: { nume: { type: "string", minLength: 2, maxLength: 100 } } }),
      execute: async ({ nume }) => {
        const q = nume.replace(/[%_,()]/g, " ").trim();
        const { data: produse, error } = await c.legacy.from("productie_produse").select("*").ilike("nume", `%${q}%`).limit(8);
        if (error) return { eroare: error.message };
        if (!produse?.length) return { eroare: "Niciun produs găsit; încearcă alt cuvânt din denumire." };
        const ids = produse.map((p: any) => p.id);
        const [ret, bax, mix, amb] = await Promise.all([
          c.legacy.from("productie_retete").select("id,produs_id,activa,versiune,nume_reteta,productie_retete_ingrediente(ingredient_id,cantitate_necesara,unitate_masura)").in("produs_id", ids),
          c.cloud.from("productie_baxare_magazine").select("produs_id,magazin,senior_units,manual_units").in("produs_id", ids),
          c.cloud.from("productie_baxuri_mixte").select("produs_id,denumire,components,enabled").in("produs_id", ids),
          c.cloud.from("packaging_methods").select("client_name,product_name,weight,primary_packaging,tertiary_packaging,units_per_case").ilike("product_name", `%${q}%`).limit(30),
        ]);
        const ingIds = [...new Set((ret.data ?? []).flatMap((r: any) => (r.productie_retete_ingrediente ?? []).map((i: any) => i.ingredient_id)))];
        const { data: ings } = ingIds.length ? await c.legacy.from("productie_ingrediente").select("*").in("id", ingIds) : { data: [] };
        const ingName = new Map((ings ?? []).map((i: any) => [i.id, i.nume ?? i.name ?? i.id]));
        return {
          produse: produse.map((p: any) => ({
            id: p.id, nume: p.nume, unitate: p.unitate_masura,
            retete: (ret.data ?? []).filter((r: any) => r.produs_id === p.id && r.activa !== false).map((r: any) => ({ nume: r.nume_reteta, versiune: r.versiune, ingrediente: (r.productie_retete_ingrediente ?? []).map((i: any) => ({ ingredient: ingName.get(i.ingredient_id), cantitate: i.cantitate_necesara, unitate: i.unitate_masura })) })),
            baxare_pe_magazin: (bax.data ?? []).filter((b: any) => b.produs_id === p.id).map((b: any) => ({ magazin: b.magazin, bucati_bax: b.manual_units || b.senior_units })),
            bax_mixt: (mix.data ?? []).find((m: any) => m.produs_id === p.id && m.enabled)?.components ?? null,
          })),
          ambalare_pe_client: amb.data ?? [],
          nota: "Rețeta Senior poate fi pe bax: verifică unitatea și împarte ambalajul colectiv la bucățile din bax.",
        };
      },
    }),
  };
}

/** One-time: read every past conversation and extract durable business facts. Guarded by argus_job_state. */
export async function backfillMemory(c: C, summarize: (prompt: string, limit: number) => Promise<string>) {
  const { error: lockErr } = await c.cloud.from("argus_job_state").insert({ job: "memory_backfill", locked_until: new Date(Date.now() + 3600_000).toISOString() });
  if (lockErr) return; // already done or running
  try {
    for (let from = 0; ; from += 100) {
      const { data: threads } = await c.cloud.from("argus_threads").select("id,user_id,title").order("created_at").range(from, from + 99);
      if (!threads?.length) break;
      for (const t of threads) {
        let text = "";
        for (let o = 0; text.length < 40000; o += 500) {
          const { data } = await c.cloud.from("argus_messages").select("message").eq("thread_id", t.id).order("created_at").order("id").range(o, o + 499);
          if (!data?.length) break;
          text += data.map((r: any) => `${r.message.role === "user" ? "UTILIZATOR" : "ARGUS"}: ${messageText(r.message).slice(0, 1500)}`).join("\n");
          if (data.length < 500) break;
        }
        if (text.length < 200) continue;
        try {
          const out = await summarize(`Din conversația de mai jos (titlu: ${t.title}) extrage DOAR fapte și reguli de business durabile despre firma Coral Biogreens, confirmate sau stabilite de UTILIZATOR (ex. baxări, formule de cost, prețuri convenite, preferințe de raportare, corecturi pe care utilizatorul le-a validat, greșeli ale lui Argus de evitat). Ignoră cifrele zilnice, întrebările și afirmațiile lui Argus necorectate. Răspunde strict JSON: [{"fapt":"...","categorie":"cost|baxare|productie|comercial|depozit|preferinta|general"}], maxim 10, sau [] dacă nu există.\n\n${text.slice(0, 40000)}`, 4096);
          const facts = JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1) || "[]");
          const rows = (Array.isArray(facts) ? facts : []).filter((f: any) => typeof f?.fapt === "string" && f.fapt.length >= 5).slice(0, 10)
            .map((f: any) => ({ fact: f.fapt.slice(0, 600), category: String(f.categorie || "general").slice(0, 30), source_thread: t.id, created_by: "istoric" }));
          if (rows.length) await c.cloud.from("argus_memory").insert(rows);
        } catch (e) { console.error("memory backfill thread", t.id, (e as Error).message); }
      }
    }
    await c.cloud.from("argus_job_state").update({ locked_until: null, paused_reason: "done", updated_at: new Date().toISOString() }).eq("job", "memory_backfill");
  } catch (e) {
    console.error("memory backfill", (e as Error).message);
    await c.cloud.from("argus_job_state").delete().eq("job", "memory_backfill");
  }
}
