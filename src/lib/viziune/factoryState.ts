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
