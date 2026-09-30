import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const LEGACY_URL = "https://mfcdlifjxxdrekzdatfb.supabase.co";
// Public (anon) key of the operational database — same one shipped in the web app.
export const LEGACY_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk";

export type Clients = { legacy: SupabaseClient; cloud: SupabaseClient; legacyUser: SupabaseClient };

export function makeClients(userToken: string): Clients {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    legacy: createClient(LEGACY_URL, LEGACY_ANON, opts),
    legacyUser: createClient(LEGACY_URL, LEGACY_ANON, {
      ...opts,
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    }),
    cloud: createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, opts),
  };
}

/** Verifies the operational-app session and requires the admin role. */
export async function requireAdmin(token: string | null) {
  if (!token) return { error: "Nu ești autentificat.", status: 401 } as const;
  const r = await fetch(`${LEGACY_URL}/auth/v1/user`, {
    headers: { apikey: LEGACY_ANON, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return { error: "Sesiune invalidă. Reautentifică-te.", status: 401 } as const;
  const user = await r.json();
  const rr = await fetch(
    `${LEGACY_URL}/rest/v1/app_user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`,
    { headers: { apikey: LEGACY_ANON, Authorization: `Bearer ${token}` } },
  );
  const roles = rr.ok ? ((await rr.json()) as Array<{ role: string }>) : [];
  if (!roles.some((x) => x.role === "admin")) {
    return { error: "Argus este disponibil doar administratorilor.", status: 403 } as const;
  }
  return { user: { id: user.id as string, email: user.email as string } } as const;
}

// ---------- helpers ----------
function tzOffset(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const s = d.toLocaleString("en-US", { timeZone: "Europe/Bucharest", timeZoneName: "shortOffset" });
  const m = s.match(/GMT([+-]\d+)/);
  const h = m ? parseInt(m[1]) : 3;
  return `${h >= 0 ? "+" : "-"}${String(Math.abs(h)).padStart(2, "0")}:00`;
}
export const startIso = (day: string) => `${day}T00:00:00${tzOffset(day)}`;
export const endIso = (day: string) => `${day}T23:59:59.999${tzOffset(day)}`;
export function bucharestDay(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
}
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => Number(v ?? 0) || 0;

export async function fetchAll(
  client: SupabaseClient,
  table: string,
  select: string,
  apply: (q: any) => any = (q) => q,
  cap = 30000,
): Promise<any[]> {
  const out: any[] = [];
  for (let off = 0; off < cap; off += 1000) {
    const { data, error } = await apply(client.from(table).select(select)).range(off, off + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function inBatches(client: SupabaseClient, table: string, select: string, col: string, ids: string[]) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    out.push(...(await fetchAll(client, table, select, (q) => q.in(col, part))));
  }
  return out;
}

const HUBS: Record<string, string> = {
  productie: "Producție", picking: "Picking", operator: "Operator", "depozit-mp": "Depozit MP",
  "depozit-ambalaje": "Depozit Ambalaje", etichete: "Etichete", calitate: "Calitate", achizitii: "Achiziții",
  administrativ: "Administrativ", vanzari: "Vânzări", chat: "Chat", taskuri: "Taskuri", mentenanta: "Mentenanță",
  "traction-tracker": "Traction Tracker", "": "Acasă",
};
const hubOf = (path: string) => {
  const seg = (path || "/").split("/")[1] ?? "";
  return HUBS[seg] ?? seg;
};

// ---------- overview ----------
export async function computeOverview(c: Clients, from: string, to: string, light = false) {
  const s = startIso(from), e = endIso(to);

  const [sesiuni, comenzi, rebut, linii] = await Promise.all([
    fetchAll(c.legacy, "productie_sesiuni_lucru",
      "id,comanda_id,linie_id,nume_operator,numar_angajati,ora_start,ora_sfarsit,cantitate_produsa,status",
      (q) => q.gte("ora_start", s).lte("ora_start", e)),
    fetchAll(c.legacy, "productie_comenzi",
      "id,status,cantitate,cantitate_reala_produsa,cantitate_din_restock,tip_comanda,magazin,created_at",
      (q) => q.gte("created_at", s).lte("created_at", e)),
    fetchAll(c.cloud, "productie_sesiuni_rebut", "sesiune_id,linie_id,linie_nume,cantitate,motiv,created_by_email,created_at",
      (q) => q.gte("created_at", s).lte("created_at", e)),
    fetchAll(c.legacy, "productie_linii", "id,nume"),
  ]);
  const lineName = new Map(linii.map((l: any) => [l.id, l.nume]));
  const rebutBySession = new Map<string, number>();
  for (const r of rebut) rebutBySession.set(r.sesiune_id, (rebutBySession.get(r.sesiune_id) ?? 0) + num(r.cantitate));

  const hoursOf = (x: any) =>
    x.ora_sfarsit ? Math.max(0, (new Date(x.ora_sfarsit).getTime() - new Date(x.ora_start).getTime()) / 3.6e6) : 0;

  const perLine = new Map<string, any>();
  const perOp = new Map<string, any>();
  const dailyProd = new Map<string, number>();
  const suspicious: any[] = [];
  let totalQty = 0, totalHours = 0, personHours = 0;
  for (const x of sesiuni) {
    const q = num(x.cantitate_produsa), h = hoursOf(x), ppl = Math.max(1, num(x.numar_angajati) || 1);
    totalQty += q; totalHours += h; personHours += h * ppl;
    const ln = lineName.get(x.linie_id) ?? "Necunoscută";
    const L = perLine.get(ln) ?? { linie: ln, sesiuni: 0, cantitate: 0, ore: 0, rebut_kg: 0 };
    L.sesiuni++; L.cantitate += q; L.ore += h; L.rebut_kg += rebutBySession.get(x.id) ?? 0;
    perLine.set(ln, L);
    const op = (x.nume_operator || "—").trim();
    const O = perOp.get(op.toLowerCase()) ?? { operator: op, sesiuni: 0, cantitate: 0, ore: 0, ore_om: 0, rebut_kg: 0, partiale: 0 };
    O.sesiuni++; O.cantitate += q; O.ore += h; O.ore_om += h * ppl; O.rebut_kg += rebutBySession.get(x.id) ?? 0;
    if (x.status === "partial") O.partiale++;
    perOp.set(op.toLowerCase(), O);
    const d = dayOf(x.ora_start);
    dailyProd.set(d, (dailyProd.get(d) ?? 0) + q);
    if (x.ora_sfarsit && h < 0.05 && q > 0) suspicious.push({ tip: "Sesiune sub 3 minute cu cantitate", operator: op, linie: ln, cantitate: q, data: x.ora_start });
    if (h > 14) suspicious.push({ tip: "Sesiune lăsată deschisă peste 14 ore", operator: op, linie: ln, cantitate: q, data: x.ora_start });
  }
  const totalRebut = rebut.reduce((a, r) => a + num(r.cantitate), 0);

  const byStatus: Record<string, number> = {};
  let comandat = 0, produsComenzi = 0, avans = 0;
  for (const o of comenzi) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    comandat += num(o.cantitate); produsComenzi += num(o.cantitate_reala_produsa);
    if (o.tip_comanda === "PRODUCTIE_AVANS" || o.magazin === "PRODUCTIE_AVANS") avans++;
  }

  const productie = {
    sesiuni: sesiuni.length,
    cantitate_produsa: r2(totalQty),
    ore_linie: r2(totalHours),
    ore_om: r2(personHours),
    productivitate_buc_ora_om: personHours ? r2(totalQty / personHours) : 0,
    rebut_kg: r2(totalRebut),
    sesiuni_partiale: sesiuni.filter((x: any) => x.status === "partial").length,
    comenzi: { total: comenzi.length, pe_status: byStatus, cantitate_comandata: r2(comandat), cantitate_livrata_din_productie: r2(produsComenzi), avans },
    pe_linie: [...perLine.values()].map((l) => ({ ...l, cantitate: r2(l.cantitate), ore: r2(l.ore), rebut_kg: r2(l.rebut_kg), buc_pe_ora: l.ore ? r2(l.cantitate / l.ore) : 0 }))
      .sort((a, b) => b.cantitate - a.cantitate),
    pe_operator: [...perOp.values()].map((o) => ({ ...o, cantitate: r2(o.cantitate), ore: r2(o.ore), ore_om: r2(o.ore_om), rebut_kg: r2(o.rebut_kg), buc_pe_ora_om: o.ore_om ? r2(o.cantitate / o.ore_om) : 0 }))
      .sort((a, b) => b.cantitate - a.cantitate),
    zilnic: [...dailyProd.entries()].sort().map(([zi, cantitate]) => ({ zi, cantitate: r2(cantitate) })),
  };

  if (light) return { perioada: { de_la: from, pana_la: to }, productie };

  const opBySession = new Map(sesiuni.map((x: any) => [x.id, x.nume_operator]));
  const motive = new Map<string, number>();
  for (const r of rebut) motive.set(r.motiv || "Fără motiv", (motive.get(r.motiv || "Fără motiv") ?? 0) + num(r.cantitate));
  const rebutDetaliu = {
    pe_motiv: [...motive.entries()].sort((a, b) => b[1] - a[1]).map(([motiv, kg]) => ({ motiv, kg: r2(kg) })),
    inregistrari: rebut.map((r: any) => ({ data: r.created_at, linie: r.linie_nume || lineName.get(r.linie_id) || "—", operator: opBySession.get(r.sesiune_id) || "—", kg: r2(num(r.cantitate)), motiv: r.motiv || "", introdus_de: r.created_by_email || "" }))
      .sort((a, b) => b.kg - a.kg).slice(0, 300),
  };

  // ----- stock -----
  const recSelect = "id,name,gross_quantity,quantity,unit,receipt_date,document_number,supplier_name";
  const [recMp, recAmb, recEt, transfers, profiles, pings, audit, recAudit] = await Promise.all([
    fetchAll(c.legacy, "inventory", recSelect, (q) => q.gte("receipt_date", s).lte("receipt_date", e)),
    fetchAll(c.legacy, "ambalaje_inventory", recSelect, (q) => q.gte("receipt_date", s).lte("receipt_date", e)),
    fetchAll(c.legacy, "etichete_inventory", recSelect, (q) => q.gte("receipt_date", s).lte("receipt_date", e)).catch(() => []),
    fetchAll(c.legacy, "stock_transfers", "id,transfer_date,destination", (q) => q.gte("transfer_date", from).lte("transfer_date", to)),
    fetchAll(c.legacyUser, "app_profiles", "user_id,email,name,approved").catch(() => []),
    fetchAll(c.cloud, "app_activity_pings", "user_id,email,display_name,path,tab,seconds,occurred_at",
      (q) => q.gte("occurred_at", s).lte("occurred_at", e), 100000),
    fetchAll(c.cloud, "productie_comenzi_audit", "table_name,action,changes,user_email,user_name,created_at",
      (q) => q.gte("created_at", s).lte("created_at", e)),
    fetchAll(c.cloud, "reception_audit_log", "inventory_type,user_email,created_at",
      (q) => q.gte("created_at", s).lte("created_at", e)),
  ]);
  const isCorr = (r: any) => /corec/i.test(r.document_number ?? "");
  const recSummary = (rows: any[]) => {
    const real = rows.filter((r) => !isCorr(r));
    const sup = new Map<string, number>();
    for (const r of real) sup.set(r.supplier_name || "—", (sup.get(r.supplier_name || "—") ?? 0) + 1);
    return {
      receptii: real.length,
      cantitate_bruta: r2(real.reduce((a, r) => a + num(r.gross_quantity ?? r.quantity), 0)),
      corectii: rows.length - real.length,
      lista: real.map((r) => ({ data: r.receipt_date, produs: r.name, furnizor: r.supplier_name || "—", cantitate: r2(num(r.gross_quantity ?? r.quantity)), unitate: r.unit || "", document: r.document_number || "" })).slice(0, 500),
      top_furnizori: [...sup.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([furnizor, receptii]) => ({ furnizor, receptii })),
    };
  };
  const items = transfers.length
    ? await inBatches(c.legacy, "stock_transfer_items", "transfer_id,net_quantity,quantity", "transfer_id", transfers.map((t: any) => t.id))
    : [];
  // ----- quality at reception (reception report) -----
  const recAll = [
    ...recMp.filter((r) => !isCorr(r)).map((r) => ({ ...r, _dep: "Materii Prime" })),
    ...recAmb.filter((r) => !isCorr(r)).map((r) => ({ ...r, _dep: "Ambalaje" })),
    ...recEt.filter((r) => !isCorr(r)).map((r) => ({ ...r, _dep: "Etichete" })),
  ];
  const recById = new Map(recAll.map((r) => [r.id, r]));
  const rep = recAll.length
    ? await inBatches(c.legacyUser, "reception_report_data", "inventory_id,cantitate_receptionata,pierdere_calitativa_procent,defects,photos,observations,transmis_la_furnizor", "inventory_id", recAll.map((r) => r.id)).catch(() => [])
    : [];
  const photoUrl = (ph: any) => ph?.path ? `${LEGACY_URL}/storage/v1/object/public/reception-photos/${ph.path}` : (ph?.url || "").replace(/\/object\/public\/reception-(Foto|foto|Poze|poze)\//, "/object/public/reception-photos/");
  const probleme: any[] = [];
  const defCount = new Map<string, number>();
  const supQ = new Map<string, { furnizor: string; receptii_cu_probleme: number; kg_pierdute: number; kg_receptionate: number }>();
  let kgPierdut = 0, kgRecVerificat = 0, poze = 0;
  for (const d of rep) {
    const r = recById.get(d.inventory_id); if (!r) continue;
    const kgRec = num(d.cantitate_receptionata ?? r.gross_quantity ?? r.quantity);
    const pct = num(d.pierdere_calitativa_procent);
    const kg = (kgRec * pct) / 100;
    const defs: string[] = Array.isArray(d.defects) ? d.defects : [];
    const photos = (Array.isArray(d.photos) ? d.photos : []).map(photoUrl).filter(Boolean);
    kgRecVerificat += kgRec;
    const sup = r.supplier_name || "—";
    const S = supQ.get(sup) ?? { furnizor: sup, receptii_cu_probleme: 0, kg_pierdute: 0, kg_receptionate: 0 };
    S.kg_receptionate += kgRec;
    if (pct > 0 || defs.length || photos.length || (d.observations ?? "").trim()) {
      kgPierdut += kg; poze += photos.length; S.receptii_cu_probleme++; S.kg_pierdute += kg;
      for (const x of defs) defCount.set(x, (defCount.get(x) ?? 0) + 1);
      probleme.push({ data: r.receipt_date, depozit: r._dep, produs: r.name, furnizor: sup, document: r.document_number || "", kg_receptionat: r2(kgRec), unitate: r.unit || "", pierdere_procent: pct, kg_pierdut: r2(kg), defecte: defs, observatii: d.observations || "", transmis_la_furnizor: !!d.transmis_la_furnizor, poze: photos });
    }
    supQ.set(sup, S);
  }
  const calitate = {
    receptii_verificate: rep.length,
    receptii_cu_probleme: probleme.length,
    kg_pierdere_calitativa: r2(kgPierdut),
    procent_pierdere: kgRecVerificat ? r2((kgPierdut / kgRecVerificat) * 100) : 0,
    poze: poze,
    pe_defect: [...defCount.entries()].sort((a, b) => b[1] - a[1]).map(([defect, receptii]) => ({ defect, receptii })),
    pe_furnizor: [...supQ.values()].filter((s) => s.receptii_cu_probleme)
      .map((s) => ({ ...s, kg_pierdute: r2(s.kg_pierdute), kg_receptionate: r2(s.kg_receptionate), procent: s.kg_receptionate ? r2((s.kg_pierdute / s.kg_receptionate) * 100) : 0 }))
      .sort((a, b) => b.kg_pierdute - a.kg_pierdute),
    probleme: probleme.sort((a, b) => b.kg_pierdut - a.kg_pierdut),
  };

  const depozite = {
    materii_prime: recSummary(recMp),
    ambalaje: recSummary(recAmb),
    etichete: recSummary(recEt),
    transferuri: { numar: transfers.length, linii: items.length, cantitate: r2(items.reduce((a, i) => a + num(i.net_quantity ?? i.quantity), 0)) },
  };

  // ----- people / activity -----
  const users = new Map<string, any>();
  for (const p of pings) {
    const U = users.get(p.user_id) ?? { user_id: p.user_id, nume: p.display_name || p.email, email: p.email, secunde: 0, huburi: {} as Record<string, number>, taburi: {} as Record<string, number>, ultima_activitate: p.occurred_at };
    U.secunde += num(p.seconds);
    const hub = hubOf(p.path);
    U.huburi[hub] = (U.huburi[hub] ?? 0) + num(p.seconds);
    const tab = `${hub}${p.tab ? " › " + p.tab : ""}`;
    U.taburi[tab] = (U.taburi[tab] ?? 0) + num(p.seconds);
    if (p.occurred_at > U.ultima_activitate) U.ultima_activitate = p.occurred_at;
    users.set(p.user_id, U);
  }
  const activi = [...users.values()].map((u) => ({
    nume: u.nume, email: u.email, ore: r2(u.secunde / 3600), ultima_activitate: u.ultima_activitate,
    huburi: Object.entries(u.huburi).sort((a: any, b: any) => b[1] - a[1]).map(([hub, sec]: any) => ({ hub, ore: r2(sec / 3600) })),
    taburi_top: Object.entries(u.taburi).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([tab, sec]: any) => ({ tab, ore: r2(sec / 3600) })),
  })).sort((a, b) => b.ore - a.ore);
  const activeIds = new Set(users.keys());
  const inactivi = profiles.filter((p: any) => p.approved && !activeIds.has(p.user_id))
    .map((p: any) => ({ nume: p.name || p.email, email: p.email }));
  const hubTotals = new Map<string, number>();
  for (const u of users.values()) for (const [h, sec] of Object.entries(u.huburi)) hubTotals.set(h, (hubTotals.get(h) ?? 0) + (sec as number));

  // ----- anomalies / errors per person -----
  const perPerson = new Map<string, any>();
  const bump = (who: string | null, key: string) => {
    const k = (who || "necunoscut").toLowerCase();
    const P = perPerson.get(k) ?? { persoana: who || "necunoscut", redeschideri_comenzi: 0, stergeri: 0, modificari_receptii: 0, modificari_comenzi: 0 };
    P[key]++; perPerson.set(k, P);
  };
  let reopen = 0, deletes = 0;
  for (const a of audit) {
    const who = a.user_name || a.user_email;
    if (a.action === "delete") { deletes++; bump(who, "stergeri"); continue; }
    const st = a.changes && !Array.isArray(a.changes) ? a.changes.status : undefined;
    if (a.table_name === "productie_comenzi" && a.action === "update" && st && st !== "completed") { reopen++; bump(who, "redeschideri_comenzi"); }
    else if (a.table_name === "productie_comenzi") bump(who, "modificari_comenzi");
  }
  for (const r of recAudit) bump(r.user_email, "modificari_receptii");
  const highRebut = production_highRebut(sesiuni, rebutBySession, lineName);

  const anomalii = {
    redeschideri_comenzi: reopen,
    stergeri: deletes,
    modificari_receptii_dupa_salvare: recAudit.length,
    corectii_stoc: depozite.materii_prime.corectii + depozite.ambalaje.corectii + depozite.etichete.corectii,
    sesiuni_suspecte: suspicious.slice(0, 30),
    sesiuni_rebut_mare: highRebut,
    pe_persoana: [...perPerson.values()].map((p) => ({ ...p, total: p.redeschideri_comenzi + p.stergeri + p.modificari_receptii + p.modificari_comenzi }))
      .sort((a, b) => b.total - a.total).slice(0, 20),
  };

  return {
    perioada: { de_la: from, pana_la: to },
    oameni: {
      utilizatori_activi: activi.length,
      ore_totale: r2(activi.reduce((a, u) => a + u.ore, 0)),
      activi,
      inactivi,
      pe_hub: [...hubTotals.entries()].sort((a, b) => b[1] - a[1]).map(([hub, sec]) => ({ hub, ore: r2(sec / 3600) })),
    },
    productie,
    depozite,
    anomalii,
    rebut: rebutDetaliu,
    calitate,
  };
}

function production_highRebut(sesiuni: any[], rebutBySession: Map<string, number>, lineName: Map<string, string>) {
  // rebut is in kg, quantity in pieces → flag sessions with notable absolute scrap
  return sesiuni
    .map((x) => ({ operator: x.nume_operator, linie: lineName.get(x.linie_id) ?? "—", data: x.ora_start, cantitate: num(x.cantitate_produsa), rebut_kg: r2(rebutBySession.get(x.id) ?? 0) }))
    .filter((x) => x.rebut_kg > 0)
    .sort((a, b) => b.rebut_kg - a.rebut_kg)
    .slice(0, 10);
}

export async function overviewWithTrend(c: Clients, from: string, to: string) {
  const days = Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 864e5) + 1;
  const pTo = addDays(from, -1), pFrom = addDays(from, -days);
  const [cur, prev] = await Promise.all([computeOverview(c, from, to), computeOverview(c, pFrom, pTo, true)]);
  return { ...cur, perioada_anterioara: { de_la: pFrom, pana_la: pTo, productie: { cantitate_produsa: prev.productie.cantitate_produsa, sesiuni: prev.productie.sesiuni, rebut_kg: prev.productie.rebut_kg, productivitate_buc_ora_om: prev.productie.productivitate_buc_ora_om, comenzi: prev.productie.comenzi.total } } };
}

// ---------- generic safe query ----------
export const TABLES: Record<string, { db: "legacy" | "cloud"; desc: string }> = {
  productie_comenzi: { db: "legacy", desc: "Comenzi producție: numar_comanda, magazin, punct_livrare, produs_id, cantitate, status(pending/in_progress/completed), linie_id, cantitate_din_restock, cantitate_reala_produsa, tip_comanda(PRODUCTIE_AVANS/REAMBALARE/null=fermă), data_productie, created_at, updated_at" },
  productie_sesiuni_lucru: { db: "legacy", desc: "Sesiuni de lucru operatori: comanda_id, linie_id, nume_operator(operator principal), numar_angajati, ora_start, ora_sfarsit, cantitate_produsa(buc), status(finalizata/partial/activa)" },
  productie_linii: { db: "legacy", desc: "Linii producție: id, nume, capacitate_ora, status" },
  productie_produse: { db: "legacy", desc: "Produse finite: id, nume, unitate_masura" },
  productie_clienti: { db: "legacy", desc: "Clienți/magazine: nume_magazin, punct_livrare, adresa, zona_livrare_id" },
  inventory: { db: "legacy", desc: "Recepții/loturi Materii Prime: name, quantity(stoc curent), gross_quantity, net_quantity, unit, receipt_date, document_number, lot_number, supplier_name, entry_number" },
  ambalaje_inventory: { db: "legacy", desc: "Recepții/loturi Ambalaje: aceleași coloane ca inventory" },
  etichete_inventory: { db: "legacy", desc: "Recepții/loturi Etichete: aceleași coloane ca inventory" },
  inventory_history: { db: "legacy", desc: "Istoric mișcări MP: inventory_item_id, action(add/remove/update), name, quantity, unit, operation_date, notes, lot_number, document_number" },
  stock_transfers: { db: "legacy", desc: "Transferuri depozit→producție: id, transfer_date(date), destination, notes" },
  stock_transfer_items: { db: "legacy", desc: "Linii transfer: transfer_id, inventory_item_id, quantity, net_quantity, unit" },
  production_stock: { db: "legacy", desc: "Stoc MP aflat în producție: name, quantity, unit, lot_number, transfer_date" },
  suppliers: { db: "legacy", desc: "Furnizori MP: name, supplier_code" },
  products: { db: "legacy", desc: "Nomenclator MP: name, cod_produs, default_unit, pt_percent" },
  productie_sesiuni_rebut: { db: "cloud", desc: "Rebut per sesiune (kg): sesiune_id, comanda_id, linie_nume, cantitate(kg), motiv, created_by_email, created_at" },
  productie_comenzi_audit: { db: "cloud", desc: "Jurnal modificări comenzi/sesiuni: table_name, action(insert/update/delete), changes(json), user_email, user_name, page_path, created_at" },
  reception_audit_log: { db: "cloud", desc: "Modificări ale recepțiilor după salvare: inventory_type, user_email, changes, created_at" },
  app_activity_pings: { db: "cloud", desc: "Timp petrecut în aplicație: email, display_name, path, tab, seconds, occurred_at" },
  app_tasks: { db: "cloud", desc: "Taskuri: title, status, priority, due_at, department, completed_at, created_at" },
  ambalaje_tuburi_miscari: { db: "cloud", desc: "Role/tuburi folie: produs_nume, tip(receptie/transfer/retur), role, tuburi, created_at" },
  productie_order_cuts: { db: "cloud", desc: "Tăieri de cantitate pe comenzi: comanda_id, cantitate_taiata, motiv, produs_nume" },
};

export type QuerySpec = {
  tabel: string;
  coloane: string[];
  filtre: Array<{ coloana: string; operator: string; valoare: string }>;
  ordonare: string | null;
  descrescator: boolean;
  grupare: string[];
  sume: string[];
  limita: number;
};
const IDENT = /^[a-z_][a-z0-9_]*$/;

export async function runQuery(c: Clients, spec: QuerySpec, cap = 20000) {
  const t = TABLES[spec.tabel];
  if (!t) throw new Error(`Tabel necunoscut: ${spec.tabel}`);
  const cols = [...new Set([...spec.coloane, ...spec.grupare, ...spec.sume])];
  for (const x of [...cols, ...spec.filtre.map((f) => f.coloana), ...(spec.ordonare ? [spec.ordonare] : [])]) {
    if (!IDENT.test(x)) throw new Error(`Coloană invalidă: ${x}`);
  }
  const client = t.db === "legacy" ? c.legacy : c.cloud;
  const rows = await fetchAll(client, spec.tabel, cols.length ? cols.join(",") : "*", (q) => {
    for (const f of spec.filtre) {
      const v = f.valoare;
      switch (f.operator) {
        case "eq": q = q.eq(f.coloana, v); break;
        case "neq": q = q.neq(f.coloana, v); break;
        case "gt": q = q.gt(f.coloana, v); break;
        case "gte": q = q.gte(f.coloana, v); break;
        case "lt": q = q.lt(f.coloana, v); break;
        case "lte": q = q.lte(f.coloana, v); break;
        case "ilike": q = q.ilike(f.coloana, `%${v}%`); break;
        case "in": q = q.in(f.coloana, v.split(",").map((s) => s.trim())); break;
        case "is_null": q = q.is(f.coloana, null); break;
        case "not_null": q = q.not(f.coloana, "is", null); break;
        default: throw new Error(`Operator invalid: ${f.operator}`);
      }
    }
    if (spec.ordonare) q = q.order(spec.ordonare, { ascending: !spec.descrescator });
    return q;
  }, cap);

  if (spec.grupare.length) {
    const g = new Map<string, any>();
    for (const r of rows) {
      const key = spec.grupare.map((k) => String(r[k] ?? "")).join("¦");
      const G = g.get(key) ?? { ...Object.fromEntries(spec.grupare.map((k) => [k, r[k]])), numar: 0, ...Object.fromEntries(spec.sume.map((k) => [`suma_${k}`, 0])) };
      G.numar++;
      for (const k of spec.sume) G[`suma_${k}`] += num(r[k]);
      g.set(key, G);
    }
    const sortKey = spec.sume.length ? `suma_${spec.sume[0]}` : "numar";
    const agg = [...g.values()].map((x) => { for (const k of spec.sume) x[`suma_${k}`] = r2(x[`suma_${k}`]); return x; })
      .sort((a, b) => b[sortKey] - a[sortKey]);
    return { total_randuri_sursa: rows.length, randuri: agg };
  }
  return { total_randuri_sursa: rows.length, randuri: rows };
}
