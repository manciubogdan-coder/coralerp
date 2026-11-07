// Live Senior reads for the price calculator. Every rate is derived from Senior data and returned with its source.
import { seniorLive } from "./senior.ts";
export { matchLoss } from "./priceSheet.ts";
import { componentKind, isServiceComponent, matchLoss, ratePer, ratePeriod, type SheetComponent } from "./priceSheet.ts";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => any };
const SQL = (sb: Rpc, sql: string) => seniorLive(sb, "sql", { sql }, 55000).then((r: any) => (Array.isArray(r) ? r : []));
const int = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 2 ** 31 ? n : null; };
const num = (v: unknown) => Number(v) || 0;
const SALES = "('FC','FCE','FCEC')";
const docs = `dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID`;
const notCancelled = "ISNULL(h.Anulat,0)=0";

/** Journal accounts per rate, shown to the user next to each rate. */
export const RATE_ACCOUNTS = {
  labour: ["641.01", "641.05", "646", "6421", "6422", "624.05"],
  utilities: ["605", "6028.02", "628.05", "628.06", "611.03", "6024.01", "612.04"],
  supply: ["624.01"],
  distribution: ["624.02", "624.03", "624.06"],
} as const;

export async function priceOptions(sb: Rpc, body: { subgroupId?: unknown; partnerId?: unknown }) {
  const sg = int(body.subgroupId), pid = int(body.partnerId);
  const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const subgroupsQ = SQL(sb, `SELECT cv.D_Clasificari_Valori_ID id, MAX(cv.Val_Text) name, COUNT(*) n FROM dbo.D_Parteneri_Clasificari pc WITH (NOLOCK)
    JOIN dbo.D_Clasificari_Valori cv WITH (NOLOCK) ON cv.D_Clasificari_Valori_ID=pc.D_Clasificari_Valori_ID
    JOIN dbo.D_Clasificari c WITH (NOLOCK) ON c.D_Clasificari_ID=cv.D_Clasificari_ID
    JOIN dbo.D_Parteneri p WITH (NOLOCK) ON p.Partener_ID=pc.Partener_ID
    WHERE c.Descriere='Subgrupa' AND p.IsClient=1 AND cv.Val_Text<>'--' AND cv.Val_Text NOT LIKE 'Furn%' GROUP BY cv.D_Clasificari_Valori_ID ORDER BY COUNT(*) DESC`);
  const clientsQ = sg
    ? SQL(sb, `SELECT TOP 600 p.Partener_ID id, p.Denumire name FROM dbo.D_Parteneri p WITH (NOLOCK) JOIN dbo.D_Parteneri_Clasificari pc WITH (NOLOCK) ON pc.Partener_ID=p.Partener_ID
        WHERE pc.D_Clasificari_Valori_ID=${sg} AND p.IsClient=1 AND ISNULL(p.IsActiv,1)=1 ORDER BY p.Denumire`)
    : SQL(sb, `SELECT TOP 600 pp.Partener_ID id, MAX(pp.Partener_Denumire) name FROM dbo.C_H_Note_Contabile h WITH (NOLOCK)
        JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID
        WHERE t.Cod IN ${SALES} AND ${notCancelled} AND h.Data>='${since}' GROUP BY pp.Partener_ID ORDER BY SUM(CAST(h.Valoare_Rol AS float)) DESC`);
  const productsQ = SQL(sb, `SELECT TOP 800 d.Articol_ID id, MAX(d.Denumire) name, SUM(CAST(d.Cantitate AS float)) qty FROM ${docs}
      ${pid ? "JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID" : ""}
      WHERE t.Cod IN ${SALES} AND ${notCancelled} AND h.Data>='${since}' ${pid ? `AND pp.Partener_ID=${pid}` : ""}
      AND EXISTS (SELECT 1 FROM dbo.DArticoleCompuseHVersiuni v WITH (NOLOCK) WHERE v.ArticolId=d.Articol_ID AND v.IsActiv=1)
      GROUP BY d.Articol_ID ORDER BY MAX(d.Denumire)`);
  const [subgroups, clients, products] = await Promise.all([subgroupsQ, clientsQ, productsQ]);
  return {
    subgroups: subgroups.map((r: any) => ({ id: r.id, name: String(r.name).trim(), n: r.n })),
    clients: clients.map((r: any) => ({ id: r.id, name: String(r.name).trim() })),
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

export async function priceCalcData(sb: Rpc, legacy: any, body: { articolId?: unknown; partnerId?: unknown; year?: unknown; month?: unknown; rawPriceMode?: unknown }) {
  const aid = int(body.articolId), pid = int(body.partnerId);
  const year = Number(body.year), month = Number(body.month);
  if (!aid) throw new Error("Alege produsul finit.");
  if (!(year > 2015 && year < 2100 && month >= 1 && month <= 12)) throw new Error("Lună invalidă.");
  const P = ratePeriod(year, month);
  const weekStart = new Date(new Date(`${P.endDay}T00:00:00Z`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const closedStart = `${String(P.to).slice(0, 4)}-${String(P.to).slice(4)}-01`;
  const allAcc = Object.values(RATE_ACCOUNTS).flat().map((a) => `'${a}'`).join(",");
  const histStart = new Date(Date.UTC(year, month - 13, 1)).toISOString().slice(0, 10);
  const histEnd = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

  const [art, recipe, journal, volumes, history, eur, fees, priceList] = await Promise.all([
    SQL(sb, `SELECT a.Articol_ID id, a.Denumire name, a.Cod code FROM dbo.D_Articole a WITH (NOLOCK) WHERE a.Articol_ID=${aid}`),
    SQL(sb, `SELECT v.PKArticoleCompuseHVersiuni vid, CAST(v.Cantitate AS float) vq, v.IsImplicit impl, v.DataStart ds, d.ArticolId id, a.Denumire name, CAST(d.Cantitate AS float) q, um.Cod um
      FROM dbo.DArticoleCompuseHVersiuni v WITH (NOLOCK) JOIN dbo.DArticoleCompuseD d WITH (NOLOCK) ON d.FKArticoleCompuseHVersiuni=v.PKArticoleCompuseHVersiuni
      JOIN dbo.D_Articole a WITH (NOLOCK) ON a.Articol_ID=d.ArticolId LEFT JOIN dbo.D_Articole_UM um WITH (NOLOCK) ON um.UM_ID=d.UMId
      WHERE v.ArticolId=${aid} AND v.IsActiv=1 AND d.ArticolId<>${aid} AND ISNULL(d.IsProdusPrincipal,0)=0`),
    SQL(sb, `SELECT p.Cont cont, MAX(p.Descriere) name, SUM(CASE WHEN dc.IsDebit=1 THEN CAST(dc.Valoare_Rol AS float) ELSE -CAST(dc.Valoare_Rol AS float) END) v
      FROM dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK) JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID=dc.AnaliticId
      JOIN dbo.C_H_Note_Contabile h WITH (NOLOCK) ON h.H_ID=dc.H_ID JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
      WHERE p.Cont IN (${allAcc}) AND t.Cod<>'NCICV' AND ${notCancelled} AND dc.LunaContabila BETWEEN '${P.from}' AND '${P.to}' GROUP BY p.Cont`),
    SQL(sb, `SELECT SUM(CASE WHEN t.Cod IN ${SALES} AND um.Cod='BUC' THEN CAST(d.Cantitate AS float) ELSE 0 END) pieces,
        SUM(CASE WHEN t.Cod='NIR' AND um.Cod='KG' THEN CAST(d.Cantitate AS float) ELSE 0 END) kg
      FROM ${docs} LEFT JOIN dbo.D_Articole_UM um WITH (NOLOCK) ON um.UM_ID=d.UM_ID
      WHERE t.Cod IN ('FC','FCE','FCEC','NIR') AND ${notCancelled} AND h.Data>='${P.startDay}' AND h.Data<'${P.endDay}'`),
    SQL(sb, `SELECT CONVERT(char(7), h.Data, 120) m, SUM(CAST(d.Cantitate AS float)) q, SUM(CAST(d.Valoare_Neta_Rol AS float)) v FROM ${docs}
      ${pid ? "JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID" : ""}
      WHERE t.Cod IN ${SALES} AND ${notCancelled} AND d.Articol_ID=${aid} ${pid ? `AND pp.Partener_ID=${pid}` : ""} AND h.Data>='${histStart}' AND h.Data<'${histEnd}'
      GROUP BY CONVERT(char(7), h.Data, 120) ORDER BY m`),
    SQL(sb, `SELECT TOP 1 c.Data day, CAST(c.Curs AS float) rate FROM dbo.D_Valuta_Cursuri c WITH (NOLOCK) JOIN dbo.D_Valuta v WITH (NOLOCK) ON v.Valuta_ID=c.Valuta_ID
      JOIN dbo.D_Valuta_Cursuri_Tipuri tt WITH (NOLOCK) ON tt.Valuta_Cursuri_Tipuri_ID=c.Valuta_Cursuri_Tipuri_ID
      WHERE v.Simbol='EUR' AND tt.Descriere='BNR' AND c.Data<'${histEnd}' ORDER BY c.Data DESC`),
    pid ? SQL(sb, `SELECT SUM(CASE WHEN t.Cod IN ('FF','FFI','FFIC') THEN CAST(d.Valoare_Neta_Rol AS float) ELSE 0 END) fees,
        SUM(CASE WHEN t.Cod IN ${SALES} AND um.Cod='BUC' THEN CAST(d.Cantitate AS float) ELSE 0 END) pieces
      FROM ${docs} JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID LEFT JOIN dbo.D_Articole_UM um WITH (NOLOCK) ON um.UM_ID=d.UM_ID
      WHERE pp.Partener_ID=${pid} AND t.Cod IN ('FF','FFI','FFIC','FC','FCE','FCEC') AND ${notCancelled} AND h.Data>='${P.startDay}' AND h.Data<'${P.endDay}'`) : Promise.resolve([]),
    pid ? SQL(sb, `SELECT TOP 1 CAST(ld.Pret AS float) price, v.Simbol cur, lh.Descriere list, lh.Data_Start ds FROM dbo.D_Liste_Preturi_D ld WITH (NOLOCK)
      JOIN dbo.D_Liste_Preturi_H lh WITH (NOLOCK) ON lh.D_Liste_Preturi_H_ID=ld.D_Liste_Preturi_H_ID
      JOIN dbo.D_Parteneri_Liste_Preturi pl WITH (NOLOCK) ON pl.D_Liste_Preturi_H_ID=lh.D_Liste_Preturi_H_ID LEFT JOIN dbo.D_Valuta v WITH (NOLOCK) ON v.Valuta_ID=ld.Valuta_ID
      WHERE pl.Partener_ID=${pid} AND ld.Articol_ID=${aid} AND ld.Pret>0 AND lh.Data_Start<'${histEnd}' AND (lh.Data_End IS NULL OR lh.Data_End>='${histEnd}') ORDER BY lh.Data_Start DESC`) : Promise.resolve([]),
  ]);
  if (!art.length) throw new Error("Produsul nu există în Senior.");
  if (!recipe.length) throw new Error("Produsul nu are rețetă activă în Senior.");

  // Pick the default active version, else the most recent.
  const versions = new Map<number, any[]>();
  for (const r of recipe) versions.set(r.vid, [...(versions.get(r.vid) ?? []), r]);
  const pick = [...versions.values()].sort((a, b) => (Number(!!b[0].impl) - Number(!!a[0].impl)) || String(b[0].ds).localeCompare(String(a[0].ds)))[0];
  const unitsPerCase = num(pick[0].vq) || 1;
  const rows = pick.filter((r) => !isServiceComponent(String(r.name)));
  const ids = [...new Set(rows.map((r) => int(r.id)).filter(Boolean))] as number[];

  const priceRows = ids.length ? await SQL(sb, `SELECT L.id,
      SUM(CASE WHEN L.day>='${P.startDay}' THEN L.v ELSE 0 END) v12,
      SUM(CASE WHEN L.day>='${P.startDay}' THEN L.q ELSE 0 END) q12,
      SUM(CASE WHEN L.day>='${weekStart}' THEN L.v ELSE 0 END) vw,
      SUM(CASE WHEN L.day>='${weekStart}' THEN L.q ELSE 0 END) qw,
      SUM(CASE WHEN L.day=L.lastday THEN L.v ELSE 0 END)/NULLIF(SUM(CASE WHEN L.day=L.lastday THEN L.q ELSE 0 END),0) lastp,
      MAX(L.day) lastd FROM (
        SELECT d.Articol_ID id, h.Data day, CAST(d.Valoare_Neta_Rol AS float) v, CAST(d.Cantitate AS float) q,
          MAX(h.Data) OVER (PARTITION BY d.Articol_ID) lastday
        FROM ${docs} WHERE t.Cod='NIR' AND ${notCancelled} AND d.Articol_ID IN (${ids.join(",")}) AND d.Cantitate>0
          AND h.Data<'${P.endDay}' AND h.Data>=DATEADD(year,-3,'${P.endDay}')) L GROUP BY L.id`) : [];
  const prices = new Map(priceRows.map((r: any) => [Number(r.id), r]));

  const readLoss = async (table: string) => {
    const all: Array<{ name: string; pt_percent: number | null }> = [];
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
  const [loss, packagingLoss, closedJournal] = await Promise.all([
    readLoss("products"), readLoss("ambalaje_products"),
    SQL(sb, `SELECT p.Cont cont, SUM(CASE WHEN dc.IsDebit=1 THEN CAST(dc.Valoare_Rol AS float) ELSE -CAST(dc.Valoare_Rol AS float) END) v
      FROM dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK) JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID=dc.AnaliticId
      JOIN dbo.C_H_Note_Contabile h WITH (NOLOCK) ON h.H_ID=dc.H_ID JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
      WHERE p.Cont IN ('624.01') AND t.Cod<>'NCICV' AND ${notCancelled} AND dc.LunaContabila='${P.to}' GROUP BY p.Cont`),
  ]);
  const components: SheetComponent[] = rows.map((r): SheetComponent => {
    const name = String(r.name).trim(), unit = String(r.um ?? "").trim() || "BUC";
    const p = prices.get(Number(r.id));
    const annual = p && num(p.q12) > 0 ? num(p.v12) / num(p.q12) : null;
    const kind = componentKind(name, unit);
    const m = matchLoss(name, kind === "mp" ? loss : packagingLoss);
    const week = p && num(p.qw) > 0 ? num(p.vw) / num(p.qw) : null;
    const last = p?.lastp != null ? num(p.lastp) : null;
    const chosen = kind === "ambalaj" ? last : body.rawPriceMode === "week" ? week : annual;
    return {
      id: Number(r.id), name, qty: num(r.q), unit, kind,
      price: chosen, annualPrice: annual, weekPrice: week, lastPrice: last,
      priceSource: kind === "ambalaj" ? `ultima intrare NIR ${String(p?.lastd ?? "").slice(0, 10)}` : body.rawPriceMode === "week" ? `medie NIR ${weekStart} – ${P.endDay} (exclusiv)` : `medie NIR ${P.startDay} – ${P.endDay} (exclusiv)`,
      lossPct: m ? m.pt : 0,
      lossSource: m ? `PT Coral ERP: ${m.name}` : "PT nesetat — de completat",
    };
  });

  const acc = new Map(journal.map((r: any) => [String(r.cont), { cont: String(r.cont), name: String(r.name ?? ""), value: Math.round(num(r.v) * 100) / 100 }]));
  const bucket = (k: keyof typeof RATE_ACCOUNTS) => {
    const items = RATE_ACCOUNTS[k].map((a) => acc.get(a)).filter(Boolean) as Array<{ cont: string; name: string; value: number }>;
    return { total: items.reduce((s, x) => s + x.value, 0), accounts: items };
  };
  const pieces = num(volumes[0]?.pieces), kg = num(volumes[0]?.kg);
  const lab = bucket("labour"), uti = bucket("utilities"), sup = bucket("supply"), dis = bucket("distribution");
  const fee = fees[0] ? { fees: num(fees[0].fees), pieces: num(fees[0].pieces) } : null;
  const rate = (total: number, vol: number) => Math.round((ratePer(total, vol) ?? 0) * 10000) / 10000;

  return {
    product: { id: art[0].id, name: String(art[0].name).trim(), code: art[0].code, unitsPerCase },
    period: P,
    logistics: { closedStart, closedEnd: P.endDay, supplyTotal: closedJournal.length ? closedJournal.reduce((s: number, r: any) => s + num(r.v), 0) : null, supplyPallets: null, distribution: { România: null, Bulgaria: null, Moldova: null }, piecesPerPallet: null, note: "Paleții recepționați/facturați și costurile pe rută nu au o legătură verificată în Senior. Completați valorile confirmate; nu se folosește media firmei pe bucată." },
    components,
    rates: {
      labourPerPiece: { value: rate(lab.total, pieces), total: lab.total, volume: pieces, unit: "buc vândute", accounts: lab.accounts },
      utilitiesPerPiece: { value: rate(uti.total, pieces), total: uti.total, volume: pieces, unit: "buc vândute", accounts: uti.accounts },
      supplyPerKg: { value: rate(sup.total, kg), total: sup.total, volume: kg, unit: "kg recepționate (NIR)", accounts: sup.accounts },
      distributionPerPiece: { value: rate(dis.total, pieces), total: dis.total, volume: pieces, unit: "buc vândute", accounts: dis.accounts },
      clientFeePerPiece: fee ? { value: rate(fee.fees, fee.pieces), total: fee.fees, volume: fee.pieces, unit: "buc vândute clientului", accounts: [{ cont: "FF", name: "facturi emise de client către Coral (servicii, taxe logistice)", value: Math.round(fee.fees * 100) / 100 }] } : { value: 0, total: 0, volume: 0, unit: "", accounts: [] },
    },
    eur: eur[0] ? { rate: num(eur[0].rate), day: String(eur[0].day).slice(0, 10) } : null,
    salesHistory: history.map((r: any) => ({ month: String(r.m), qty: num(r.q), value: num(r.v), price: num(r.q) > 0 ? Math.round((num(r.v) / num(r.q)) * 10000) / 10000 : null })),
    priceList: priceList[0] ? { price: num(priceList[0].price), currency: String(priceList[0].cur ?? "RON"), list: String(priceList[0].list ?? "").trim(), since: String(priceList[0].ds).slice(0, 10) } : null,
  };
}

export type PriceData = Awaited<ReturnType<typeof priceCalcData>>;

/** Default rates straight from the Senior-derived data (EUR buffer 1.5%, no extra tech loss). */
export function defaultRates(d: PriceData, marginPct = 0) {
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
