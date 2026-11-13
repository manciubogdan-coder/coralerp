// Pure rules for the Viziune 3D factory: turns today's real orders, sessions,
// receptions and stock into what each zone of the scene draws.

export interface VOrder {
  id: string;
  linie_id?: string | null;
  status: string;
  cantitate: number;
  cantitate_produsa_sesiuni?: number | null;
  cantitate_reala_produsa?: number | null;
  magazin?: string | null;
  data_productie?: string | null;
  productie_produse?: { nume?: string } | null;
}
export interface VSession { id: string; comanda_id: string; linie_id: string; nume_operator?: string | null; numar_angajati?: number | null; ora_start?: string | null }
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
}

const INTERNAL = new Set(["PRODUCTIE_AVANS", "REAMBALARE"]);

export function producedOf(o: VOrder): number {
  const q = Number(o.cantitate) || 0;
  const s = Number(o.cantitate_produsa_sesiuni ?? o.cantitate_reala_produsa ?? 0) || 0;
  const done = o.status === "completed" ? Math.max(s, s > 0 ? s : q) : s;
  return Math.max(0, Math.min(q, done));
}

export function buildLines(lines: VLine[], orders: VOrder[], sessions: VSession[]): LineView[] {
  return lines.map((l) => {
    const lo = orders.filter((o) => o.linie_id === l.id);
    const ls = sessions.filter((s) => s.linie_id === l.id);
    const pieces = lo.reduce((a, o) => a + (Number(o.cantitate) || 0), 0);
    const produced = lo.reduce((a, o) => a + producedOf(o), 0);
    const ordersDone = lo.filter((o) => o.status === "completed").length;
    const cur = ls[0] ? lo.find((o) => o.id === ls[0].comanda_id) : undefined;
    let status: LineView["status"];
    if (l.status !== "activa") status = "oprita";
    else if (ls.length) status = "lucreaza";
    else if (lo.length && ordersDone === lo.length) status = "terminat";
    else status = "asteapta";
    return {
      id: l.id, name: l.nume, status, orders: lo,
      ordersTotal: lo.length, ordersDone, pieces, produced,
      workers: ls.reduce((a, s) => a + (Number(s.numar_angajati) || 1), 0),
      operator: ls[0]?.nume_operator ?? null,
      currentProduct: cur?.productie_produse?.nume ?? null,
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
