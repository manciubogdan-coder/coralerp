import { Fragment, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Send } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { argusFetch } from "@/lib/argusApi";
import { toast } from "@/hooks/use-custom-toast";
import { configuredSheet, validPriceConfig, type PriceConfig } from "../../../supabase/functions/_shared/priceConfig";
import { prefilledConfig } from "../../../supabase/functions/_shared/priceDefaults";
import { priceRules, profitFor } from "../../../supabase/functions/_shared/priceRules";
import type { SheetComponent } from "../../../supabase/functions/_shared/priceSheet";

type Opt = { id: number; name: string };
type RouteStat = { route: string; country: string; trips: number; perPallet: number | null; palletsPerTrip: number | null; points: Array<{ name: string; pallets: number }> };
type Item = { product: { id: number; name: string; unitsPerCase: number }; defaults: PriceConfig; components: SheetComponent[]; recentSale: { price: number; qty: number } | null };
type Target = {
  eur: { rate: number } | null; fees?: { pct: number; rule: string | null } | null;
  stores: Array<{ pid: number; name: string; route: string | null; proposed?: string | null }>;
  logistics: { distribution?: Record<string, PriceConfig | null>; routes?: RouteStat[]; suggestedRoute?: string | null };
  items: Array<Item | { product: { id: number; name: string }; error: string }>;
};
type Hist = { aid: number; lastDay: string; lastPrice: number | null; lastStore: string; firstDay: string; qty: number; avgPrice: number | null; matchedId?: number; matchedName?: string; match?: "same" | "exact" | "similar" };

const n2 = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null && b > 0 ? ((a - b) / b) * 100 : null);
const DIST = ["distributionTotal", "distributionPallets", "distributionPerPallet", "distributionTrips", "distributionPalletsPerTrip"];
const ZERO = (eur: number) => ({ labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: eur, eurBufferPct: priceRules().eurBufferPct, techLossPct: 0, marginPct: 0 });

