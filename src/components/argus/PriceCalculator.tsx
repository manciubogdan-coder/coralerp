import { useEffect, useMemo, useState } from "react";
import { Calculator, Check, ChevronsUpDown, Loader2, Zap } from "lucide-react";
import { toast } from "@/hooks/use-custom-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { argusFetch } from "@/lib/argusApi";
import { type SheetComponent } from "../../../supabase/functions/_shared/priceSheet";

import { configuredSheet, lineLabour, RATE_KEYS, CONFIG_NUMBERS, validPriceConfig, type PriceConfig } from "../../../supabase/functions/_shared/priceConfig";
import { PriceParameters, NumericParameter } from "./PriceParameters";
import { prefilledConfig } from "../../../supabase/functions/_shared/priceDefaults";

type Opt = { id: number; name: string };
type Store = Opt & { route: string | null };
type RouteStat = { route: string; country: string; trips: number; total: number; pallets: number; perPallet: number | null; perTrip: number | null; palletsPerTrip: number | null; unitPrice: number | null; pmin: number; pmax: number; points: Array<{ name: string; pallets: number }> };
type Rate = { value: number; total: number; volume: number; unit: string; accounts: Array<{ cont: string; name: string; value: number }> };
type Data = {
  product: { id: number; name: string; unitsPerCase: number };
  defaults?: PriceConfig;
  warnings?: string[];
  period: { startDay: string; endDay: string };
  components: SheetComponent[];
  rates: Record<"labourPerPiece" | "utilitiesPerPiece" | "supplyPerKg" | "distributionPerPiece" | "clientFeePerPiece", Rate>;
  logistics: { supplyTotal: number | null; closedStart: string; closedEnd: string; note: string; distribution?: Record<string, PriceConfig | null>; routes?: RouteStat[]; store?: { id: number; name: string; route: string | null } | null; suggestedRoute?: string | null };
  eur: { rate: number; day: string } | null;
  salesHistory: Array<{ month: string; qty: number; value: number; price: number | null }>;
  priceList: { price: number; currency: string; list: string; since: string } | null;
};

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const n2 = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (s: string) => Number(String(s).replace(",", "."));
const LABOUR_FIELDS = ["labourPerPiece", "utilitiesPerPiece", "labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"];

