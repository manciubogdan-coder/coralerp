// Real packing speed of a Senior product from Coral ERP production sessions (Producție), used where the labour CSV
// has no numeric speed (washed mixes: "viteza conform mix"). Closed sessions of 2 min – 12 h with pieces. A line often
// keeps sessions of other products open at the same time (Vracuri pungi), so the product gets only its share of the
// line's time: each moment is split between the sessions running then, in proportion to their pieces per hour.

export const SPEED_DAYS = 90;
const STOP = new Set(["MIX", "MIXURI", "SALATA", "SALATE", "GR", "G", "KG", "VRAC", "SI", "CU", "DE", "PENTRU"]);
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const words = (s: string) => plain(s).replace(/[^A-Z0-9/]+/g, " ").split(/[\s]+/).filter(Boolean);

/** Words identifying the product. A carton "Lupino/Amorino" is produced as its components: any component matches. */
export function speedTokens(name: string): { any: boolean; tokens: string[] } {
  const ws = words(name);
  const slash = ws.some((w) => w.includes("/"));
  const tokens = ws.flatMap((w) => w.split("/")).filter((w) => (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)) || (!slash && /^\d{2,4}$/.test(w)));
  return { any: slash, tokens: [...new Set(tokens)] };
}
/** Pack formats packed on different lines: "SAL. ATLANTIC 500 PG" (Salate 1) is not "SAL. ATLANTIC 500 GASTRO" (Vracuri). */
const FORMATS = ["GASTRO", "VRAC", "HORECA", "PG", "KG", "BOWL"];
const formatsOf = (name: string) => { const ws = new Set(words(name)); return FORMATS.filter((f) => ws.has(f)).join(","); };
export function matchesProduct(productName: string, t: { any: boolean; tokens: string[]; formats?: string }) {
  if (!t.tokens.length) return false;
  const ws = new Set(words(productName).flatMap((w) => w.split("/")));
  if (!t.any && t.formats != null && formatsOf(productName) !== t.formats) return false;
  return t.any ? t.tokens.some((x) => ws.has(x)) : t.tokens.every((x) => ws.has(x));
}

export type Session = { id: string; linie_id: string; ora_start: string | null; ora_sfarsit: string | null; cantitate_produsa: number | null };
const ms = (s: string | null) => (s ? new Date(s).getTime() : NaN);
export function validSession(s: Session) {
  const a = ms(s.ora_start), b = ms(s.ora_sfarsit), q = Number(s.cantitate_produsa) || 0;
  const h = (b - a) / 3_600_000;
  return Number.isFinite(h) && h * 60 >= 2 && h <= 12 && q > 0;
}
/** Pieces ÷ worked hours, hours = union of the session intervals of each line (no other products on the line). */
export function speedOf(sessions: Session[]) {
  return sharedSpeedOf(sessions, sessions);
}
/** Pieces of `own` ÷ the line time they took: every moment of a line is shared by all sessions open then (`line`, any
 * product, `own` included), in proportion to each session's pieces per hour. Alone on the line a session keeps its
 * whole duration; a session left open for hours next to busy orders gets only the little time its few pieces took. */
export function sharedSpeedOf(own: Session[], line: Session[]) {
  const ok = [...new Map(own.filter(validSession).map((s) => [s.id, s])).values()];
  const mine = new Set(ok.map((s) => s.id));
  const all = [...new Map([...line, ...ok].filter(validSession).map((s) => [s.id, s])).values()];
  const byLine = new Map<string, Session[]>();
  for (const s of all) { const l = byLine.get(s.linie_id); if (l) l.push(s); else byLine.set(s.linie_id, [s]); }
  let hours = 0;
  for (const ss of byLine.values()) {
    if (!ss.some((s) => mine.has(s.id))) continue;
    // Sweep: at each start/end the running sum of pieces/hour (all sessions, own sessions) changes.
    const delta = new Map<number, [number, number]>();
    const add = (t: number, all: number, own: number) => { const d = delta.get(t) ?? [0, 0]; delta.set(t, [d[0] + all, d[1] + own]); };
    for (const s of ss) {
      const a = ms(s.ora_start), b = ms(s.ora_sfarsit), r = (Number(s.cantitate_produsa) || 0) / ((b - a) / 3_600_000), o = mine.has(s.id) ? r : 0;
      add(a, r, o); add(b, -r, -o);
    }
    const cuts = [...delta.keys()].sort((x, y) => x - y);
    let total = 0, own = 0;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const d = delta.get(cuts[i])!; total += d[0]; own += d[1];
      if (total > 1e-9 && own > 1e-9) hours += ((cuts[i + 1] - cuts[i]) / 3_600_000) * Math.min(1, own / total);
    }
  }
  const pieces = ok.reduce((t, s) => t + (Number(s.cantitate_produsa) || 0), 0);
  return { pieces, hours, sessions: ok.length, speed: hours > 0 ? pieces / hours : null };
}

async function all(q: () => any, page = 1000) {
  const out: any[] = [];
  for (let off = 0; ; off += page) {
    const { data, error } = await q().range(off, off + page - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < page) return out;
  }
}
async function pool<T, R>(xs: T[], n: number, f: (x: T) => Promise<R>) {
  const out: R[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => { while (i < xs.length) { const k = i++; out[k] = await f(xs[k]); } }));
  return out;
}