/** Offer the products of the current list to another client: its own cursă, network fee and full Senior price history. */
export default function OfferToClient({ clients, sourceName, items, sourcePrice, year, month, mode, marginPct, picker, productPicker, productName }: {
  clients: Opt[]; sourceName: string; items: Item[]; sourcePrice: (id: number) => number | null;
  year: number; month: number; mode: "annual" | "week"; marginPct: number;
  picker: (p: { value: number | null; onChange: (v: number | null) => void }) => JSX.Element;
  /** Any finished product, not only the ones the source client buys. */
  productPicker: (p: { value: number[]; onChange: (v: number[]) => void }) => JSX.Element;
  productName: (id: number) => string | undefined;
}) {
  const listIds = useMemo(() => items.map((i) => i.product.id), [items]);
  const [ids, setIds] = useState<number[]>(listIds);
  const [ranIds, setRanIds] = useState("");
  useEffect(() => { setIds((p) => [...new Set([...listIds, ...p.filter((id) => !listIds.includes(id))])]); }, [listIds]);
  const [target, setTarget] = useState<number | null>(null);
  const [data, setData] = useState<Target | null>(null);
  const [hist, setHist] = useState<Map<number, Hist>>(new Map());
  const [route, setRoute] = useState("");
  const [busy, setBusy] = useState(false);
  const targetName = clients.find((c) => c.id === target)?.name ?? "";

  const run = async () => {
    if (!target || !ids.length) return;
    setBusy(true);
    try {
      const [t, h] = await Promise.all([
        argusFetch<Target>("price_list", {}, { articolIds: ids, partnerId: target, year, month, rawPriceMode: mode }),
        argusFetch<{ items: Hist[] }>("price_history", {}, { articolIds: ids, partnerId: target }),
      ]);
      setData(t); setHist(new Map(h.items.map((x) => [x.aid, x]))); setRanIds(ids.join(","));
      setRoute(proposedRoute(t));
    } catch (e: any) {
      toast({ variant: "destructive", title: "Oferta nu s-a putut calcula", description: e.message });
    } finally { setBusy(false); }
  };

  /** Target cursă: the stores' cursă with a tariff; Moldova points take the Moldova cursă that has trips (Linella's truck). */
  function proposedRoute(t: Target) {
    const dist = t.logistics.distribution ?? {};
    const has = (r?: string | null) => !!r && !!dist[r]?.distributionPerPallet;
    for (const st of t.stores) for (const r of [st.route, st.proposed]) if (has(r)) return r!;
    if (has(t.logistics.suggestedRoute)) return t.logistics.suggestedRoute!;
    const wantsMoldova = t.stores.some((s) => /MOLDOVA/.test(String(s.route ?? s.proposed ?? ""))) || /moldov|chisin|linella|moldretail/i.test(targetName);
    if (wantsMoldova) { const m = (t.logistics.routes ?? []).filter((r) => r.country === "Moldova" && r.perPallet).sort((a, b) => b.trips - a.trips)[0]; if (m) return m.route; }
    return "România";
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const dist = data.logistics.distribution ?? {};
    return data.items.map((it) => {
      const src = { product: { id: it.product.id, name: it.product.name } };
      const h = hist.get(src.product.id) ?? null;
      const from = sourcePrice(src.product.id);
      if ("error" in it) return { src, h, from, s: null, error: it.error };
      const comps = it.components.map((c) => ({ ...c, ...(c.kind === "mp" || c.kind === "marfa" ? { price: mode === "week" ? c.weekPrice ?? null : c.annualPrice ?? null } : {}) }));
      const base: PriceConfig = { ...it.defaults };
      for (const k of DIST) delete (base as Record<string, unknown>)[k];
      Object.assign(base, dist[route] ?? {});
      const user: PriceConfig = { route, rates: { marginPct, profitPct: profitFor(it.product.name, targetName).pct }, ...(data.fees ? { feePct: data.fees.pct } : {}) };
      if (!validPriceConfig(user)) return { src, h, from, s: null, error: "parametri invalizi" };
      const s = configuredSheet({ ...it, components: comps }, ZERO(data.eur?.rate ?? 0), prefilledConfig({ ...it, defaults: base, logistics: data.logistics }, user)).sheet;
      return { src, h, from, s, error: null as string | null };
    });
  }, [data, hist, route, marginPct, mode, targetName, sourcePrice]);
  const stale = !!data && ranIds !== ids.join(",");

  const routeInfo = data?.logistics.routes?.find((r) => r.route === route);
  const exportXlsx = () => {
    const head = ["Produs", "Buc/bax", `Preț actual ${sourceName} (lei/buc)`, `Ultimul preț ${targetName} (lei/buc)`, `Articol facturat la ${targetName}`, "Data ultimei facturi", "Prima vânzare", "Bucăți vândute istoric", "Cost producție (lei/buc)", "Transport (lei/buc)", "Preț minim (lei/buc)", "Taxe rețea %", "Preț propus (lei/buc)", "Preț propus (EUR/buc)", `Dif. vs ${sourceName} %`, "Dif. vs istoric %", "Observații"];
    const body = rows.map((r) => {
      const p = r.s?.perPiece;
      return [r.src.product.name, r.s?.unitsPerCase ?? "", r.from ?? "", r.h?.lastPrice ?? "fără istoric", r.h ? `${r.h.matchedName ?? ""}${r.h.match === "similar" ? " (produs asemănător)" : ""}` : "", r.h?.lastDay ?? "", r.h?.firstDay ?? "", r.h?.qty ?? 0,
        p?.productionCost ?? "", p?.logistics ?? "", p?.minPrice ?? "", r.s?.feePct ?? "", p?.clientPrice ?? "", p?.clientPriceEur ?? "",
        p ? pct(p.clientPrice, r.from) ?? "" : "", p ? pct(p.clientPrice, r.h?.lastPrice) ?? "" : "",
        r.error ?? (r.s && !r.s.complete ? `incomplet: ${[...r.s.missingInputs, ...r.s.missingPrices.map((x: any) => x.name ?? x)].join(", ")}` : "")];
    });
    const ws = XLSX.utils.aoa_to_sheet([[`Ofertă ${targetName}`], [`Pornire: ${sourceName} · cursa ${route}${routeInfo?.perPallet ? ` · ${n2(routeInfo.perPallet)} lei/palet` : ""} · taxe rețea ${n2(data?.fees?.pct ?? 0, 1)}% · marjă ${marginPct}%`], [], head, ...body]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ofertă");
    XLSX.writeFile(wb, `Oferta ${targetName}.xlsx`.replace(/[\\/:*?"<>|]/g, " "));
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4" /> Ofertă pentru alt client</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Alegi clientul căruia vrei să-i oferi produsele din listă (poți adăuga și alte produse). Recalculez cu cursa lui de transport, taxele lui de rețea și caut în tot istoricul Senior dacă i-am vândut vreodată și la ce preț.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">{picker({ value: target, onChange: (v) => { setTarget(v); setData(null); } })}</div>
          <div className="min-w-[260px] flex-1">{productPicker({ value: ids, onChange: setIds })}</div>
          <Button onClick={run} disabled={!target || !ids.length || busy}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Calculează oferta</Button>
          {data && <Button variant="outline" onClick={exportXlsx}><Download className="mr-1 h-4 w-4" />Excel</Button>}
        </div>
        {ids.some((id) => !listIds.includes(id)) && (
          <p className="text-xs text-muted-foreground">Produse adăugate în plus față de listă: {ids.filter((id) => !listIds.includes(id)).map((id) => productName(id) ?? `#${id}`).join(", ")}. Ele nu au preț la {sourceName}, doar costul și prețul propus pentru clientul ofertat.</p>
        )}
        {stale && <p className="text-xs font-medium text-amber-600">Ai schimbat produsele — apasă „Calculează oferta” ca să le vezi în tabel.</p>}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Label className="text-xs">Cursa de transport</Label>
              <select aria-label="Cursa ofertă" className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={route} onChange={(e) => setRoute(e.target.value)}>
                {(data.logistics.routes ?? []).map((r) => <option key={r.route} value={r.route}>{r.route} · {r.perPallet != null ? `${n2(r.perPallet)} lei/palet` : "fără paleți"}</option>)}
                <option value="România">Media curselor interne</option>
              </select>
              <span className="text-muted-foreground">{routeInfo ? `${routeInfo.trips} curse · ${n2(routeInfo.palletsPerTrip, 1)} paleți/cursă${routeInfo.points.length ? ` · livrări: ${routeInfo.points.slice(0, 3).map((p) => p.name).join(", ")}` : ""}` : ""}</span>
              <span>Taxe rețea: <b>{n2(data.fees?.pct ?? 0, 1)}%</b> {data.fees?.rule ? `(${data.fees.rule})` : "(nu e în tabelul de taxe → 0%)"}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead className="border-b text-left text-muted-foreground"><tr>
                  <th className="py-1">Produs</th><th className="text-right">Preț {sourceName}</th><th className="text-right">Ultimul preț {targetName}</th>
                  <th className="text-right">Cost producție</th><th className="text-right">Transport</th><th className="text-right">Preț minim</th><th className="text-right">Preț propus</th>
                  <th className="text-right">vs {sourceName}</th><th className="text-right">vs istoric</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const p = r.s?.perPiece;
                    return (
                      <Fragment key={r.src.product.id}>
                        <tr className="border-b last:border-0">
                          <td className="py-1">{r.src.product.name}{r.error && <div className="text-destructive">{r.error}</div>}{r.s && !r.s.complete && <div className="text-amber-600">incomplet: {r.s.missingInputs.slice(0, 2).join(", ")}</div>}</td>
                          <td className="text-right tabular-nums">{n2(r.from, 4)}</td>
                          <td className="text-right tabular-nums">{r.h?.lastPrice != null ? <>{n2(r.h.lastPrice, 4)}<div className="text-[10px] text-muted-foreground">{r.h.lastDay} · {n2(r.h.qty, 0)} buc din {r.h.firstDay}</div>{r.h.match !== "same" && <div className={`text-[10px] ${r.h.match === "similar" ? "text-amber-600" : "text-muted-foreground"}`}>{r.h.match === "similar" ? "asemănător: " : "ca "}{r.h.matchedName}</div>}</> : <span className="text-muted-foreground">fără istoric</span>}</td>
                          <td className="text-right tabular-nums">{n2(p?.productionCost, 4)}</td>
                          <td className="text-right tabular-nums">{n2(p?.logistics, 4)}</td>
                          <td className="text-right tabular-nums">{n2(p?.minPrice, 4)}</td>
                          <td className="text-right font-semibold tabular-nums">{r.s?.complete ? <>{n2(p?.clientPrice, 4)}<div className="text-[10px] font-normal text-muted-foreground">{n2(p?.clientPriceEur, 4)} EUR</div></> : "—"}</td>
                          <td className="text-right tabular-nums">{r.s?.complete ? `${n2(pct(p?.clientPrice, r.from), 1)}%` : "—"}</td>
                          <td className="text-right tabular-nums">{r.s?.complete ? `${n2(pct(p?.clientPrice, r.h?.lastPrice), 1)}%` : "—"}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">Prețuri în lei/bucată fără TVA. Preț minim = cost producție + transport + marjă brută; preț propus = minim + profit țintă, apoi taxele de rețea. Costul de producție e același ca la {sourceName}; se schimbă doar transportul și taxele.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