function Picker({ label, options, value, onChange, placeholder, allowAll }: { label: string; options: Opt[]; value: number | null; onChange: (v: number | null) => void; placeholder: string; allowAll?: string }) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.id === value);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            <span className="truncate">{cur?.name ?? (value == null && allowAll ? allowAll : placeholder)}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Caută…" />
            <CommandList className="max-h-72 overflow-y-auto">
              <CommandEmpty>Nimic găsit.</CommandEmpty>
              <CommandGroup>
                {allowAll && (
                  <CommandItem value={`__all ${allowAll}`} onSelect={() => { onChange(null); setOpen(false); }}>
                    <Check className={`mr-2 h-4 w-4 ${value == null ? "opacity-100" : "opacity-0"}`} />{allowAll}
                  </CommandItem>
                )}
                {options.map((o) => (
                  <CommandItem key={o.id} value={`${o.name} ${o.id}`} onSelect={() => { onChange(o.id); setOpen(false); }}>
                    <Check className={`mr-2 h-4 w-4 ${value === o.id ? "opacity-100" : "opacity-0"}`} />{o.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function NumField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function PriceCalculator() {
  const now = new Date();
  const [subgroups, setSubgroups] = useState<Opt[]>([]);
  const [clients, setClients] = useState<Opt[]>([]);
  const [products, setProducts] = useState<Opt[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<number | null>(null);
  const [routeManual, setRouteManual] = useState(false);
  const [sg, setSg] = useState<number | null>(null);
  const [client, setClient] = useState<number | null>(null);
  const [product, setProduct] = useState<number | null>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [adjustedRates, setAdjustedRates] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<"annual" | "week">("annual");
  const [route, setRoute] = useState("România");
  const [basis, setBasis] = useState<"pallet" | "kg">("pallet");
  const [line, setLine] = useState("");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [palletKg, setPalletKg] = useState<Record<number, string>>({});
  const [losses, setLosses] = useState<Record<number, string>>({});

  useEffect(() => {
    let off = false;
    setLoadingOpts(true);
    argusFetch<{ subgroups: Opt[]; clients: Opt[]; products: Opt[]; stores?: Store[] }>("price_options", {}, { subgroupId: sg, partnerId: client })
      .then((r) => {
        if (off) return;
        setSubgroups(r.subgroups); setClients(r.clients); setProducts(r.products); setStores(r.stores ?? []);
        if (client != null && !r.clients.some((c) => c.id === client)) setClient(null);
      })
      .catch((e) => !off && setError(e.message))
      .finally(() => !off && setLoadingOpts(false));
    return () => { off = true; };
  }, [sg, client]);

  const run = async () => {
    if (!product) return;
    setLoading(true); setError(null);
    try {
      const d = await argusFetch<Data>("price_calc", {}, { articolId: product, partnerId: client, storeId: store ?? client, year, month, rawPriceMode: mode });
      setData(d);
      const base = d.defaults ?? {};
      // The store's cursă is proposed on every run unless the user picked a cursă by hand.
      if (!routeManual) { setRoute(base.route ?? "România"); clearDistribution(); }
      if (!line || data?.product.id !== d.product.id) setLine(base.labourLine ?? "");
      if (data?.product.id !== d.product.id) {
        setPrices({}); setLosses({}); setQuantities({}); setPalletKg({});
        setAdjustedRates((p) => (p.marginPct != null ? { marginPct: p.marginPct } : {}));
        setBasis(base.supplyBasis ?? "pallet");
      }
    } catch (e) { setError((e as Error).message); setData(null); }
    finally { setLoading(false); }
  };

  const [saving, setSaving] = useState(false);
  const saveLive = async () => {
    if (!data || !product || data.product.id !== product) return;
    const clientName = clients.find((c) => c.id === client)?.name ?? "";
    const margin = num(display.marginPct || "0");
    setSaving(true);
    try {
      const r = await argusFetch<any>("live_save", {}, {
        kind: "price", articolId: product, partnerId: client, marginPct: margin, config: config, year, month, product: data.product.name, client: clientName,
        title: `Fișă preț — ${data.product.name}${clientName ? ` · ${clientName}` : ""}${margin ? ` · marjă ${margin}%` : ""}`,
      });
      toast({ title: "Fișă live salvată", description: r.firstRunOk ? "O găsești în „Agenți & Rapoarte”. Actualizează oricând, fără credite AI." : "Salvată; prima recalculare a eșuat, încearcă Actualizează." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Nu s-a putut salva", description: e.message });
    } finally { setSaving(false); }
  };

  const config = useMemo(() => {
    const cfg: PriceConfig = { year, month, rawPriceMode: mode, route, supplyBasis: basis, ...(line ? { labourLine: line } : {}), rates: {}, components: {} };
    for (const k of RATE_KEYS) if (adjustedRates[k] != null && adjustedRates[k] !== "") cfg.rates = { ...cfg.rates, [k]: num(adjustedRates[k]) };
    for (const k of CONFIG_NUMBERS) if (adjustedRates[k] != null && adjustedRates[k] !== "") Object.assign(cfg, { [k]: num(adjustedRates[k]) });
    for (const c of data?.components ?? []) {
      const o: { price?: number; qty?: number; lossPct?: number; kgPerPallet?: number } = {};
      if (prices[c.id] != null && prices[c.id] !== "") o.price = num(prices[c.id]);
      if (losses[c.id] != null && losses[c.id] !== "") o.lossPct = num(losses[c.id]);
      if (quantities[c.id] != null && quantities[c.id] !== "") o.qty = num(quantities[c.id]);
      if (palletKg[c.id] != null && palletKg[c.id] !== "") o.kgPerPallet = num(palletKg[c.id]);
      cfg.components = { ...cfg.components, [c.id]: o };
    }
    return cfg;
  }, [data, mode, route, basis, line, adjustedRates, prices, losses, quantities, palletKg, year, month]);
  const sheet = useMemo(() => {
    if (!data || !validPriceConfig(config)) return null;
    const comps = data.components.map((c) => ({ ...c, ...(c.kind === "mp" ? { price: mode === "week" ? c.weekPrice ?? null : c.annualPrice ?? null } : {}) }));
    const effective = prefilledConfig(data, config);
    const result = configuredSheet({ ...data, components: comps }, { labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: data.eur?.rate ?? 0, eurBufferPct: 1.5, techLossPct: 0, marginPct: 0 }, effective);
    return { s: result.sheet, comps: result.components, rates: result.rates, effective };
  }, [data, config, mode]);
  // Fields show the value actually used: calculated from Senior/CSV unless the user typed one.
  const display = useMemo(() => {
    const out: Record<string, string> = {};
    const fmt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : "");
    for (const k of CONFIG_NUMBERS) out[k] = adjustedRates[k] ?? fmt(sheet?.effective[k]);
    for (const k of RATE_KEYS) {
      const used = k === "labourPerPiece" || k === "utilitiesPerPiece" ? (sheet?.effective.rates?.[k] ?? (sheet && lineLabour(sheet.effective) ? sheet.rates[k] : undefined)) : sheet?.effective.rates?.[k];
      out[k] = adjustedRates[k] ?? fmt(used);
    }
    return out;
  }, [adjustedRates, sheet]);
  const chooseLine = (v: string) => {
    setLine(v);
    setAdjustedRates((p) => { const n = { ...p }; for (const k of LABOUR_FIELDS) delete n[k]; return n; });
  };

  const clearDistribution = () => setAdjustedRates((p) => { const n = { ...p }; for (const k of ["distributionTotal", "distributionPallets", "distributionPerPallet", "distributionTrips", "distributionPalletsPerTrip"]) delete n[k]; return n; });
  const pickRoute = (v: string, manual = true) => { setRoute(v); setRouteManual(manual); clearDistribution(); };
  const chooseClient = (v: number | null) => { setClient(v); setStore(v); setRouteManual(false); };
  const chooseStore = (v: number | null) => {
    setStore(v); setRouteManual(false);
    const r = stores.find((x) => x.id === v)?.route;
    if (r && data?.logistics.distribution?.[r]) pickRoute(r, false);
  };
  const routeOptions = useMemo(() => [
    ...(data?.logistics.routes ?? []).map((r) => ({ value: r.route, label: `${r.route} · ${r.perPallet != null ? `${n2(r.perPallet)} lei/palet` : r.perTrip != null ? `${n2(r.perTrip)} lei/cursă, paleți necunoscuți` : "fără curse"}` })),
    { value: "România", label: "Media curselor interne" },
  ], [data]);
  const storeName = stores.find((x) => x.id === store)?.name ?? data?.logistics.store?.name;
  const lastSale = data ? [...data.salesHistory].reverse().find((h) => h.price != null) ?? null : null;
  const setR = (k: string) => (v: string) => {
    setAdjustedRates((p) => {
      const next = { ...p, [k]: v };
      // A changed total or volume recalculates its tariff unless the tariff itself is typed afterwards.
      if (k === "supplyTotal" || k === "supplyPallets") delete next.supplyPerPallet;
      if (k === "supplyTotal" || k === "supplyKg") delete next.supplyPerKg;
      if (["distributionTotal", "distributionPallets", "distributionTrips", "distributionPalletsPerTrip"].includes(k)) delete next.distributionPerPallet;
      if (k === "distributionPallets") delete next.distributionPalletsPerTrip;
      if (["labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"].includes(k)) { delete next.labourPerPiece; delete next.utilitiesPerPiece; }
      return next;
    });
  };
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Calculator className="h-5 w-5" /> Calculator preț</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Picker label="Subgrupă client" options={subgroups} value={sg} onChange={(v) => { setSg(v); setClient(null); setStore(null); }} placeholder="Toate" allowAll="Toate subgrupele" />
            <Picker label="Client" options={clients} value={client} onChange={chooseClient} placeholder="Toți clienții" allowAll="Toți clienții (fără taxe client)" />
            {client != null && stores.length > 1 && (
              <Picker label="Magazin / punct de livrare" options={stores.map((x) => ({ id: x.id, name: `${x.name}${x.route ? ` · cursa ${x.route}` : " · cursă de ales"}` }))} value={store} onChange={chooseStore} placeholder="Alege magazinul" />
            )}
            <Picker label={`Produs finit${loadingOpts ? " · se încarcă…" : ""}`} options={products} value={product} onChange={setProduct} placeholder="Alege produsul" />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Luna</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Anul</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <NumField label="Marjă brută %" value={display.marginPct || adjustedRates.marginPct || "0"} onChange={setR("marginPct")} hint="Din prețul de vânzare: cost ÷ (1 − marjă)" />
            <div className="flex items-end">
              <Button className="w-full" onClick={run} disabled={!product || loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}Calculează
              </Button>
            </div>
          </div>
          <details open className="border-t pt-3"><summary className="cursor-pointer font-medium text-sm">Filtre și parametri de calcul</summary><div className="mt-3"><PriceParameters values={display} basis={basis} setBasis={setBasis} setValue={(k, v) => setR(k)(v)} mode={mode} setMode={setMode} route={route} routes={routeOptions} setRoute={(v) => pickRoute(v)} line={line} setLine={chooseLine} /></div>
            {!!data?.logistics.routes?.length && (
              <div className="mt-4 overflow-x-auto">
                <p className="mb-1 text-xs font-medium">Curse distribuție din Senior · {data.logistics.closedStart} – {data.logistics.closedEnd} exclusiv · clic pe un rând ca să alegi cursa</p>
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Cursă</th><th className="text-right">Curse</th><th className="text-right">Cost (lei)</th><th className="text-right">Lei/cursă</th><th className="text-right">Paleți livrați</th><th className="text-right">Paleți/cursă</th><th className="text-right">Lei/palet</th><th className="pl-3">Puncte de livrare incluse</th></tr></thead>
                  <tbody>
                    {data.logistics.routes.map((r) => (
                      <tr key={r.route} onClick={() => pickRoute(r.route)} className={`cursor-pointer border-b last:border-0 hover:bg-muted/50 ${r.route === route ? "bg-muted font-medium" : ""}`}>
                        <td className="py-1">{r.route}</td>
                        <td className="text-right tabular-nums">{r.trips}</td>
                        <td className="text-right tabular-nums">{n2(r.total)}</td>
                        <td className="text-right tabular-nums">{r.unitPrice != null ? `${n2(r.unitPrice)} lei/unitate` : `${n2(r.perTrip)} (${n2(r.pmin, 0)}–${n2(r.pmax, 0)})`}</td>
                        <td className="text-right tabular-nums">{n2(r.pallets, 1)}</td>
                        <td className="text-right tabular-nums">{n2(r.palletsPerTrip, 1)}</td>
                        <td className="text-right tabular-nums">{n2(r.perPallet)}</td>
                        <td className="pl-3 text-muted-foreground">{r.points.length ? r.points.slice(0, 4).map((x) => `${x.name} (${n2(x.pallets, 1)})`).join(", ") + (r.points.length > 4 ? ` +${r.points.length - 4}` : "") : "niciun punct atribuit — completează paleți pe cursă"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
          {!validPriceConfig(config) && <p className="text-sm text-destructive">Parametri invalizi: valori pozitive, pierderi și marjă sub 100%, bucăți/palet și bucăți/bax peste zero.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {data && product && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              <Button size="sm" variant="secondary" disabled={saving || !sheet} onClick={saveLive}>
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1 h-3.5 w-3.5" />}Salvează ca fișă live
              </Button>
              Apare în „Agenți & Rapoarte”; o recalculezi cu prețurile Senior la zi dintr-un clic, fără credite AI.
            </div>
          )}
        </CardContent>
      </Card>

      {data && sheet && (
        <>
          <div className="border-y py-3 text-xs text-muted-foreground space-y-1">
            <p>Materii prime: {mode === "annual" ? "media anuală ponderată" : "media ponderată ultimele 7 zile"}, până la {data.period.endDay} exclusiv. Ambalaje: ultima intrare NIR.</p>
            <p>Aprovizionare: {data.logistics.closedStart} – {data.logistics.closedEnd} exclusiv, cont 624.01 ÷ paleți NIR și ÷ kg materii prime NIR; ambele variante apar pe rând. Distribuție: cursa {route}{storeName ? ` (${storeName}${data.logistics.suggestedRoute && data.logistics.suggestedRoute === route && !routeManual ? ", propusă după oraș/județ" : ""})` : ""}. Manoperă: tabel octombrie 2026 (directă + regie fabrică 41%).</p>
            <p>{data.logistics.note}</p>
            {data.warnings?.map((w) => <p key={w} className="text-destructive">{w}</p>)}
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fișă preț · {data.product.name} · bax {sheet.s.unitsPerCase} buc</CardTitle>
              {!!data.warnings?.length && <p className="text-sm text-muted-foreground">Calcul orientativ: tarife istorice și repere configurate. Avertismentele de mai sus rămân de verificat.</p>}
              {!sheet.s.complete && <p className="text-sm text-destructive">Fișă incompletă — totaluri parțiale, nu preț final validat. De completat: {sheet.s.missingInputs.join("; ")}</p>}
              {sheet.s.missingPrices.length > 0 && <p className="text-sm text-destructive">Fără preț în Senior: {sheet.s.missingPrices.join(", ")} — completează prețul ca fișa să fie corectă.</p>}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr><th className="py-2">Componentă</th><th className="text-right">Rețetă</th><th className="text-right">PT %</th><th className="text-right">Cantitate cu pierdere</th><th className="text-right">Preț (lei/UM)</th><th className="text-right">kg / palet MP</th><th className="text-right">Valoare (lei/bax)</th></tr>
                </thead>
                <tbody>
                  {sheet.comps.map((c) => {
                    const line = sheet.s.lines.find((l) => l.label === c.name);
                    const eff = c.kind === "mp" ? c.qty / (1 - Math.min(c.lossPct, 95) / 100) : c.qty * (1 + c.lossPct / 100);
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-1.5">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">{c.kind === "mp" ? "Materie primă" : "Ambalaj"} · {c.priceSource}{c.lossSource ? ` · ${c.lossSource}` : ""}</div>
                        </td>
                        <td className="text-right"><NumericParameter label={`Cantitate ${c.name} (${c.unit})`} value={quantities[c.id] ?? String(c.qty)} onChange={(v) => setQuantities((p) => ({ ...p, [c.id]: v }))} /></td>
                        <td className="text-right"><Input aria-label={`PT ${c.name}`} className="ml-auto h-8 w-16 text-right" value={losses[c.id] ?? String(c.lossPct)} onChange={(e) => setLosses((p) => ({ ...p, [c.id]: e.target.value }))} /></td>
                        <td className="text-right tabular-nums">{n2(eff, 4)}</td>
                        <td className="text-right"><Input aria-label={`Preț ${c.name}`} className="ml-auto h-8 w-24 text-right" value={prices[c.id] ?? (c.price == null ? "" : String(Math.round(c.price * 10000) / 10000))} onChange={(e) => setPrices((p) => ({ ...p, [c.id]: e.target.value }))} /></td>
                        <td>{c.kind === "mp" ? <Input aria-label={`kg/palet ${c.name}`} className="ml-auto h-8 w-24 text-right" value={palletKg[c.id] ?? (c.kgPerPallet == null ? "" : String(c.kgPerPallet))} onChange={(e) => setPalletKg((p) => ({ ...p, [c.id]: e.target.value }))} /> : "—"}</td>
                        <td className="text-right font-medium tabular-nums">{n2(line?.value ?? 0, 4)}</td>
                      </tr>
                    );
                  })}
                  {sheet.s.lines.filter((l) => !sheet.comps.some((c) => c.name === l.label)).map((l) => (
                    <tr key={l.label} className="border-b last:border-0">
                      <td className="py-1.5" colSpan={6}><div className="font-medium">{l.label}</div><div className="text-[11px] text-muted-foreground">{l.detail}</div></td>
                      <td className="text-right font-medium tabular-nums">{n2(l.value, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Cost producție", sheet.s.productionCost, sheet.s.perPiece.productionCost],
                  [`Preț poartă fabrică (marjă ${display.marginPct || 0}%)`, sheet.s.factoryGate, sheet.s.perPiece.factoryGate],
                  ["Preț final livrare (+ logistic)", sheet.s.delivered, sheet.s.perPiece.delivered],
                  ["Preț livrare client (+ taxe)", sheet.s.clientPrice, sheet.s.perPiece.clientPrice],
                ].map(([l, bax, buc]) => (
                  <div key={String(l)} className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{l}</div>
                    <div className="text-lg font-semibold tabular-nums">{sheet.s.complete ? `${n2(bax as number)} lei/bax` : "Calcul incomplet"}</div>
                    <div className="text-sm tabular-nums text-muted-foreground">{sheet.s.complete ? `${n2(buc as number, 4)} lei/buc` : "Costuri lipsă — nu sunt zero"}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 rounded-lg border bg-muted/40 p-3 text-sm">
                {sheet.s.complete ? <>În EUR (curs {n2(sheet.s.eurEffective, 4)} cu marjă de siguranță): <b>{n2(sheet.s.clientPriceEur)} €/bax</b> · <b>{n2(sheet.s.perPiece.clientPriceEur, 4)} €/buc</b></> : "Prețul final EUR nu este disponibil până la calcularea tuturor costurilor."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Comparație cu prețul de vânzare</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {lastSale && sheet.s.complete ? (() => {
                const diff = (lastSale.price ?? 0) - sheet.s.perPiece.clientPrice;
                return (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Preț calculat</div><div className="text-lg font-semibold tabular-nums">{n2(sheet.s.perPiece.clientPrice, 4)} lei/buc</div></div>
                    <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Preț vânzare mediu {lastSale.month}</div><div className="text-lg font-semibold tabular-nums">{n2(lastSale.price, 4)} lei/buc</div></div>
                    <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Diferență (profit/pierdere pe bucată)</div><div className={`text-lg font-semibold tabular-nums ${diff >= 0 ? "text-primary" : "text-destructive"}`}>{n2(diff, 4)} lei · {n2((diff / (lastSale.price ?? 1)) * 100, 1)}%</div></div>
                  </div>
                );
              })() : <p className="text-sm text-muted-foreground">{!sheet.s.complete ? "Comparația este indisponibilă până la calcularea costului complet." : `Nu există vânzări pentru ${client ? "acest client" : "acest produs"} în ultimele 12 luni.`}</p>}
              {data.priceList && <Badge variant="secondary">Listă de preț Senior: {n2(data.priceList.price, 4)} {data.priceList.currency} · {data.priceList.list} (din {data.priceList.since})</Badge>}
              {data.salesHistory.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Luna</th><th className="text-right">Bucăți vândute</th><th className="text-right">Valoare (lei)</th><th className="text-right">Preț mediu (lei/buc)</th><th className="text-right">vs calculat</th></tr></thead>
                    <tbody>
                      {data.salesHistory.map((h) => (
                        <tr key={h.month} className="border-b last:border-0">
                          <td className="py-1">{h.month}</td><td className="text-right tabular-nums">{n2(h.qty, 0)}</td><td className="text-right tabular-nums">{n2(h.value)}</td>
                          <td className="text-right tabular-nums">{n2(h.price, 4)}</td>
                          <td className={`text-right tabular-nums ${h.price != null && h.price >= sheet.s.perPiece.clientPrice ? "text-primary" : "text-destructive"}`}>{h.price == null ? "—" : n2(h.price - sheet.s.perPiece.clientPrice, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
