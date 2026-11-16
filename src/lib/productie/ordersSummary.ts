// Centralizator comenzi: comenzile unei zile grupate pe magazin, cu total bucăți
// pe magazin și pe zi. Fără React și fără acces la baza de date.
import { storeLabel } from "./recipeBook";

export interface SummaryOrder {
  numar_comanda?: string | null;
  magazin?: string | null;
  punct_livrare?: string | null;
  cantitate?: number | string | null;
  status?: string | null;
  tip_comanda?: string | null;
  produs?: string | null;
  unitate?: string | null;
}

export interface SummaryRow { produs: string; cantitate: number; unitate: string; comenzi: string[] }
export interface SummaryStore { store: string; rows: SummaryRow[]; totalBuc: number; otherUnits: Record<string, number> }
export interface OrdersSummary { stores: SummaryStore[]; totalBuc: number; otherUnits: Record<string, number>; nrComenzi: number }

const INTERNAL = new Set(["PRODUCTIE_AVANS", "REAMBALARE"]);

/** Comenzi reale de la clienți: fără avans/reambalare, anulate în Senior sau estimări absorbite (cantitate 0). */
export function isCustomerOrder(o: SummaryOrder) {
  if (INTERNAL.has(String(o.magazin || "").trim().toUpperCase())) return false;
  if (INTERNAL.has(String(o.tip_comanda || "").trim().toUpperCase())) return false;
  if (o.status === "canceled_by_erp") return false;
  return Number(o.cantitate) > 0;
}

/** Doar unitățile de greutate/volum se totalizează separat; restul (inclusiv valori greșite ca „1”) sunt bucăți. */
export function isPieces(unit?: string | null) {
  return !/^(kg|g|gr|grame?|l|litri?)$/i.test(String(unit || "").trim());
}

const unitOf = (u?: string | null) => (isPieces(u) ? "buc" : String(u).trim().toLowerCase());
const add = (m: Record<string, number>, k: string, v: number) => { m[k] = (m[k] || 0) + v; };

export function buildOrdersSummary(orders: SummaryOrder[]): OrdersSummary {
  const byStore = new Map<string, Map<string, SummaryRow>>();
  let nrComenzi = 0;
  for (const o of orders) {
    if (!isCustomerOrder(o)) continue;
    const store = storeLabel(o) || "Fără magazin";
    const produs = String(o.produs || "").trim() || "Produs necunoscut";
    const unitate = unitOf(o.unitate);
    const rows = byStore.get(store) ?? byStore.set(store, new Map()).get(store)!;
    const key = `${produs}|${unitate}`;
    const row = rows.get(key) ?? rows.set(key, { produs, cantitate: 0, unitate, comenzi: [] }).get(key)!;
    row.cantitate += Number(o.cantitate);
    const nr = String(o.numar_comanda || "").trim();
    if (nr && !row.comenzi.includes(nr)) row.comenzi.push(nr);
    nrComenzi++;
  }
  const stores: SummaryStore[] = [...byStore.entries()].map(([store, m]) => {
    const rows = [...m.values()].sort((a, b) => a.produs.localeCompare(b.produs, "ro"));
    const otherUnits: Record<string, number> = {};
    let totalBuc = 0;
    rows.forEach(r => (r.unitate === "buc" ? (totalBuc += r.cantitate) : add(otherUnits, r.unitate, r.cantitate)));
    return { store, rows, totalBuc, otherUnits };
  }).sort((a, b) => a.store.localeCompare(b.store, "ro"));
  const otherUnits: Record<string, number> = {};
  stores.forEach(s => Object.entries(s.otherUnits).forEach(([u, v]) => add(otherUnits, u, v)));
  return { stores, totalBuc: stores.reduce((a, s) => a + s.totalBuc, 0), otherUnits, nrComenzi };
}

/** Rândurile foii Excel, în aceeași ordine și cu aceleași coloane ca tabelul din ecran. */
export function summarySheetRows(s: OrdersSummary, title: string): (string | number)[][] {
  const out: (string | number)[][] = [[title], [], ["Magazin", "Produs", "Cantitate", "UM"]];
  for (const st of s.stores) {
    st.rows.forEach(r => out.push([st.store, r.produs, r.cantitate, r.unitate]));
    out.push([`Total ${st.store}`, "", st.totalBuc, "buc"]);
    Object.entries(st.otherUnits).forEach(([u, v]) => out.push([`Total ${st.store}`, "", v, u]));
    out.push([]);
  }
  out.push(["TOTAL ZI", "", s.totalBuc, "buc"]);
  Object.entries(s.otherUnits).forEach(([u, v]) => out.push(["TOTAL ZI", "", v, u]));
  return out;
}
