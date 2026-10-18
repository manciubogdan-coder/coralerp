// Acțiuni propuse de Argus: AI-ul doar PROPUNE (salvat în argus_actions, status pending);
// scrierea în aplicație se face numai când utilizatorul apasă „Confirmă", cu sesiunea lui (RLS).
import { jsonSchema, tool } from "npm:ai@7.0.123";
import type { Clients } from "./data.ts";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["comanda_productie", "comanda_client", "comanda_furnizor", "task"] as const;
type Kind = typeof KINDS[number];

const s = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : NaN; };

async function findOne(c: Clients, table: string, col: string, name: string, select: string) {
  const { data: exact } = await c.legacyUser.from(table).select(select).ilike(col, name).limit(2);
  if (exact?.length === 1) return { row: exact[0] };
  const { data } = await c.legacyUser.from(table).select(select).ilike(col, `%${name}%`).limit(6);
  if (!data?.length) return { err: `Nu găsesc „${name}" în ${table}.` };
  if (data.length > 1) return { err: `„${name}" e ambiguu: ${data.map((d: any) => d[col]).join(", ")}. Precizează.` };
  return { row: data[0] };
}

/** Validează și rezolvă numele în ID-uri. Întoarce payload-ul gata de scris sau o eroare. */
export async function resolveAction(c: Clients, kind: Kind, d: any): Promise<{ payload?: any; summary?: string; err?: string }> {
  if (kind === "comanda_productie" || kind === "comanda_client") {
    const items = Array.isArray(d.produse) ? d.produse.slice(0, 50) : [];
    if (!items.length) return { err: "Lipsesc produsele." };
    const zi = s(d.data_productie, 10);
    if (zi && !DAY_RE.test(zi)) return { err: "data_productie trebuie YYYY-MM-DD." };
    let magazin = "PRODUCTIE_AVANS", punct = "PRODUCTIE_AVANS";
    if (kind === "comanda_client") {
      const cl = s(d.client);
      if (!cl) return { err: "Lipsește clientul." };
      const r = await findOne(c, "productie_clienti", "punct_livrare", s(d.punct_livrare) || cl, "nume_magazin,punct_livrare");
      if (r.err) {
        const r2 = await findOne(c, "productie_clienti", "nume_magazin", cl, "nume_magazin,punct_livrare");
        if (r2.err) return { err: r.err };
        magazin = (r2.row as any).nume_magazin; punct = (r2.row as any).punct_livrare;
      } else { magazin = (r.row as any).nume_magazin; punct = (r.row as any).punct_livrare; }
    }
    const rows: any[] = [];
    for (const it of items) {
      const q = Math.round(n(it.cantitate));
      if (!(q > 0) || q > 1_000_000) return { err: `Cantitate invalidă pentru ${s(it.produs)}.` };
      const p = await findOne(c, "productie_produse", "nume", s(it.produs), "id,nume");
      if (p.err) return { err: p.err };
      let linie: any = null;
      if (s(it.linie)) {
        const l = await findOne(c, "productie_linii", "nume", s(it.linie), "id,nume");
        if (l.err) return { err: l.err };
        linie = l.row;
      }
      rows.push({ produs_id: (p.row as any).id, produs: (p.row as any).nume, cantitate: q, linie_id: linie?.id ?? null, linie: linie?.nume ?? null });
    }
    const payload = { magazin, punct_livrare: punct, data_productie: zi || null, numar_comanda: s(d.numar_comanda, 60), linii: rows };
    const what = kind === "comanda_productie" ? "Producție în avans" : `Comandă client ${punct}`;
    return { payload, summary: `${what}${zi ? ` pe ${zi}` : ""}: ${rows.map((r) => `${r.cantitate} buc ${r.produs}${r.linie ? ` (${r.linie})` : ""}`).join(", ")}` };
  }
  if (kind === "comanda_furnizor") {
    const partener = s(d.furnizor);
    if (!partener) return { err: "Lipsește furnizorul." };
    const tip = ["materii-prime", "ambalaje", "etichete"].includes(d.depozit) ? d.depozit : "materii-prime";
    const zi = s(d.data, 10) || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
    if (!DAY_RE.test(zi)) return { err: "data trebuie YYYY-MM-DD." };
    const items = (Array.isArray(d.produse) ? d.produse.slice(0, 50) : []).map((it: any) => {
      const cantitate = n(it.cantitate), pret = n(it.pret) || 0;
      return { denumire_articol: s(it.produs), descriere_articol: s(it.descriere) || "", cantitate, pret_final: pret, palet: 0, valoare_neta: +(cantitate * pret).toFixed(2), unit: s(it.unitate, 20) || null };
    });
    if (!items.length || items.some((i: any) => !i.denumire_articol || !(i.cantitate > 0))) return { err: "Fiecare produs are nevoie de nume și cantitate > 0." };
    const payload = { inventory_type: tip, partener, data: zi, notes: s(d.observatii, 500) || null, items };
    return { payload, summary: `Comandă furnizor ${partener} (${tip}) pe ${zi}: ${items.map((i: any) => `${i.cantitate} ${i.unit ?? ""} ${i.denumire_articol}`).join(", ")}` };
  }
  // task
  const title = s(d.titlu, 200);
  if (!title) return { err: "Lipsește titlul taskului." };
  const priority = ["low", "medium", "high", "urgent"].includes(d.prioritate) ? d.prioritate : "medium";
  const termen = s(d.termen, 10);
  if (termen && !DAY_RE.test(termen)) return { err: "termen trebuie YYYY-MM-DD." };
  let assigned: any = null;
  if (s(d.responsabil)) {
    const who = s(d.responsabil);
    const r = await findOne(c, "app_profiles", who.includes("@") ? "email" : "name", who, "user_id,name,email");
    if (r.err) return { err: r.err };
    assigned = r.row;
  }
  const payload = { title, description: s(d.descriere, 2000) || null, priority, deadline: termen ? `${termen}T15:00:00+03:00` : null, department: s(d.departament, 40) || null, assigned_to: assigned?.user_id ?? null, assigned_name: assigned?.name ?? assigned?.email ?? null };
  return { payload, summary: `Task „${title}"${assigned ? ` pentru ${payload.assigned_name}` : ""}${termen ? `, termen ${termen}` : ""}, prioritate ${priority}` };
}

