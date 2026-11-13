// Pure rules for the Viziune 3D factory: turns today's real orders, sessions,
// receptions and stock into what each zone of the scene draws.
import { MAX_SESSION_HOURS, mergedHours } from "@/lib/productie/lineSpeed";

export interface VOrder {
  id: string;
  linie_id?: string | null;
  status: string;
  cantitate: number;
  cantitate_produsa_sesiuni?: number | null;
  cantitate_reala_produsa?: number | null;
  cantitate_din_restock?: number | null;
  tip_comanda?: string | null;
  magazin?: string | null;
  data_productie?: string | null;
  productie_produse?: { nume?: string } | null;
}
export interface VSession {
  id: string; comanda_id: string; linie_id: string; nume_operator?: string | null; numar_angajati?: number | null;
  ora_start?: string | null; ora_sfarsit?: string | null; cantitate_produsa?: number | null; status?: string | null;
}
export const isOpenSession = (s: VSession) => (s.status ? s.status === "activa" : !s.ora_sfarsit);
const MAX_MS = MAX_SESSION_HOURS * 3_600_000;
/** An open session started more than MAX_SESSION_HOURS ago was forgotten running: it is not live work. */
export const isForgotten = (s: VSession, now: number) => isOpenSession(s) && !!s.ora_start && now - new Date(s.ora_start).getTime() > MAX_MS;
export const isLiveSession = (s: VSession, now: number) => isOpenSession(s) && !isForgotten(s, now);
/** Sessions whose time can be trusted for the norm check (closed ones longer than the cap were left running). */
const timeable = (s: VSession, now: number) => {
  if (isOpenSession(s)) return isLiveSession(s, now);
  const a = s.ora_start ? new Date(s.ora_start).getTime() : NaN, b = s.ora_sfarsit ? new Date(s.ora_sfarsit).getTime() : NaN;
  return !isNaN(a) && !isNaN(b) && b > a && b - a <= MAX_MS;
};
export interface VLine { id: string; nume: string; status: string; capacitate_ora?: number | null }

export interface LineView {
  id: string;
  name: string;
  status: "lucreaza" | "asteapta" | "terminat" | "oprita";
  ordersTotal: number;
  ordersDone: number;
  pieces: number;
  produced: number;
  workers: number;
  operator: string | null;
  currentProduct: string | null;
  orders: VOrder[];
  norm: number;
  pace: LinePace;
}

export type PaceStatus = "in_norma" | "aproape" | "intarziat" | "fara_norma" | "liber";
export interface InWorkOrder { id: string; product: string; store: string; qty: number; startedAt: number | null; normMinutes: number | null }
export interface LinePace {
  status: PaceStatus;
  orders: InWorkOrder[];
  /** First session start of the orders now in work (ms). */
  startedAt: number | null;
  /** Real worked time on those orders, overlapping sessions merged, open ones counted until now. */
  workedHours: number;
  qty: number;
  /** Time the line norm allows for the orders in work. */
  normHours: number | null;
  /** When they should be done at norm speed, given the time already worked (ms). */
  dueAt: number | null;
  /** Minutes past the norm time (0 while still within it). */
  lateMinutes: number;
  /** Pieces that should be ready by now at norm speed. */
  expectedNow: number;
  /** Not-started work still waiting on the line today. */
  queueOrders: number;
  queueQty: number;
  /** When everything on the line today should be done at norm speed (ms). */
  dayDoneAt: number | null;
  /** Open sessions on orders not loaded for today (planned for another day). */
  otherDayOrders: number;
  /** Sessions left open for more than MAX_SESSION_HOURS: ignored, listed so someone closes them. */
  forgotten: VSession[];
}

/** Share of the norm time used before a batch is flagged as about to run late. */
export const PACE_WARN_RATIO = 0.9;

const INTERNAL = new Set(["PRODUCTIE_AVANS", "REAMBALARE"]);

export function producedOf(o: VOrder): number {
  const q = Number(o.cantitate) || 0;
  const s = Number(o.cantitate_produsa_sesiuni ?? o.cantitate_reala_produsa ?? 0) || 0;
  const done = o.status === "completed" ? Math.max(s, s > 0 ? s : q) : s;
  return Math.max(0, Math.min(q, done));
}

