// Live Senior reads for the price calculator and client price lists. Every rate is derived from Senior data and returned with its source.
import { priceDates, suggestedLabour } from "./priceDefaults.ts";
import { readPriceSafety } from './receiptPriceSafety.ts';
import { MIXED_WASHED, type PriceConfig } from "./priceConfig.ts";
import { priceLogistics } from "./priceLogistics.ts";
import { transportRoute, historicalFeePct, configuredRawPalletKg, orderedPallets, tradedGood, buildRoutes, deliveryRoute, pointRoute, unassignedByCounty, validRouteOverrides, LEGACY_ROUTES } from "./priceSourceRules.ts";
import { CLIENT_AVERAGE_ROUTE, DEFAULT_MARGIN_PCT, LOAD_DAYS, clientAverageRoute, latestCostWindow, latestRoutes } from "./priceList.ts";
import { seniorLive } from "./senior.ts";
import { cf, lit, partnerInfoSql, partnerScope, type PartnerInfo } from "./priceScope.ts";
import { realLineSpeeds, SPEED_DAYS, type RealSpeed } from "./priceLineSpeed.ts";
export { matchLoss } from "./priceSheet.ts";
import { componentKind, isServiceComponent, matchLoss, ratePeriod, type SheetComponent } from "./priceSheet.ts";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => any };
const SQL = (sb: Rpc, sql: string) => seniorLive(sb, "sql", { sql }, 55000).then((r: any) => (Array.isArray(r) ? r : []));
const int = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 2 ** 31 ? n : null; };
const num = (v: unknown) => Number(v) || 0;
const n0 = (v: number | null | undefined) => (v == null ? "?" : Math.round(v).toLocaleString("ro-RO"));
const SALES = "('FC','FCE','FCEC')";
const docs = `dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID`;
const notCancelled = "ISNULL(h.Anulat,0)=0";
const PP1 = "JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID AND pp.TipPartener=1";
const MAX_PRODUCTS = 60;
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Raw-material supplier orders (Coral Achiziții) delivered in [start, end), not cancelled, converted to pallets by product range. */
async function readOrderedPallets(legacy: any, start: string, end: string) {
  const orders: any[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await legacy.from("product_orders").select("product_id,supplier_id,quantity_ordered,expected_delivery_date,status")
      .gte("expected_delivery_date", start).lt("expected_delivery_date", end).neq("status", "cancelled").order("id").range(off, off + 999);
    if (error) throw new Error(`Nu pot citi comenzile către furnizori: ${error.message}`);
    orders.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const ids = [...new Set(orders.map((o) => o.product_id).filter(Boolean))];
  const prod = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await legacy.from("products").select("id,name,default_unit").in("id", ids.slice(i, i + 50));
    if (error) throw new Error(`Nu pot citi produsele comandate: ${error.message}`);
    for (const p of data ?? []) prod.set(p.id, p);
  }
  const sup = new Map<string, string>();
  const sids = [...new Set(orders.map((o) => o.supplier_id).filter(Boolean))];
  for (let i = 0; i < sids.length; i += 50) {
    const { data } = await legacy.from("suppliers").select("id,name").in("id", sids.slice(i, i + 50));
    for (const s of data ?? []) sup.set(s.id, s.name);
  }
  return orderedPallets(orders.map((o) => ({
    name: prod.get(o.product_id)?.name ?? "Produs necunoscut", unit: prod.get(o.product_id)?.default_unit, qty: Number(o.quantity_ordered) || 0,
    supplier: o.supplier_id ? sup.get(o.supplier_id) ?? o.supplier_id : null, day: o.expected_delivery_date,
  })));
}

/** Fiscal code and central name of a partner, read once. Inlining these lookups as correlated subqueries made SQL Server
 * re-run them per sales line and exceed the 25 s Senior read limit for large chains (e.g. BAMIS). */
async function partnerInfo(sb: Rpc, pid: number | null): Promise<PartnerInfo> {
  if (!pid) return null;
  const [r] = await SQL(sb, partnerInfoSql(pid));
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return { cf: clean(r?.cf), central: clean(r?.central) };
}
const CLIENT_NAME = "LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(pp.Partener_Central)),''), pp.Partener_Denumire)))";

export async function priceOptions(sb: Rpc, body: { partnerId?: unknown; allProducts?: unknown }) {
  const pid = int(body.partnerId);
  const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const scope = partnerScope(pid, null, await partnerInfo(sb, pid));
  // Central partners: every store of a retail chain is grouped under its Senior Partener_Central.
  const clientsQ = SQL(sb, `SELECT TOP 600 COALESCE(MIN(CASE WHEN LTRIM(RTRIM(pp.Partener_Denumire))=LTRIM(RTRIM(pp.Partener_Central)) THEN pp.Partener_ID END), MIN(pp.Partener_ID)) id,
      MIN(${CLIENT_NAME}) name, COUNT(DISTINCT pp.Partener_ID) stores
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID ${PP1}
      WHERE t.Cod IN ${SALES} AND ${notCancelled} AND h.Data>='${since}' GROUP BY COALESCE(${cf("pp")}, ${CLIENT_NAME}) ORDER BY SUM(CAST(h.Valoare_Rol AS float)) DESC`);
  const filtered = scope && body.allProducts !== true;
  const productsQ = SQL(sb, `SELECT TOP 800 d.Articol_ID id, MAX(d.Denumire) name, SUM(CAST(d.Cantitate AS float)) qty FROM ${docs}
      ${filtered ? PP1 : ""}
      WHERE t.Cod IN ${SALES} AND ${notCancelled} AND h.Data>='${since}' ${filtered ? `AND ${scope}` : ""}
      AND EXISTS (SELECT 1 FROM dbo.DArticoleCompuseHVersiuni v WITH (NOLOCK) WHERE v.ArticolId=d.Articol_ID AND v.IsActiv=1)
      GROUP BY d.Articol_ID ORDER BY MAX(d.Denumire)`);
  // Delivery points (stores) of the central partner; each one proposes its Senior cursă.
  const storesQ = scope ? SQL(sb, `SELECT TOP 300 pp.Partener_ID id, MAX(pp.Partener_Denumire) name, MAX(pp.Document_Judet) judet, MAX(pp.Document_Tara) country
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID ${PP1}
      WHERE t.Cod IN ${SALES} AND ${notCancelled} AND h.Data>='${since}' AND ${scope}
      GROUP BY pp.Partener_ID ORDER BY MAX(pp.Partener_Denumire)`) : Promise.resolve([]);
  const [clients, products, stores] = await Promise.all([clientsQ, productsQ, storesQ]);
  return {
    stores: stores.map((r: any) => ({ id: r.id, name: String(r.name).trim(), route: pointRoute({ pid: r.id, ...r }, validRouteOverrides((body as any).routeOverrides)).route })),
    clients: clients.map((r: any) => ({ id: r.id, name: String(r.name).trim(), stores: num(r.stores) })),
    products: products.map((r: any) => ({ id: r.id, name: String(r.name).trim(), qty: num(r.qty) })),
  };
}

