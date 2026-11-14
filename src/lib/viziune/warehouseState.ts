// What exactly lies in the Viziune warehouses: raw-material lots and finished goods per store, with pallets.
// Pure rules, no React. Pallet sizes come from the server action viziune_pallets (Senior + price rules).
import { packagingStoreKey } from "../../../supabase/functions/_shared/packagingRules";
import { INTERNAL, producedOf, type VOrder } from "./factoryState";

/** As returned by viziune_pallets. */
export interface PalletInfo {
  /** Raw-material name → kg per pallet from the price rules (null: no rule matches). */
  raw: Record<string, number | null>;
  /** App product id → Senior article codes mapped to it. */
  products: Record<string, string[]>;
  /** `${productId}|${store key}` → the Senior code that store orders. */
  stores: Record<string, string>;
  /** Senior article code → pieces per pallet. */
  perCode: Record<string, number>;
}

/** magazin = the store's own Senior article; produs = all codes of the product agree; aproximativ = codes differ, most common taken. */
export type PerPallet = { pieces: number; source: "magazin" | "produs" | "aproximativ" } | null;

export function piecesPerPallet(info: PalletInfo | null | undefined, productId: string | null | undefined, store: string): PerPallet {
  if (!info || !productId) return null;
  const code = info.stores[`${productId}|${packagingStoreKey(store)}`];
  if (code && info.perCode[code] > 0) return { pieces: info.perCode[code], source: "magazin" };
  const coefs = (info.products[productId] ?? []).map((c) => info.perCode[c]).filter((v) => v > 0);
  if (!coefs.length) return null;
  const count = new Map<number, number>();
  for (const v of coefs) count.set(v, (count.get(v) ?? 0) + 1);
  // Most common; on a tie the smaller pallet (more pallets), so the count is never understated.
  const [pieces] = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return { pieces, source: count.size === 1 ? "produs" : "aproximativ" };
}

export interface PickProduct { key: string; productId: string | null; name: string; produced: number; ordered: number; orders: number; orderIds: string[]; lineIds: string[]; perPallet: PerPallet; pallets: number | null }
export interface PickStore { store: string; pieces: number; orders: number; products: PickProduct[]; pallets: number; missing: number }

/** Finished goods ready for each store today, per product, with pallets where Senior knows pieces/pallet. */
export function pickingDetail(orders: VOrder[], info: PalletInfo | null | undefined): PickStore[] {
  const stores = new Map<string, Map<string, PickProduct>>();
  for (const o of orders) {
    const store = (o.magazin || "").trim();
    if (!store || INTERNAL.has(store)) continue;
    const produced = producedOf(o);
    if (produced <= 0) continue;
    const name = o.productie_produse?.nume?.trim() || "Produs necunoscut";
    const key = o.produs_id || name;
    const m = stores.get(store) ?? new Map<string, PickProduct>();
    const p = m.get(key) ?? { key, productId: o.produs_id ?? null, name, produced: 0, ordered: 0, orders: 0, orderIds: [], lineIds: [], perPallet: null, pallets: null };
    p.produced += produced; p.ordered += Number(o.cantitate) || 0; p.orders += 1; p.orderIds.push(o.id);
    if (o.linie_id && !p.lineIds.includes(o.linie_id)) p.lineIds.push(o.linie_id);
    m.set(key, p); stores.set(store, m);
  }
  return [...stores.entries()].map(([store, m]) => {
    const products = [...m.values()].map((p) => {
      const perPallet = piecesPerPallet(info, p.productId, store);
      return { ...p, perPallet, pallets: perPallet ? p.produced / perPallet.pieces : null };
    }).sort((a, b) => b.produced - a.produced);
    return {
      store, products,
      pieces: products.reduce((a, p) => a + p.produced, 0),
      orders: products.reduce((a, p) => a + p.orders, 0),
      pallets: products.reduce((a, p) => a + (p.pallets ?? 0), 0),
      missing: products.filter((p) => p.pallets == null).length,
    };
  }).sort((a, b) => b.pieces - a.pieces);
}

export interface StockRow { name?: string | null; quantity?: number | null; unit?: string | null; lot_number?: string | null; receipt_date?: string | null; document_number?: string | null; suppliers?: { name?: string | null } | null }
export interface StockLot { lot: string; qty: number; unit: string; supplier: string; receiptDay: string | null; ageDays: number | null; document: string | null }
export interface DepotProduct { name: string; qty: number; unit: string; lots: StockLot[]; kgPerPallet: number | null; pallets: number | null }

const dayOf = (s: string | null | undefined) => {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" }) : null;
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const isKg = (u: string) => /^(kg|kilograme?)$/i.test(u.trim());

/** Raw-material stock per product, every lot still on stock (oldest first), pallets = kg ÷ the product's kg/pallet rule. */
export function depotDetail(rows: StockRow[], info: PalletInfo | null | undefined, today: string): DepotProduct[] {
  const m = new Map<string, DepotProduct>();
  for (const r of rows) {
    const qty = Number(r.quantity) || 0;
    const name = r.name?.trim();
    if (qty <= 0 || !name) continue;
    const unit = r.unit || "kg";
    const p = m.get(name) ?? { name, qty: 0, unit, lots: [], kgPerPallet: null, pallets: null };
    const receiptDay = dayOf(r.receipt_date);
    p.qty += qty;
    p.lots.push({ lot: r.lot_number?.trim() || "fără lot", qty, unit, supplier: r.suppliers?.name?.trim() || "Furnizor necunoscut", receiptDay, ageDays: receiptDay ? Math.max(0, daysBetween(receiptDay, today)) : null, document: r.document_number?.trim() || null });
    m.set(name, p);
  }
  return [...m.values()].map((p) => {
    const kg = info?.raw[p.name] ?? null;
    const lots = [...p.lots].sort((a, b) => (a.receiptDay ?? "9999").localeCompare(b.receiptDay ?? "9999"));
    return { ...p, lots, kgPerPallet: kg, pallets: kg && isKg(p.unit) ? p.qty / kg : null };
  }).sort((a, b) => b.qty - a.qty);
}