const isRepack = (o: VOrder) => o.magazin === "REAMBALARE" || o.tip_comanda === "REAMBALARE";
/** Pieces still to make, as the Operator screen counts them (restock covers firm orders, not repacks). */
export function remainingOf(o: VOrder): number {
  if (o.status === "completed") return 0;
  const covered = (Number(o.cantitate_reala_produsa) || 0) + (isRepack(o) ? 0 : Number(o.cantitate_din_restock) || 0);
  return Math.max(0, (Number(o.cantitate) || 0) - covered);
}

/** People on the line: grouped sessions repeat the same team, so count each operator's team once. */
export function teamSize(open: VSession[]): number {
  const byOp = new Map<string, number>();
  open.forEach((s, i) => {
    const k = (s.nume_operator || "").trim().toLowerCase() || `#${i}`;
    byOp.set(k, Math.max(byOp.get(k) ?? 0, Math.max(1, Number(s.numar_angajati) || 1)));
  });
  return [...byOp.values()].reduce((a, b) => a + b, 0);
}

const msOf = (s?: string | null) => (s ? new Date(s).getTime() : NaN);

/**
 * Norm check for what a line is making right now: the orders with an open session form one batch
 * (grouped orders run together on the line), timed from their first session with real worked time,
 * against quantity ÷ line norm (buc/h).
 */
export function linePace(norm: number, lineOrders: VOrder[], allSessions: VSession[], lineId: string, now: number, allOrders: VOrder[] = lineOrders): LinePace {
  const forgotten = allSessions.filter((s) => s.linie_id === lineId && isForgotten(s, now));
  const open = allSessions.filter((s) => s.linie_id === lineId && isLiveSession(s, now));
  const inWorkIds = new Set(open.map((s) => s.comanda_id));
  // The session says where the order runs, even if the order was planned on another line.
  const byId = new Map(allOrders.map((o) => [o.id, o]));
  const inWork = [...inWorkIds].map((id) => byId.get(id)).filter(Boolean) as VOrder[];
  const sessionsOf = allSessions.filter((s) => inWorkIds.has(s.comanda_id) && timeable(s, now));
  const nowIso = new Date(now).toISOString();
  const workedHours = mergedHours(sessionsOf.map((s) => ({ id: s.id, linie_id: s.linie_id, ora_start: s.ora_start, ora_sfarsit: isOpenSession(s) ? nowIso : s.ora_sfarsit })) as any);
  const starts = sessionsOf.map((s) => msOf(s.ora_start)).filter((t) => !isNaN(t));
  const startedAt = starts.length ? Math.min(...starts) : null;
  const qty = inWork.reduce((a, o) => a + (Number(o.cantitate) || 0), 0);
  const hasNorm = norm > 0;
  const normHours = hasNorm && qty > 0 ? qty / norm : null;
  const leftH = normHours != null ? normHours - workedHours : null;
  const dueAt = leftH != null ? now + leftH * 3_600_000 : null;
  const lateMinutes = leftH != null && leftH < 0 ? Math.round(-leftH * 60) : 0;
  const queue = lineOrders.filter((o) => !inWorkIds.has(o.id) && remainingOf(o) > 0);
  const queueQty = queue.reduce((a, o) => a + remainingOf(o), 0);
  const dayDoneAt = hasNorm ? now + (Math.max(0, leftH ?? 0) + queueQty / norm) * 3_600_000 : null;
  let status: PaceStatus;
  if (!inWork.length) status = "liber";
  else if (normHours == null) status = "fara_norma";
  else if (lateMinutes >= 1) status = "intarziat";
  else if (workedHours >= normHours * PACE_WARN_RATIO) status = "aproape";
  else status = "in_norma";
  return {
    status, startedAt, workedHours, qty, normHours, dueAt, lateMinutes,
    expectedNow: hasNorm ? Math.min(qty, Math.round(norm * workedHours)) : 0,
    queueOrders: queue.length, queueQty, dayDoneAt, forgotten,
    otherDayOrders: inWorkIds.size - inWork.length,
    orders: inWork.map((o) => {
      const st = sessionsOf.filter((s) => s.comanda_id === o.id).map((s) => msOf(s.ora_start)).filter((t) => !isNaN(t));
      return {
        id: o.id, product: o.productie_produse?.nume ?? "—", store: o.magazin === "PRODUCTIE_AVANS" ? "Avans" : o.magazin || "",
        qty: Number(o.cantitate) || 0, startedAt: st.length ? Math.min(...st) : null,
        normMinutes: hasNorm ? Math.round(((Number(o.cantitate) || 0) / norm) * 60) : null,
      };
    }).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)),
  };
}