/** Find Senior articles / partners by name (Argus). */
export async function findArticles(sb: Rpc, name: string) {
  const q = name.replace(/['%_\[\]]/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!q.length) return [];
  const like = q.map((w) => `a.Denumire LIKE N'%${w}%'`).join(" AND ");
  return SQL(sb, `SELECT TOP 10 a.Articol_ID id, a.Denumire name FROM dbo.D_Articole a WITH (NOLOCK) WHERE ${like}
    AND EXISTS (SELECT 1 FROM dbo.DArticoleCompuseHVersiuni v WITH (NOLOCK) WHERE v.ArticolId=a.Articol_ID AND v.IsActiv=1) ORDER BY a.Denumire`);
}
export async function findPartners(sb: Rpc, name: string) {
  const q = name.replace(/['%_\[\]]/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!q.length) return [];
  const like = q.map((w) => `p.Denumire LIKE N'%${w}%'`).join(" AND ");
  return SQL(sb, `SELECT TOP 10 p.Partener_ID id, p.Denumire name FROM dbo.D_Parteneri p WITH (NOLOCK) WHERE p.IsClient=1 AND ${like} ORDER BY p.Denumire`);
}

type Body = { articolId?: unknown; articolIds?: unknown; partnerId?: unknown; storeId?: unknown; year?: unknown; month?: unknown; rawPriceMode?: unknown; routeOverrides?: unknown };
type Loss = Array<{ name: string; pt_percent: number | null }>;

/** Price list for several finished products of one client (central partner or one store), sharing every common Senior read. */
export async function priceListData(sb: Rpc, legacy: any, body: Body) {
  const raw = Array.isArray(body.articolIds) ? body.articolIds : [body.articolId];
  const aids = [...new Set(raw.map(int).filter(Boolean))] as number[];
  if (!aids.length) throw new Error("Alege cel puțin un produs finit.");
  if (aids.length > MAX_PRODUCTS) throw new Error(`Maximum ${MAX_PRODUCTS} produse într-o listă de prețuri.`);
  const pid = int(body.partnerId), storeId = int(body.storeId);
  const year = Number(body.year), month = Number(body.month);
  if (!(year > 2015 && year < 2100 && month >= 1 && month <= 12)) throw new Error("Lună invalidă.");
  const rawMode = body.rawPriceMode === "week" ? "week" : "annual";
  const overrides = validRouteOverrides(body.routeOverrides);
  const P = ratePeriod(year, month);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
  const pricesPeriod = priceDates(year, month, today);
  const weekStart = pricesPeriod.weekStart;
  const win = latestCostWindow(pricesPeriod.endDay);
  const load = latestCostWindow(pricesPeriod.endDay, LOAD_DAYS);
  const partner = await partnerInfo(sb, pid);
  const scope = partnerScope(pid, storeId, partner);
  const histStart = new Date(Date.UTC(year, month - 13, 1)).toISOString().slice(0, 10);
  const histEnd = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const recentStart = addDays(pricesPeriod.endDay, -90);
  const A = aids.join(",");
  const readLoss = async (table: string) => {
    const all: Loss = [];
    let offset = 0;
    while (true) {
      const { data, error } = await legacy.from(table).select("name,pt_percent").order("id").range(offset, offset + 499);
      if (error) throw new Error(`Nu pot citi pierderile tehnologice din ${table}: ${error.message}`);
      all.push(...(data ?? []));
      if (!data || data.length < 500) break;
      offset += 500;
    }
    return all;
  };
  const supplyIn = `h.H_ID IN (SELECT dc.H_ID FROM dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK) JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID=dc.AnaliticId WHERE p.Cont='624.01' AND dc.LunaContabila BETWEEN '${load.bookFrom}' AND '${load.bookTo}')`;
  const supplyLine = "(d.Denumire LIKE 'TRANSPORT%' OR d.Denumire LIKE 'SERVICII TRANSPORT%') AND d.Denumire NOT LIKE 'TRANSPORT DIST%'";

  const warnings: string[] = [];
  /** Sources and methods: shown to the user, not problems to fix. */
  const info: string[] = [];
  let logisticsRead: Awaited<ReturnType<typeof priceLogistics>> | null = null;
  const [art, recipe, history, recent, eur, priceList, clientAdjustments, clientServices, supply, lastTrucks, receivedPallets, receivedKg, storeRows, loss, packagingLoss, labelLoss] = await Promise.all([
    SQL(sb, `SELECT a.Articol_ID id, a.Denumire name, a.Cod code FROM dbo.D_Articole a WITH (NOLOCK) WHERE a.Articol_ID IN (${A})`),
    SQL(sb, `SELECT v.ArticolId pa, v.PKArticoleCompuseHVersiuni vid, CAST(v.Cantitate AS float) vq, v.IsImplicit impl, v.DataStart ds, d.ArticolId id, a.Denumire name, CAST(d.Cantitate AS float) q, um.Cod um
      FROM dbo.DArticoleCompuseHVersiuni v WITH (NOLOCK) JOIN dbo.DArticoleCompuseD d WITH (NOLOCK) ON d.FKArticoleCompuseHVersiuni=v.PKArticoleCompuseHVersiuni
      JOIN dbo.D_Articole a WITH (NOLOCK) ON a.Articol_ID=d.ArticolId LEFT JOIN dbo.D_Articole_UM um WITH (NOLOCK) ON um.UM_ID=d.UMId
      WHERE v.ArticolId IN (${A}) AND v.IsActiv=1 AND d.ArticolId<>v.ArticolId AND ISNULL(d.IsProdusPrincipal,0)=0`),
    SQL(sb, `SELECT d.Articol_ID aid, CONVERT(char(7), h.Data, 120) m, SUM(CAST(d.Cantitate AS float)) q, SUM(CAST(d.Valoare_Neta_Rol AS float)) v FROM ${docs}
      ${scope ? PP1 : ""}
      WHERE t.Cod IN ${SALES} AND ${notCancelled} AND d.Articol_ID IN (${A}) ${scope ? `AND ${scope}` : ""} AND h.Data>='${histStart}' AND h.Data<'${histEnd}'
      GROUP BY d.Articol_ID, CONVERT(char(7), h.Data, 120) ORDER BY m`),
    // Current selling price per store: last 90 days of invoices.
    scope ? SQL(sb, `SELECT d.Articol_ID aid, pp.Partener_ID pid, SUM(CAST(d.Cantitate AS float)) q, SUM(CAST(d.Valoare_Neta_Rol AS float)) v FROM ${docs} ${PP1}
      WHERE t.Cod IN ${SALES} AND ${notCancelled} AND d.Articol_ID IN (${A}) AND ${scope} AND h.Data>='${recentStart}' AND h.Data<'${pricesPeriod.endDay}'
      GROUP BY d.Articol_ID, pp.Partener_ID`) : Promise.resolve([]),
    SQL(sb, `SELECT TOP 1 c.Data day, CAST(c.Curs AS float) rate FROM dbo.D_Valuta_Cursuri c WITH (NOLOCK) JOIN dbo.D_Valuta v WITH (NOLOCK) ON v.Valuta_ID=c.Valuta_ID
      JOIN dbo.D_Valuta_Cursuri_Tipuri tt WITH (NOLOCK) ON tt.Valuta_Cursuri_Tipuri_ID=c.Valuta_Cursuri_Tipuri_ID
      WHERE v.Simbol='EUR' AND tt.Descriere='BNR' AND c.Data<'${pricesPeriod.endDay}' ORDER BY c.Data DESC`),
    pid ? SQL(sb, `SELECT aid, price, cur, list, ds FROM (SELECT ld.Articol_ID aid, CAST(ld.Pret AS float) price, v.Simbol cur, lh.Descriere list, lh.Data_Start ds,
        ROW_NUMBER() OVER(PARTITION BY ld.Articol_ID ORDER BY CASE WHEN pl.Partener_ID=${storeId ?? pid} THEN 0 ELSE 1 END, lh.Data_Start DESC) rn
      FROM dbo.D_Liste_Preturi_D ld WITH (NOLOCK) JOIN dbo.D_Liste_Preturi_H lh WITH (NOLOCK) ON lh.D_Liste_Preturi_H_ID=ld.D_Liste_Preturi_H_ID
      JOIN dbo.D_Parteneri_Liste_Preturi pl WITH (NOLOCK) ON pl.D_Liste_Preturi_H_ID=lh.D_Liste_Preturi_H_ID LEFT JOIN dbo.D_Valuta v WITH (NOLOCK) ON v.Valuta_ID=ld.Valuta_ID
      WHERE pl.Partener_ID IN (${[...new Set([storeId, pid].filter(Boolean))].join(",")}) AND ld.Articol_ID IN (${A}) AND ld.Pret>0 AND lh.Data_Start<'${histEnd}' AND (lh.Data_End IS NULL OR lh.Data_End>='${histEnd}')) x WHERE rn=1`) : Promise.resolve([]),
    pid ? SQL(sb, `SELECT SUM(CASE WHEN d.Denumire LIKE '%DISCOUNT%' OR d.Denumire LIKE '%Reducere de pret%' THEN -CAST(d.Valoare_Neta_Rol AS float) ELSE 0 END) discounts,
      SUM(CASE WHEN d.Denumire NOT LIKE '%DISCOUNT%' AND d.Denumire NOT LIKE '%Reducere de pret%' THEN CAST(d.Valoare_Neta_Rol AS float) ELSE 0 END) sales
      FROM ${docs} WHERE t.Cod IN ${SALES} AND ${notCancelled} AND h.Data>='${P.startDay}' AND h.Data<'${P.endDay}'
      AND EXISTS(SELECT 1 FROM dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) WHERE pp.H_ID=h.H_ID AND pp.TipPartener=1
        AND NULLIF(REPLACE(UPPER(pp.Partener_Cod_Fiscal),'RO',''),'') IN (SELECT DISTINCT REPLACE(UPPER(p.Partener_Cod_Fiscal),'RO','') FROM dbo.C_H_Note_Contabile_Parteneri p WITH (NOLOCK) WHERE p.Partener_ID=${pid} AND NULLIF(p.Partener_Cod_Fiscal,'') IS NOT NULL))`) : Promise.resolve([]),
    // Fees the client invoices to us (logistics, destruction, audit, advertising): supplier invoices of the same CUI booked on 628 / 6232.
    pid && partner?.cf ? SQL(sb, `SELECT TOP 30 LTRIM(RTRIM(dc.SubiectDenumire)) subject, p.Cont cont, SUM(CAST(dc.Valoare_Rol AS float)) total
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
      JOIN dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK) ON dc.H_ID=h.H_ID JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID=dc.AnaliticId
      WHERE t.Cod='FF' AND ${notCancelled} AND h.Data>='${P.startDay}' AND h.Data<'${P.endDay}' AND dc.IsDebit=1 AND (p.Cont LIKE '628%' OR p.Cont LIKE '6232%')
      AND EXISTS(SELECT 1 FROM dbo.C_H_Note_Contabile_Parteneri x WITH (NOLOCK) WHERE x.H_ID=h.H_ID AND x.TipPartener=2 AND ${cf("x")}=${lit(partner.cf)})
      GROUP BY LTRIM(RTRIM(dc.SubiectDenumire)), p.Cont ORDER BY SUM(CAST(dc.Valoare_Rol AS float)) DESC`) : Promise.resolve([]),
    // Supply transport: latest carrier invoices (invoice date in the window) posted on 624.01, distribution lines excluded.
    SQL(sb, `SELECT SUM(CASE WHEN h.Data>='${win.start}' THEN CAST(d.Valoare_Neta_Rol AS float) ELSE 0 END) total,
        SUM(CASE WHEN h.Data>='${win.start}' AND d.Cantitate>0 AND d.Denumire LIKE 'TRANSPORT%' THEN 1 ELSE 0 END) trucks,
        SUM(CASE WHEN d.Cantitate>0 AND d.Denumire LIKE 'TRANSPORT%' THEN 1 ELSE 0 END) loadTrucks
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
      WHERE ${notCancelled} AND h.Data>='${load.start}' AND h.Data<'${win.end}' AND ${supplyLine} AND ${supplyIn}`),
    SQL(sb, `SELECT TOP 300 CONVERT(char(10), h.Data, 120) day, CAST(d.Pret_Final_ROL AS float) price, UPPER(LTRIM(RTRIM(d.Denumire))) line,
        CAST(d.Cantitate AS float) qty, CAST(d.Valoare_Neta_Rol AS float) value,
        (SELECT TOP 1 x.Partener_Denumire FROM dbo.C_H_Note_Contabile_Parteneri x WITH (NOLOCK) WHERE x.H_ID=h.H_ID) supplier,
        CASE WHEN d.Cantitate>0 AND d.Denumire LIKE 'TRANSPORT%' THEN 1 ELSE 0 END truck
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
      WHERE ${notCancelled} AND h.Data>='${win.start}' AND h.Data<'${win.end}' AND ${supplyLine} AND ${supplyIn}
      ORDER BY h.Data DESC, h.H_ID DESC`),
    readOrderedPallets(legacy, load.start, load.end),
    Promise.resolve(null),
    pid ? SQL(sb, `SELECT TOP 300 pp.Partener_ID id, MAX(pp.Partener_Denumire) name, MAX(pp.Document_Judet) judet, MAX(pp.Document_Tara) country
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID ${PP1}
      WHERE t.Cod IN ${SALES} AND ${notCancelled} AND h.Data>='${addDays(pricesPeriod.endDay, -365)}' AND ${partnerScope(pid, null, partner)}
      GROUP BY pp.Partener_ID ORDER BY MAX(pp.Partener_Denumire)`) : Promise.resolve([]),
    readLoss("products"), readLoss("ambalaje_products"), readLoss("etichete_products"),
    priceLogistics(sb, aids, win, load).then((r) => { logisticsRead = r; }).catch((e) => { warnings.push(`Citire logistică: ${(e as Error).message}`); }),
  ]);

  // Component prices and packaging safety, for every component of every selected recipe at once.
  const recipesByProduct = new Map<number, any[]>();
  for (const r of recipe) recipesByProduct.set(Number(r.pa), [...(recipesByProduct.get(Number(r.pa)) ?? []), r]);
  const picked = new Map<number, any[]>();
  for (const [aid, rows] of recipesByProduct) {
    const versions = new Map<number, any[]>();
    for (const r of rows) versions.set(r.vid, [...(versions.get(r.vid) ?? []), r]);
    // Default active version, else the most recent.
    picked.set(aid, [...versions.values()].sort((a, b) => (Number(!!b[0].impl) - Number(!!a[0].impl)) || String(b[0].ds).localeCompare(String(a[0].ds)))[0]);
  }
  const compRows = [...picked.values()].flat().filter((r) => !isServiceComponent(String(r.name)));
  const ids = [...new Set(compRows.map((r) => int(r.id)).filter(Boolean))] as number[];
  const packagingIds = [...new Set(compRows.filter((r) => componentKind(String(r.name), String(r.um ?? "BUC")) === "ambalaj").map((r) => Number(r.id)))];
  let safety = new Map<number, import('./priceSafetyRules.ts').PriceSafety>();
  const [priceRows] = await Promise.all([
    ids.length ? SQL(sb, `SELECT L.id,
      SUM(CASE WHEN L.day>='${pricesPeriod.startDay}' THEN L.v ELSE 0 END) v12,
      SUM(CASE WHEN L.day>='${pricesPeriod.startDay}' THEN L.q ELSE 0 END) q12,
      SUM(CASE WHEN L.day>='${weekStart}' THEN L.v ELSE 0 END) vw,
      SUM(CASE WHEN L.day>='${weekStart}' THEN L.q ELSE 0 END) qw,
      MAX(CASE WHEN L.rn=1 THEN L.v/NULLIF(L.q,0) END) lastp,
      MAX(L.day) lastd FROM (
        SELECT d.Articol_ID id, h.Data day, CAST(d.Valoare_Neta_Rol AS float) v, CAST(d.Cantitate AS float) q,
          ROW_NUMBER() OVER(PARTITION BY d.Articol_ID ORDER BY h.Data DESC,h.H_ID DESC,d.D_ID DESC) rn
        FROM ${docs} WHERE t.Cod='NIR' AND ${notCancelled} AND d.Articol_ID IN (${ids.join(",")}) AND d.Cantitate>0
          AND h.Data<'${pricesPeriod.endDay}' AND h.Data>=DATEADD(year,-3,'${pricesPeriod.endDay}')) L GROUP BY L.id`) : Promise.resolve([]),
    readPriceSafety(sb, packagingIds, pricesPeriod.endDay).then((m) => { safety = m; })
      .catch((e) => { warnings.push(`Verificarea prețurilor suspecte nu este disponibilă: ${(e as Error).message}`); }),
  ]);
  const prices = new Map(priceRows.map((r: any) => [Number(r.id), r]));

  // ---- Shared defaults: latest supply transport, distribution per cursă, client average, fees, EUR, margin.
  const rawMaterialLabel = rawMode === "week" ? `medie NIR ${weekStart} – ${pricesPeriod.endDay} (exclusiv)` : `medie NIR ${pricesPeriod.startDay} – ${pricesPeriod.endDay} (exclusiv)`;
  const shared: PriceConfig = { route: "România", supplyBasis: "pallet", rawPriceMode: rawMode, rates: { marginPct: DEFAULT_MARGIN_PCT, eurRate: eur[0] ? num(eur[0].rate) : 0, eurBufferPct: 1.5, techLossPct: 0 } };
  if (!pid) shared.feePct = 0;
  // Client fees = discounts on our invoices + services the client invoices to us (628/6232), over 12 months, ÷ net sales to the same CUI.
  const discounts = Math.max(num(clientAdjustments[0]?.discounts), 0), sales = num(clientAdjustments[0]?.sales);
  const services = clientServices.map((r: any) => ({ subject: String(r.subject ?? "").trim() || String(r.cont), account: String(r.cont), total: num(r.total) })).filter((r: { total: number }) => r.total > 0);
  const servicesTotal = services.reduce((t: number, r: { total: number }) => t + r.total, 0);
  const feePct = historicalFeePct(discounts + servicesTotal, sales);
  const fees = pid ? { pct: feePct, discounts, services, servicesTotal, sales, from: P.startDay, to: P.endDay } : null;
  if (pid && feePct != null) {
    shared.feePct = feePct;
    info.push(`Taxe client ${feePct.toFixed(2)}%: reduceri pe facturile noastre ${discounts.toFixed(2)} lei + servicii facturate de client ${servicesTotal.toFixed(2)} lei${services.length ? ` (${services.slice(0, 4).map((r: { subject: string; total: number }) => `${r.subject} ${r.total.toFixed(0)}`).join(", ")})` : ""} ÷ vânzări ${sales.toFixed(2)} lei, ${P.startDay} – ${P.endDay} (exclusiv), pe codul fiscal. Istoric, nu tarif contractual.`);
  } else if (pid) warnings.push("Taxe client: nicio vânzare către acest cod fiscal în ultimele 12 luni; completează procentul manual.");
  // Latest prices: average cost per truck of the last 30 days (services included) ÷ average load per truck of the last 90 days.
  const total30 = num(supply[0]?.total), trucks30 = num(supply[0]?.trucks), loadTrucks = num(supply[0]?.loadTrucks);
  void receivedKg;
  const ordered = receivedPallets as Awaited<ReturnType<typeof readOrderedPallets>>;
  const pallets90 = ordered.pallets, kg90 = ordered.kg;
  if (ordered.skipped.length) warnings.push(`Aprovizionare: ${ordered.skipped.length} produse comandate fără normă kg/palet (ex. ${ordered.skipped.slice(0, 4).map((r) => r.name).join(", ")}) nu intră în paleți; spune-mi gama lor ca să le adaug.`);
  const costPerTruck = trucks30 > 0 && total30 > 0 ? total30 / trucks30 : null;
  // Load per truck from the orders themselves: all pallets of one delivery day share full trucks of TRUCK_PALLETS, so pallets and trucks share one source.
  const orderTrucks = ordered.trucks;
  const palletsPerTruck = orderTrucks > 0 && pallets90 > 0 ? pallets90 / orderTrucks : null;
  const kgPerTruck = orderTrucks > 0 && kg90 > 0 ? kg90 / orderTrucks : null;
  if (palletsPerTruck != null && palletsPerTruck < 5) warnings.push(`Aprovizionare: doar ${palletsPerTruck.toFixed(1)} paleți/camion din comenzi — verifică dacă toate comenzile au furnizor, dată de livrare și cantitate în kg.`);
  /** Raw materials outside the configured categories: average kg per received pallet (NIR kg ÷ NIR pallets). */
  const avgKgPerPallet = kg90 > 0 && ordered.kgPallets > 0 ? kg90 / ordered.kgPallets : null;
  if (costPerTruck != null) shared.supplyTotal = costPerTruck;
  if (palletsPerTruck != null) { shared.supplyPallets = palletsPerTruck; if (costPerTruck != null) shared.supplyPerPallet = costPerTruck / palletsPerTruck; }
  if (kgPerTruck != null) { shared.supplyKg = kgPerTruck; if (costPerTruck != null) shared.rates = { ...shared.rates, supplyPerKg: costPerTruck / kgPerTruck }; }
  if (costPerTruck == null) warnings.push(`Aprovizionare: nicio factură de transport aprovizionare (624.01) datată ${win.start} – ${win.end}; completează tariful manual.`);
  info.push(`Aprovizionare: cost mediu pe camion din facturile ${win.start} – ${win.end} ÷ încărcarea medie pe camion (paleți = kg comandate în Achiziții ÷ kg/palet pe gamă: frunze/aromate 220, căpățâni 400, radicchio 500; camioane = paleții fiecărei zile de livrare (toți furnizorii) ÷ 26 paleți/camion plin, rotunjit în sus) din ${load.start} – ${load.end}; facturile nu sunt legate individual de NIR-uri. Capacitățile MP sunt reperele configurate Coral.`);

  const read = logisticsRead as Awaited<ReturnType<typeof priceLogistics>> | null;
  const distribution: Record<string, PriceConfig> = {};
  const loadData = buildRoutes(read?.points ?? [], read?.loadTrips ?? [], overrides);
  const routeData = { ...loadData, routes: latestRoutes(buildRoutes(read?.points ?? [], read?.trips ?? [], overrides).routes, loadData.routes) };
  for (const r of routeData.routes) {
    // Latest trip cost × trips in the last 30 days, loaded with the 90-day pallets per trip.
    distribution[r.route] = { distributionTotal: r.total, distributionTrips: r.trips, ...(r.palletsPerTrip ? { distributionPallets: r.trips * r.palletsPerTrip, distributionPerPallet: r.perPallet ?? undefined, distributionPalletsPerTrip: r.palletsPerTrip } : {}) };
    if (!r.recent) info.push(`Cursa ${r.route}: nicio cursă facturată în ultimele 30 de zile; costul pe cursă este media ${load.start} – ${load.end}.`);
    if (r.missingLines > 0) info.push(`Cursa ${r.route}: ${r.missingLines} linii de factură fără bucăți/palet în Senior (produse HORECA/vrac) nu sunt numărate în cei ${r.pallets.toFixed(1)} paleți; tariful pe palet poate fi ușor supraevaluat.`);
    if (r.unitPrice != null) info.push(`Cursa ${r.route}: transportatorul facturează ${r.unitPrice.toFixed(2)} lei × ${Math.round(r.qty)} unități (facturare lunară, nu pe cursă); tariful pe palet = costul ÷ paleții punctelor atribuite cursei.`);
    if (r.pallets <= 0) warnings.push(`Cursa ${r.route}: ${r.total.toFixed(0)} lei facturați, dar niciun punct de livrare atribuit — alege cursa pentru punctele ei în „Puncte de livrare fără cursă”.`);
  }
  // Country averages kept for previously saved sheets: only cursă with known pallets.
  for (const country of LEGACY_ROUTES) {
    const rs = routeData.routes.filter((r) => r.country === country && r.pallets > 0);
    const total = rs.reduce((s, r) => s + r.total, 0), pallets = rs.reduce((s, r) => s + r.trips * (r.palletsPerTrip ?? 0), 0), trips = rs.reduce((s, r) => s + r.trips, 0);
    if (pallets > 0) distribution[country] = { distributionTotal: total, distributionPallets: pallets, distributionPerPallet: total / pallets, distributionTrips: trips, distributionPalletsPerTrip: pallets / trips };
  }
  const unassigned = unassignedByCounty(routeData.unassigned);
  const unassignedPallets = unassigned.reduce((s, p) => s + p.pallets, 0);
  if (unassignedPallets > 0) warnings.push(`${unassignedPallets.toFixed(1)} paleți (${LOAD_DAYS} zile) livrați în ${unassigned.length} județe fără cursă identificată (${unassigned.slice(0, 5).map((g) => `${g.judet} ${g.pallets.toFixed(1)}`).join(", ")}). Senior nu leagă livrările de curse; alege cursa pe județ în „Puncte de livrare fără cursă”, altfel tarifele curselor lor sunt supraevaluate.`);
  const unknownCosts = read?.costs.filter((r: any) => !transportRoute(String(r.subject)) && num(r.total) !== 0) ?? [];
  if (unknownCosts.length) info.push(`Alte costuri de transport din fereastră, neincluse în tarifele pe cursă: ${unknownCosts.map((r: any) => `${String(r.subject).trim()} (${r.cont}) ${num(r.total).toFixed(2)} lei`).join("; ")}.`);

  // Stores of the central partner with their cursă and pallets delivered in the window.
  const pointBy = new Map(routeData.points.map((p) => [p.pid, p]));
  const stores = storeRows.map((r: any) => {
    const id = Number(r.id), p = pointBy.get(id), pr = pointRoute({ pid: id, ...r }, overrides);
    return { pid: id, name: String(r.name ?? "").trim(), judet: String(r.judet ?? "").trim(), route: p?.route ?? pr.route, manual: p?.manual ?? pr.manual, proposed: deliveryRoute(r), pallets: p?.pallets ?? 0 };
  });
  const perPallet = Object.fromEntries(Object.entries(distribution).map(([k, v]) => [k, v.distributionPerPallet ?? null]));
  const avg = pid && !storeId ? clientAverageRoute(stores, perPallet) : null;
  if (avg) {
    distribution[CLIENT_AVERAGE_ROUTE] = avg.weighted ? { distributionTotal: avg.allocated!, distributionPallets: avg.pallets, distributionPerPallet: avg.perPallet } : { distributionPerPallet: avg.perPallet };
    info.push(`Distribuție medie client: ${avg.weighted ? `ponderată cu ${avg.pallets.toFixed(1)} paleți livrați în ultimele ${LOAD_DAYS} de zile` : `medie simplă (fără livrări în ultimele ${LOAD_DAYS} de zile)`} pe ${avg.stores} magazine.`);
    if (avg.missing.length) warnings.push(`Magazine fără cursă/tarif, excluse din media clientului: ${avg.missing.slice(0, 6).join(", ")}${avg.missing.length > 6 ? ` +${avg.missing.length - 6}` : ""}; alege cursa în tabelul de rentabilitate pe magazine.`);
  }
  let point: { pid: number; name: string; route: string | null } | null = storeId ? routeData.points.find((p) => p.pid === storeId) ?? null : null;
  if (!point && storeId) {
    const r = await SQL(sb, `SELECT TOP 1 Partener_Denumire name, Document_Judet judet, Document_Tara country FROM dbo.C_H_Note_Contabile_Parteneri WITH (NOLOCK) WHERE Partener_ID=${storeId} AND TipPartener=1 ORDER BY H_ID DESC`);
    if (r[0]) point = { pid: storeId, name: String(r[0].name ?? "").trim(), route: pointRoute({ pid: storeId, ...r[0] }, overrides).route };
  }
  const suggestedRoute = point?.route && distribution[point.route] ? point.route : avg ? CLIENT_AVERAGE_ROUTE : null;
  shared.route = suggestedRoute ?? "România";
  if (point && !(point.route && distribution[point.route])) warnings.push(`Nu am putut propune cursa pentru ${point.name}; alege cursa manual (implicit media curselor interne).`);
  Object.assign(shared, distribution[shared.route] ?? {});

  // ---- Per product.
  const artBy = new Map(art.map((a: any) => [Number(a.id), a]));
  // Washed mixes have no numeric speed in the labour CSV: use the real speed recorded in Producție.
  const mixed = aids.filter((aid) => {
    const a = artBy.get(aid), rows = picked.get(aid);
    if (!a || !rows) return false;
    const lite = rows.filter((r) => !isServiceComponent(String(r.name))).map((r) => ({ id: Number(r.id), name: String(r.name), qty: num(r.q), unit: String(r.um ?? "BUC"), kind: componentKind(String(r.name), String(r.um ?? "BUC")), price: null, priceSource: "", lossPct: 0 }));
    return suggestedLabour(String(a.name), lite) === MIXED_WASHED;
  });
  let speeds = new Map<number, RealSpeed>();
  if (mixed.length) {
    try { speeds = await realLineSpeeds(legacy, mixed.map((id) => ({ id, name: String(artBy.get(id)?.name ?? "") })), pricesPeriod.endDay); }
    catch (e) { warnings.push(`Viteza reală din Producție nu a putut fi citită: ${(e as Error).message}`); }
  }
  const convBy = new Map<number, number>();
  for (const r of read?.conversion ?? []) if (num(r.coef) > 0) convBy.set(Number(r.id), num(r.coef));
  const items = aids.map((aid) => {
    const a = artBy.get(aid);
    if (!a) return { product: { id: aid, name: `Articol ${aid}` }, error: "Produsul nu există în Senior." };
    const name = String(a.name).trim();
    const pick = picked.get(aid);
    if (!pick?.length) return { product: { id: aid, name }, error: "Produsul nu are rețetă activă în Senior." };
    const unitsPerCase = num(pick[0].vq) || 1;
    const itemWarnings: string[] = [];
    const components: SheetComponent[] = pick.filter((r) => !isServiceComponent(String(r.name))).map((r): SheetComponent => {
      const cname = String(r.name).trim(), unit = String(r.um ?? "").trim() || "BUC";
      const p = prices.get(Number(r.id));
      const annual = p && num(p.q12) > 0 ? num(p.v12) / num(p.q12) : null;
      const kind = componentKind(cname, unit);
      const week = p && num(p.qw) > 0 ? num(p.vw) / num(p.qw) : null;
      const last = p?.lastp != null ? num(p.lastp) : null;
      if (kind === "marfa") {
        // Semi-finished good bought ready-packed and resold as is: NIR price like a raw material, no technological loss, pallets in pieces.
        const g = tradedGood(cname);
        return {
          id: Number(r.id), name: cname, qty: num(r.q), unit, kind,
          price: rawMode === "week" ? week : annual, annualPrice: annual, weekPrice: week, lastPrice: last,
          priceSource: rawMaterialLabel, lossPct: 0, lossSource: "marfă revândută ca atare — fără PT (editabil)",
          ...(g ? { piecesPerPallet: g.piecesPerPallet, palletSource: g.note } : {}),
        };
      }
      const m = matchLoss(cname, kind === "mp" ? loss : [...packagingLoss, ...labelLoss]);
      return {
        id: Number(r.id), name: cname, qty: num(r.q), unit, kind,
        price: kind === "ambalaj" ? last : rawMode === "week" ? week : annual, annualPrice: annual, weekPrice: week, lastPrice: last,
        ...(kind === 'ambalaj' && safety.has(Number(r.id)) ? { priceSafety: safety.get(Number(r.id)) } : {}),
        priceSource: kind === "ambalaj" ? `ultima intrare NIR ${String(p?.lastd ?? "").slice(0, 10)}` : rawMaterialLabel,
        lossPct: m ? m.pt : 0,
        // Packaging without its own Coral ERP setting: 0%, like every packaging configured there (editable).
        lossSource: m ? `PT Coral ERP: ${m.name}` : kind === "ambalaj" ? "PT ambalaj 0% — neconfigurat în Coral ERP (editabil)" : "PT nesetat — de completat",
        ...(kind === "mp" ? (configuredRawPalletKg(cname) != null
          ? { kgPerPallet: configuredRawPalletKg(cname), palletSource: "kg/palet Coral (căpățâni 400, radicchio 500, frunze/aromate 220)" }
          : avgKgPerPallet != null ? { kgPerPallet: Math.round(avgKgPerPallet), palletSource: `kg/palet mediu din comenzi: ${Math.round(kg90)} kg ÷ ${Math.round(ordered.kgPallets)} paleți, ${load.start} – ${load.end}` } : {}) : {}),
      };
    });
    for (const c of components) if (c.priceSafety?.suspect) itemWarnings.push(`${c.name}: unitate NIR suspectă (rolă vs. bucată); ultima intrare depășește 3× media ponderată precedentelor 6 luni. Prețul Senior nu a fost modificat.`);
    const suggested = suggestedLabour(name, components);
    const traded = components.some((c) => c.kind === "marfa") && !components.some((c) => c.kind === "mp");
    const cfg: PriceConfig = { ...shared, rates: { ...shared.rates }, unitsPerCase, ...(suggested ? { labourLine: suggested } : {}), ...(traded ? { tradedGood: true } : {}), components: {} };
    for (const c of components) if (c.kind === "marfa" && c.piecesPerPallet) cfg.components = { ...cfg.components, [c.id]: { piecesPerPallet: c.piecesPerPallet } };
    if (components.some((c) => c.kind === "marfa" && !c.piecesPerPallet)) itemWarnings.push(`Marfă revândută fără buc/palet configurat: ${components.filter((c) => c.kind === "marfa" && !c.piecesPerPallet).map((c) => c.name).join(", ")}; completează buc/palet.`);
    if (convBy.has(aid)) cfg.piecesPerPallet = convBy.get(aid);
    const speed = speeds.get(aid) ?? null;
    if (suggested === MIXED_WASHED && speed) cfg.labourSpeed = Math.round(speed.speed);
    if (suggested === MIXED_WASHED && !speed) itemWarnings.push(`Mix spălat: nu am găsit sesiuni de producție în ultimele ${SPEED_DAYS} de zile pentru acest produs; completează viteza liniei (buc/oră).`);
    for (const c of components) if (c.kind === "mp") cfg.components = { ...cfg.components, [c.id]: { kgPerPallet: c.kgPerPallet } };
    const hist = history.filter((r: any) => Number(r.aid) === aid);
    const storeSales = recent.filter((r: any) => Number(r.aid) === aid).map((r: any) => ({ pid: Number(r.pid), qty: num(r.q), value: num(r.v), price: num(r.q) > 0 ? num(r.v) / num(r.q) : null }));
    const rq = storeSales.reduce((s, r) => s + r.qty, 0), rv = storeSales.reduce((s, r) => s + r.value, 0);
    const pl = priceList.find((r: any) => Number(r.aid) === aid);
    return {
      product: { id: aid, name, code: a.code, unitsPerCase },
      components, defaults: cfg, warnings: itemWarnings,
      suggestedLabourSource: traded ? `Marfă revândută ca atare (semifabricat cumpărat gata ambalat): fără manoperă directă, doar regia fabricii${suggested ? ` din CSV octombrie 2026, linia ${suggested}` : ""} (editabil)`
        : suggested ? (speed && suggested === MIXED_WASHED
        ? `Mix spălat: viteză reală ${Math.round(speed.speed)} buc/oră din Producție (${speed.sessions} sesiuni, ${speed.hours.toFixed(1)} ore lucrate, ${speed.from} – ${speed.to}; ${speed.products.join(", ")}); oameni și cost orar din CSV octombrie 2026`
        : "Propunere după produs/compoziție; tarif din CSV octombrie 2026") : "Linie neidentificată",
      realSpeed: speed,
      salesHistory: hist.map((r: any) => ({ month: String(r.m), qty: num(r.q), value: num(r.v), price: num(r.q) > 0 ? Math.round((num(r.v) / num(r.q)) * 10000) / 10000 : null })),
      storeSales,
      recentSale: rq > 0 ? { qty: rq, value: rv, price: rv / rq, from: recentStart, to: pricesPeriod.endDay } : null,
      priceList: pl ? { price: num(pl.price), currency: String(pl.cur ?? "RON"), list: String(pl.list ?? "").trim(), since: String(pl.ds).slice(0, 10) } : null,
    };
  });

  return {
    period: pricesPeriod,
    accountingPeriod: P,
    warnings, info, fees, routeOverrides: overrides,
    eur: eur[0] ? { rate: num(eur[0].rate), day: String(eur[0].day).slice(0, 10) } : null,
    stores,
    logistics: {
      closedStart: win.start, closedEnd: win.end, window: win, loadWindow: load,
      supply: { total: total30, trucks: trucks30, costPerTruck, loadTrucks: orderTrucks, invoiceTrucks90: loadTrucks, pallets: pallets90, kg: kg90, palletsPerTruck, kgPerTruck, orderedRows: ordered.rows, orderedLoads: ordered.loads }, lastTrucks: lastTrucks.map((r: any) => ({ day: String(r.day), price: num(r.price), line: String(r.line), qty: num(r.qty), value: num(r.value), supplier: String(r.supplier ?? ""), truck: num(r.truck) === 1 })),
      distribution, routes: routeData.routes, clientAverage: avg, unassigned, piecesPerPallet: routeData.piecesPerPallet,
      store: point ? { id: point.pid, name: point.name, route: point.route } : null, suggestedRoute,
      note: `Ultimele prețuri: cost mediu pe camion/cursă din facturile datate ${win.start} – ${win.end} (exclusiv); încărcarea (paleți pe camion/cursă) din ${load.start} – ${load.end}, ca să nu depindă de zilele în care se introduc NIR-urile sau facturile. Distribuție: curse „TRANSPORT DIST <cursă>”; paleți = Cantitate/Coef Senior facturați către punctele de livrare ale cursei. Punctele sunt atribuite cursei după oraș/județ; facturile transportatorilor nu indică livrarea exactă.`,
    },
    items,
  };
}

export type PriceListData = Awaited<ReturnType<typeof priceListData>>;

/** Single product sheet (chat tool, saved live sheets): same reads as the price list. */
export async function priceCalcData(sb: Rpc, legacy: any, body: Body) {
  const r = await priceListData(sb, legacy, { ...body, articolIds: [body.articolId] });
  const it = r.items[0];
  if (!it || "error" in it) throw new Error(it && "error" in it ? String(it.error) : "Produs invalid.");
  const { items: _items, ...shared } = r;
  return { ...shared, ...it, warnings: [...shared.warnings, ...shared.info, ...it.warnings] };
}

export type PriceData = Awaited<ReturnType<typeof priceCalcData>>;

/** Zero placeholders; every used rate comes from the prefilled config (EUR buffer 1.5%, no extra tech loss). */
export function defaultRates(d: { eur: { rate: number } | null }, marginPct = DEFAULT_MARGIN_PCT) {
  return {
    labourPerPiece: 0,
    utilitiesPerPiece: 0,
    supplyPerKg: 0,
    distributionPerPiece: 0,
    clientFeePerPiece: 0,
    eurRate: d.eur?.rate ?? 0,
    eurBufferPct: 1.5,
    techLossPct: 0,
    marginPct,
  };
}