/** Speed on `line`, the Producție line most of the product's orders went to (only its sessions count). `norm`: too few
 * timed sessions there, so the speed is that line's norm (capacitate_ora). */
export type RealSpeed = { speed: number; pieces: number; hours: number; sessions: number; products: string[]; from: string; to: string; line: string; orders: number; norm?: boolean };
/** Real speed per Senior article id, from the production products whose name matches it, on their usual line. */
export const isBulkLine = (line: string) => /vrac|gastro/i.test(line.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
export async function realLineSpeeds(legacy: any, articles: Array<{ id: number; name: string }>, endDay: string, days = SPEED_DAYS) {
  const result = new Map<number, RealSpeed>();
  if (!articles.length) return result;
  const end = new Date(`${endDay}T00:00:00Z`), start = new Date(end); start.setUTCDate(start.getUTCDate() - days);
  const from = start.toISOString().slice(0, 10);
  const products: Array<{ id: string; nume: string }> = await all(() => legacy.from("productie_produse").select("id,nume").order("id"));
  const wanted = articles.map((a) => { const t = { ...speedTokens(a.name), formats: formatsOf(a.name) }; return { a, ids: products.filter((p) => matchesProduct(p.nume, t)) }; }).filter((x) => x.ids.length);
  const pids = [...new Set(wanted.flatMap((w) => w.ids.map((p) => p.id)))];
  if (!pids.length) return result;
  const orders = (await pool(chunks(pids, 50), 4, (ids) => all(() => legacy.from("productie_comenzi").select("id,produs_id,linie_id").in("produs_id", ids).gte("created_at", from).order("id")))).flat();
  const oids = orders.map((o: any) => o.id);
  const sessions: Array<Session & { comanda_id: string }> = (await pool(chunks(oids, 50), 6, (ids) => all(() => legacy.from("productie_sesiuni_lucru")
    .select("id,linie_id,comanda_id,ora_start,ora_sfarsit,cantitate_produsa").in("comanda_id", ids).gte("ora_start", from).lt("ora_start", end.toISOString()).order("id")))).flat();
  // Every session of those lines in the window (all products), to share the line's time.
  const lineIds = [...new Set(sessions.map((s) => s.linie_id).filter(Boolean))];
  const lineSessions: Session[] = (await pool(lineIds, 4, (id) => all(() => legacy.from("productie_sesiuni_lucru")
    .select("id,linie_id,ora_start,ora_sfarsit,cantitate_produsa").eq("linie_id", id).gte("ora_start", from).lt("ora_start", end.toISOString()).order("id")))).flat();
  const productOf = new Map(orders.map((o: any) => [o.id, o.produs_id]));
  const lines: Array<{ id: string; nume: string; capacitate_ora: number | null }> = await all(() => legacy.from("productie_linii").select("id,nume,capacitate_ora").order("id"));
  const lineBy = new Map(lines.map((l) => [l.id, l]));
  for (const w of wanted) {
    const set = new Set(w.ids.map((p) => p.id));
    const own = sessions.filter((x) => set.has(productOf.get(x.comanda_id)));
    // The usual line: where most pieces were really produced (timed sessions), else where most orders were assigned.
    const usual = usualLineNorm(own.filter(validSession).map((x) => ({ linie_id: x.linie_id, weight: Number(x.cantitate_produsa) || 0 })), lineBy)
      ?? usualLineNorm(orders.filter((o: any) => set.has(o.produs_id)), lineBy);
    if (!usual) continue;
    // Only sessions on lines of the same kind (hand-packed Vracuri/GASTRO vs machines): their crews differ.
    const bulk = isBulkLine(usual.line);
    const s = sharedSpeedOf(own.filter((x) => isBulkLine(lineBy.get(x.linie_id)?.nume ?? "") === bulk), lineSessions);
    const base = { pieces: s.pieces, hours: s.hours, sessions: s.sessions, products: w.ids.map((p) => p.nume).slice(0, 6), from, to: endDay, line: usual.line, orders: usual.orders };
    result.set(w.a.id, s.speed != null && s.sessions >= 3 && s.hours >= 1 ? { speed: s.speed, ...base } : { speed: usual.speed, ...base, norm: true });
  }
  return result;
}
/** Norm of the line most of the orders (or weighted pieces) were assigned to (lines without a norm ignored). */
export function usualLineNorm(orders: Array<{ linie_id: string | null; weight?: number }>, lineBy: Map<string, { nume: string; capacitate_ora: number | null }>) {
  const count = new Map<string, number>();
  for (const o of orders) { const l = o.linie_id ? lineBy.get(o.linie_id) : null; if (l && (Number(l.capacitate_ora) || 0) > 0) count.set(o.linie_id!, (count.get(o.linie_id!) ?? 0) + (o.weight ?? 1)); }
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  const l = lineBy.get(best[0])!;
  return { id: best[0], line: l.nume.trim(), speed: Number(l.capacitate_ora), orders: best[1] };
}
const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