/** Scrie efectiv acțiunea, cu sesiunea utilizatorului. */
export async function executeAction(c: Clients, kind: Kind, p: any, user: { id: string; email: string }) {
  const db = c.legacyUser;
  if (kind === "comanda_productie" || kind === "comanda_client") {
    const avans = kind === "comanda_productie";
    const { data, error } = await db.from("productie_comenzi").insert(p.linii.map((l: any) => ({
      magazin: p.magazin, punct_livrare: p.punct_livrare, produs_id: l.produs_id, cantitate: l.cantitate,
      linie_id: l.linie_id, status: l.linie_id ? "assigned" : "pending", cantitate_din_restock: 0,
      tip_comanda: avans ? "PRODUCTIE_AVANS" : null, data_productie: p.data_productie, numar_comanda: p.numar_comanda || "",
    }))).select("id");
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((r: any) => r.id);
    await c.cloud.from("productie_comenzi_audit").insert({ table_name: "productie_comenzi", action: "insert", record_ids: ids, comanda_ids: ids, changes: p, user_email: user.email, page_path: "/administrativ/argus", source: "argus" });
    return { ids, link: avans ? "/productie" : "/productie" };
  }
  if (kind === "comanda_furnizor") {
    const total = p.items.reduce((a: number, i: any) => a + i.valoare_neta, 0);
    const { data: o, error } = await db.from("purchase_orders_imported").insert({
      inventory_type: p.inventory_type, source: "manual", tip_document: "Comandă Argus", serie: "CF", numar: null,
      data: p.data, partener: p.partener, total_value: total, total_lines: p.items.length, notes: p.notes,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const { error: e2 } = await db.from("purchase_orders_imported_items").insert(p.items.map((i: any) => ({ ...i, order_id: o.id })));
    if (e2) throw new Error(e2.message);
    return { ids: [o.id], link: "/achizitii" };
  }
  const { assigned_name: _x, ...row } = p;
  const { data, error } = await db.from("app_tasks").insert({ ...row, created_by: user.id }).select("id").single();
  if (error) throw new Error(error.message);
  return { ids: [data.id], link: "/taskuri" };
}

export function actionTools(c: Clients, userId: string) {
  return {
    propune_actiune: tool({
      description: "Pregătește o acțiune în aplicație (NU o execută): comandă de producție în avans, comandă de client, comandă către furnizor sau task. Utilizatorul vede un card și apasă „Confirmă". Folosește numele exacte din aplicație (verifică-le înainte cu interogare_date pe productie_produse / productie_linii / productie_clienti / app_profiles dacă nu ești sigur).",
      inputSchema: jsonSchema<any>({
        type: "object", additionalProperties: false, required: ["tip", "date"],
        properties: {
          tip: { type: "string", enum: [...KINDS] },
          date: {
            type: "object",
            description: "comanda_productie: {data_productie, produse:[{produs, cantitate(buc), linie?}]}. comanda_client: {client, punct_livrare?, data_productie, numar_comanda?, produse:[...]}. comanda_furnizor: {furnizor, depozit(materii-prime|ambalaje|etichete), data, observatii?, produse:[{produs, cantitate, unitate?, pret?}]}. task: {titlu, descriere?, responsabil?(nume sau email), termen?(YYYY-MM-DD), prioritate(low|medium|high|urgent), departament?}",
          },
        },
      }),
      execute: async ({ tip, date }: any) => {
        if (!KINDS.includes(tip)) return { eroare: "Tip necunoscut" };
        try {
          const r = await resolveAction(c, tip, date ?? {});
          if (r.err) return { eroare: r.err };
          const { data, error } = await c.cloud.from("argus_actions").insert({ user_id: userId, kind: tip, summary: r.summary, payload: r.payload }).select("id").single();
          if (error) return { eroare: error.message };
          return { id: data.id, tip, rezumat: r.summary, detalii: r.payload, status: "pending", nota: "Așteaptă confirmarea utilizatorului. NU spune că s-a creat." };
        } catch (e) { return { eroare: (e as Error).message }; }
      },
    }),
  };
}

export async function handleActionDecision(c: Clients, user: { id: string; email: string }, id: string, decision: string) {
  const { data: a } = await c.cloud.from("argus_actions").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!a) return { status: 404, body: { error: "Acțiunea nu există" } };
  if (decision === "status") return { status: 200, body: { status: a.status, result: a.result, error: a.error } };
  if (a.status !== "pending") return { status: 200, body: { status: a.status, result: a.result, error: a.error } };
  if (decision === "cancel") {
    await c.cloud.from("argus_actions").update({ status: "cancelled", decided_at: new Date().toISOString() }).eq("id", id);
    return { status: 200, body: { status: "cancelled" } };
  }
  // claim atomically so a double click can't create the order twice
  const { data: claimed } = await c.cloud.from("argus_actions").update({ status: "done", decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id");
  if (!claimed?.length) return { status: 200, body: { status: "done" } };
  try {
    const result = await executeAction(c, a.kind, a.payload, user);
    await c.cloud.from("argus_actions").update({ result }).eq("id", id);
    return { status: 200, body: { status: "done", result } };
  } catch (e) {
    const msg = (e as Error).message;
    await c.cloud.from("argus_actions").update({ status: "error", error: msg }).eq("id", id);
    return { status: 200, body: { status: "error", error: msg } };
  }
}
