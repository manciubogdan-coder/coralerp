// Presentation mode of Viziune: the day's headline figures, the cinematic tour stops and the
// live factory picture sent to the Argus copilot. Pure rules, no React or three.
import { INTERNAL, producedOf, type LineView, type PreView, type StockItem, type StoreReady, type VOrder } from "./factoryState";

export interface FactoryInput {
  now: number;
  orders: VOrder[];
  lineViews: LineView[];
  receptions: { supplier: string; kg: number; lots: number; products?: Set<string> | string[] }[];
  prereceptions: PreView[];
  ready: StoreReady[];
  stock: StockItem[];
  unassigned: number;
  offices?: { online: number; seniorDocs: number } | null;
}

export interface FactorySummary {
  pieces: number; produced: number; pct: number | null;
  orders: number; ordersDone: number;
  linesTotal: number; linesWorking: number; people: number;
  late: { id: string; name: string; lateMinutes: number }[];
  /** When every line should finish today's work at norm speed (ms), null without norms. */
  dayDoneAt: number | null;
  receptionKg: number; receptionSuppliers: number; receptionLots: number;
  trucksWaiting: number; trucksLate: number; kgWaiting: number;
  stockProducts: number; readyStores: number; readyPieces: number;
  officeOnline: number | null; seniorDocs: number | null;
  /** The line the camera shows in the tour: the most late one, else the busiest working one. */
  showcaseLine: string | null;
}

export function factorySummary(d: FactoryInput): FactorySummary {
  const real = d.orders.filter((o) => !INTERNAL.has(String(o.magazin || "")));
  const pieces = real.reduce((a, o) => a + (Number(o.cantitate) || 0), 0);
  const produced = real.reduce((a, o) => a + producedOf(o), 0);
  const working = d.lineViews.filter((l) => l.status === "lucreaza");
  const late = d.lineViews.filter((l) => l.pace.status === "intarziat")
    .sort((a, b) => b.pace.lateMinutes - a.pace.lateMinutes)
    .map((l) => ({ id: l.id, name: l.name, lateMinutes: Math.round(l.pace.lateMinutes) }));
  const done = d.lineViews.map((l) => l.pace.dayDoneAt).filter((t): t is number => typeof t === "number" && t > d.now);
  const busiest = [...working].sort((a, b) => b.workers - a.workers || b.produced - a.produced)[0];
  return {
    pieces, produced, pct: pieces > 0 ? Math.round((produced / pieces) * 100) : null,
    orders: real.length, ordersDone: real.filter((o) => o.status === "completed").length,
    linesTotal: d.lineViews.length, linesWorking: working.length, people: d.lineViews.reduce((a, l) => a + l.workers, 0),
    late, dayDoneAt: done.length ? Math.max(...done) : null,
    receptionKg: d.receptions.reduce((a, r) => a + r.kg, 0), receptionSuppliers: d.receptions.length,
    receptionLots: d.receptions.reduce((a, r) => a + r.lots, 0),
    trucksWaiting: d.prereceptions.length, trucksLate: d.prereceptions.filter((p) => p.late).length,
    kgWaiting: d.prereceptions.reduce((a, p) => a + p.kgLeft, 0),
    stockProducts: d.stock.length, readyStores: d.ready.length, readyPieces: d.ready.reduce((a, r) => a + r.pieces, 0),
    officeOnline: d.offices?.online ?? null, seniorDocs: d.offices?.seniorDocs ?? null,
    showcaseLine: late[0]?.id ?? busiest?.id ?? null,
  };
}

const n = (v: number) => Math.round(v).toLocaleString("ro-RO");
export const clockRo = (ms: number | null) => (ms == null ? "—" : new Date(ms).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }));

export type TourCamera = { zone: "all" | "productie" | "cantare" | "receptie" | "depozit" | "livrare" | "birouri" } | { line: string };
export interface TourStop { key: string; camera: TourCamera; seconds: number; kicker: string; title: string; facts: string[] }

