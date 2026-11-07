// Real packing speed of a Senior product from Coral ERP production sessions (Producție), used where the labour CSV
// has no numeric speed (washed mixes: "viteza conform mix"). Same rules as the line speed report: closed sessions of
// 2 min – 12 h with pieces, overlapping sessions of one line merged so grouped orders are not counted twice.

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
export function matchesProduct(productName: string, t: { any: boolean; tokens: string[] }) {
  if (!t.tokens.length) return false;
  const ws = new Set(words(productName).flatMap((w) => w.split("/")));
  return t.any ? t.tokens.some((x) => ws.has(x)) : t.tokens.every((x) => ws.has(x));
}

export type Session = { id: string; linie_id: string; ora_start: string | null; ora_sfarsit: string | null; cantitate_produsa: number | null };
const ms = (s: string | null) => (s ? new Date(s).getTime() : NaN);
export function validSession(s: Session) {
  const a = ms(s.ora_start), b = ms(s.ora_sfarsit), q = Number(s.cantitate_produsa) || 0;
  const h = (b - a) / 3_600_000;
  return Number.isFinite(h) && h * 60 >= 2 && h <= 12 && q > 0;
}
/** Pieces ÷ worked hours, hours = union of the session intervals of each line. */
export function speedOf(sessions: Session[]) {
  const ok = [...new Map(sessions.filter(validSession).map((s) => [s.id, s])).values()];
  const byLine = new Map<string, Array<[number, number]>>();
  for (const s of ok) byLine.set(s.linie_id, [...(byLine.get(s.linie_id) ?? []), [ms(s.ora_start), ms(s.ora_sfarsit)]]);
  let hours = 0;
  for (const iv of byLine.values()) {
    iv.sort((x, y) => x[0] - y[0]);
    let a = NaN, b = NaN;
    for (const [x, y] of iv) {
      if (Number.isNaN(a) || x > b) { if (!Number.isNaN(a)) hours += (b - a) / 3_600_000; a = x; b = y; } else if (y > b) b = y;
    }
    if (!Number.isNaN(a)) hours += (b - a) / 3_600_000;
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

export type RealSpeed = { speed: number; pieces: number; hours: number; sessions: number; products: string[]; from: string; to: string };
/** Real speed per Senior article id, from the production products whose name matches it. */
export async function realLineSpeeds(legacy: any, articles: Array<{ id: number; name: string }>, endDay: string, days = SPEED_DAYS) {
  const result = new Map<number, RealSpeed>();
  if (!articles.length) return result;
  const end = new Date(`${endDay}T00:00:00Z`), start = new Date(end); start.setUTCDate(start.getUTCDate() - days);
  const from = start.toISOString().slice(0, 10);
  const products: Array<{ id: string; nume: string }> = await all(() => legacy.from("productie_produse").select("id,nume").order("id"));
  const wanted = articles.map((a) => { const t = speedTokens(a.name); return { a, ids: products.filter((p) => matchesProduct(p.nume, t)) }; }).filter((x) => x.ids.length);
  const pids = [...new Set(wanted.flatMap((w) => w.ids.map((p) => p.id)))];
  if (!pids.length) return result;
  const orders = (await pool(chunks(pids, 50), 4, (ids) => all(() => legacy.from("productie_comenzi").select("id,produs_id").in("produs_id", ids).gte("created_at", from).order("id")))).flat();
  const oids = orders.map((o: any) => o.id);
  const sessions: Array<Session & { comanda_id: string }> = (await pool(chunks(oids, 50), 6, (ids) => all(() => legacy.from("productie_sesiuni_lucru")
    .select("id,linie_id,comanda_id,ora_start,ora_sfarsit,cantitate_produsa").in("comanda_id", ids).gte("ora_start", from).lt("ora_start", end.toISOString()).order("id")))).flat();
  const productOf = new Map(orders.map((o: any) => [o.id, o.produs_id]));
  for (const w of wanted) {
    const set = new Set(w.ids.map((p) => p.id));
    const s = speedOf(sessions.filter((x) => set.has(productOf.get(x.comanda_id))));
    if (s.speed != null && s.sessions >= 3 && s.hours >= 1) result.set(w.a.id, { speed: s.speed, pieces: s.pieces, hours: s.hours, sessions: s.sessions, products: w.ids.map((p) => p.nume).slice(0, 6), from, to: endDay });
  }
  return result;
}
const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