export function buildLines(lines: VLine[], orders: VOrder[], sessions: VSession[], now = Date.now()): LineView[] {
  return lines.map((l) => {
    const lo = orders.filter((o) => o.linie_id === l.id);
    const ls = sessions.filter((s) => s.linie_id === l.id && isLiveSession(s, now));
    const norm = Number(l.capacitate_ora) || 0;
    const pace = linePace(norm, lo, sessions, l.id, now, orders);
    const pieces = lo.reduce((a, o) => a + (Number(o.cantitate) || 0), 0);
    const produced = lo.reduce((a, o) => a + producedOf(o), 0);
    const ordersDone = lo.filter((o) => o.status === "completed").length;
    const cur = pace.orders[0];
    let status: LineView["status"];
    if (l.status !== "activa") status = "oprita";
    else if (ls.length) status = "lucreaza";
    else if (lo.length && ordersDone === lo.length) status = "terminat";
    else status = "asteapta";
    return {
      id: l.id, name: l.nume, status, orders: lo,
      ordersTotal: lo.length, ordersDone, pieces, produced, norm, pace,
      workers: teamSize(ls),
      operator: [...new Set(ls.map((s) => s.nume_operator).filter(Boolean))].join(", ") || null,
      currentProduct: cur?.product ?? null,
    };
  });
}

export interface StoreReady { store: string; pieces: number; orders: number }

/** Finished pieces waiting at dispatch, per real store (internal advance/repack orders excluded). */
export function readyByStore(orders: VOrder[]): StoreReady[] {
  const m = new Map<string, StoreReady>();
  for (const o of orders) {
    const store = (o.magazin || "").trim();
    if (!store || INTERNAL.has(store)) continue;
    const p = producedOf(o);
    if (p <= 0) continue;
    const r = m.get(store) ?? { store, pieces: 0, orders: 0 };
    r.pieces += p; r.orders += 1; m.set(store, r);
  }
  return [...m.values()].sort((a, b) => b.pieces - a.pieces);
}

export interface StockItem { name: string; qty: number; unit: string }

export function stockByProduct(rows: { name?: string | null; quantity?: number | null; unit?: string | null }[]): StockItem[] {
  const m = new Map<string, StockItem>();
  for (const r of rows) {
    const q = Number(r.quantity) || 0;
    if (q <= 0 || !r.name) continue;
    const k = r.name.trim();
    const it = m.get(k) ?? { name: k, qty: 0, unit: r.unit || "kg" };
    it.qty += q; m.set(k, it);
  }
  return [...m.values()].sort((a, b) => b.qty - a.qty);
}

export const bucharestToday = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });

export interface PreLine { product_name: string; cantitate_document: number | null; unit?: string | null; received_at?: string | null }
export interface PreDoc { id: string; document_number?: string | null; supplier_name?: string | null; expected_date?: string | null; status: string; linii?: PreLine[] }
export interface PreView { id: string; supplier: string; doc: string; expected: string | null; late: boolean; kgExpected: number; kgLeft: number; linesLeft: number; linesTotal: number; products: string[] }

/** Announced deliveries still to unload today: expected today or earlier and not fully received. */
export function pendingPrereceptions(docs: PreDoc[], today: string): PreView[] {
  return docs
    .filter((d) => d.status !== "receptionata" && (!d.expected_date || d.expected_date <= today))
    .map((d) => {
      const lines = d.linii || [];
      const left = lines.filter((l) => !l.received_at);
      const kg = (ls: PreLine[]) => ls.reduce((a, l) => a + (Number(l.cantitate_document) || 0), 0);
      return {
        id: d.id, supplier: d.supplier_name || "Furnizor necunoscut", doc: d.document_number || "", expected: d.expected_date ?? null,
        late: !!d.expected_date && d.expected_date < today,
        kgExpected: kg(lines), kgLeft: kg(left), linesLeft: left.length, linesTotal: lines.length,
        products: [...new Set(left.map((l) => l.product_name))],
      };
    })
    .filter((p) => p.linesLeft > 0)
    .sort((a, b) => Number(b.late) - Number(a.late) || b.kgLeft - a.kgLeft);
}