/** The cinematic tour: wide view, gate, cold store, hall, one real line, dispatch, offices, wide view again. */
export function tourStops(s: FactorySummary, lineName: (id: string) => string | null = () => null): TourStop[] {
  const stops: TourStop[] = [
    { key: "intro", camera: { zone: "all" }, seconds: 9, kicker: "Coral Biogreens · live", title: "Fabrica, în timp real",
      facts: [`${s.linesWorking} din ${s.linesTotal} linii lucrează acum`, `${n(s.people)} oameni pe linii`, s.pct != null ? `${s.pct}% din producția de azi e gata` : "Comenzile de azi încă nu au intrat"] },
    { key: "receptie", camera: { zone: "receptie" }, seconds: 8, kicker: "1 · Intrare", title: "Recepție & camioane",
      facts: [`${n(s.receptionKg)} kg recepționate azi`, `${s.receptionSuppliers} furnizori · ${s.receptionLots} loturi`,
        s.trucksWaiting ? `${s.trucksWaiting} camioane de descărcat${s.trucksLate ? ` · ${s.trucksLate} întârziate` : ""}` : "Niciun camion în așteptare"] },
    { key: "depozit", camera: { zone: "depozit" }, seconds: 7, kicker: "2 · Frig", title: "Depozit materie primă",
      facts: [`${n(s.stockProducts)} produse pe stoc`, "Fiecare palet = stoc real din recepții", "Vechimea frunzelor urmărită pe lot"] },
    { key: "productie", camera: { zone: "productie" }, seconds: 8, kicker: "3 · Producție", title: "Hala de producție",
      facts: [`${n(s.produced)} din ${n(s.pieces)} bucăți făcute`, `${s.ordersDone} din ${s.orders} comenzi gata`,
        s.dayDoneAt ? `Ziua se încheie pe la ${clockRo(s.dayDoneAt)}` : "Ritmul se calculează după normă"] },
  ];
  if (s.showcaseLine) {
    const late = s.late.find((l) => l.id === s.showcaseLine);
    stops.push({ key: "linie", camera: { line: s.showcaseLine }, seconds: 9, kicker: late ? "⚠ Alertă live" : "4 · Pe linie", title: lineName(s.showcaseLine) ?? "Linie de producție",
      facts: late ? [`Peste normă cu ${late.lateMinutes} minute`, "Vedem problema cât se întâmplă, nu deseară", s.late.length > 1 ? `${s.late.length} linii peste normă azi` : "Singura linie peste normă acum"]
        : ["Comenzile, operatorii și ritmul pe normă", "Actualizat la fiecare 30 de secunde", s.late.length ? `${s.late.length} linii peste normă azi` : "Toate liniile sunt în normă"] });
  }
  stops.push(
    { key: "livrare", camera: { zone: "livrare" }, seconds: 8, kicker: "5 · Ieșire", title: "Picking & livrare",
      facts: [`${s.readyStores} magazine cu marfă gata`, `${n(s.readyPieces)} bucăți pregătite`, "Direct spre rafturile retailerilor"] },
    { key: "birouri", camera: { zone: "birouri" }, seconds: 7, kicker: "6 · Management", title: "Birourile, live",
      facts: [s.officeOnline != null ? `${s.officeOnline} colegi lucrează acum` : "Activitatea birourilor", s.seniorDocs != null ? `${n(s.seniorDocs)} documente în Senior azi` : "Documente Senior în timp real", "Totul într-un singur ecran"] },
    { key: "final", camera: { zone: "all" }, seconds: 10, kicker: "Coral Biogreens", title: "O fabrică pe care o vezi întreagă",
      facts: ["Date reale, nu o simulare", "Din telefon, oriunde", "Întreabă-l pe Argus orice despre azi"] },
  );
  return stops;
}

/** What Argus sees: compact, Romanian keys, only today's real figures. */
export function copilotSnapshot(d: FactoryInput, s: FactorySummary) {
  const STATUS: Record<string, string> = { lucreaza: "lucrează", asteapta: "așteaptă", terminat: "gata pe azi", oprita: "oprită" };
  const PACE: Record<string, string> = { in_norma: "în normă", aproape: "aproape de limita normei", intarziat: "peste normă", fara_norma: "fără normă setată", liber: "nicio comandă în lucru" };
  return {
    acum: new Date(d.now).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" }),
    total: {
      bucati_planificate_azi: s.pieces, bucati_facute: s.produced, procent_gata: s.pct, comenzi: s.orders, comenzi_gata: s.ordersDone,
      comenzi_fara_linie: d.unassigned, linii_total: s.linesTotal, linii_care_lucreaza: s.linesWorking, oameni_pe_linii: s.people,
      linii_peste_norma: s.late.length, toate_liniile_termina_azi_pe_la: s.dayDoneAt ? clockRo(s.dayDoneAt) : null,
    },
    linii: d.lineViews.map((l) => ({
      id: l.id, nume: l.name, stare: STATUS[l.status] ?? l.status, oameni: l.workers, operator: l.operator, produs_acum: l.currentProduct,
      comenzi: l.ordersTotal, comenzi_gata: l.ordersDone, bucati_planificate: l.pieces, bucati_facute: l.produced,
      norma_buc_ora: l.norm || null, ritm: PACE[l.pace.status] ?? l.pace.status,
      minute_peste_norma: l.pace.status === "intarziat" ? Math.round(l.pace.lateMinutes) : 0,
      termina_azi_pe_la: l.pace.dayDoneAt ? clockRo(l.pace.dayDoneAt) : null,
      comenzi_neincepute: l.pace.queueOrders,
    })),
    receptii_azi: d.receptions.slice(0, 15).map((r) => ({ furnizor: r.supplier, kg: Math.round(r.kg), loturi: r.lots, produse: [...(r.products ?? [])].slice(0, 5) })),
    camioane_de_descarcat: d.prereceptions.slice(0, 12).map((p) => ({ furnizor: p.supplier, kg_ramase: Math.round(p.kgLeft), intarziat: p.late, anuntat_pe: p.expected, produse: p.products.slice(0, 4) })),
    depozit_materie_prima: { produse_pe_stoc: d.stock.length, cele_mai_mari_stocuri: d.stock.slice(0, 15).map((x) => ({ produs: x.name, cantitate: Math.round(x.qty), um: x.unit })) },
    gata_de_livrare: { magazine: d.ready.length, bucati: s.readyPieces, top: d.ready.slice(0, 15).map((r) => ({ magazin: r.store, bucati: Math.round(r.pieces), comenzi: r.orders })) },
    birouri: d.offices ? { lucreaza_acum: d.offices.online, documente_senior_azi: d.offices.seniorDocs } : null,
  };
}
