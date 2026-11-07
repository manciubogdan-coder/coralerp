import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, Check, ChevronDown, ChevronRight, ChevronsUpDown, Download, Loader2, RefreshCw, RotateCcw, X, Zap } from "lucide-react";
import * as XLSX from "xlsx";
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
import { CLIENT_AVERAGE_ROUTE, clientAverageRoute, profitAt } from "../../../supabase/functions/_shared/priceList";
import { countyKey } from "../../../supabase/functions/_shared/priceSourceRules";
import { PriceParameters, NumericParameter } from "./PriceParameters";
import { prefilledConfig } from "../../../supabase/functions/_shared/priceDefaults";
import { ReceiptPriceAlert } from '../inventory/ReceiptPriceAlert';
import { priceRules, setPriceRules, type RulesMeta } from "../../../supabase/functions/_shared/priceRules";
import PriceRulesEditor from "./PriceRulesEditor";

type Opt = { id: number; name: string };
type Client = Opt & { stores: number };
type Product = Opt & { qty: number };
type Store = Opt & { route: string | null };
type RouteStat = { route: string; country: string; trips: number; total: number; pallets: number; estimatedPallets?: number; perPallet: number | null; perTrip: number | null; palletsPerTrip: number | null; unitPrice: number | null; pmin: number; pmax: number; points: Array<{ name: string; pallets: number }>; pool?: { routes: string[]; total: number; pallets: number; trips: number } };
type CountyGap = { county: string; judet: string; pallets: number; points: number; names: string[] };
type Logistics = {
  supply: { total: number; trucks: number; costPerTruck: number | null; loadTrucks: number; pallets: number; kg: number; palletsPerTruck: number | null; kgPerTruck: number | null; orderedRows?: Array<{ name: string; unit: string; kg: number; kgPerPallet: number | null; piecesPerPallet?: number | null; pallets: number }>; orderedLoads?: Array<{ supplier: string; day: string; pallets: number; trucks: number }>; invoiceTrucks90?: number };
  loadWindow: { start: string; end: string }; lastTrucks: Array<{ day: string; price: number; line: string; qty?: number; value?: number; supplier?: string; truck?: boolean }>;
  closedStart: string; closedEnd: string; note: string; distribution?: Record<string, PriceConfig | null>; routes?: RouteStat[];
  clientAverage: { perPallet: number; pallets: number; weighted: boolean; stores: number } | null;
  unassigned?: CountyGap[];
  store?: { id: number; name: string; route: string | null } | null; suggestedRoute?: string | null;
};
type StoreSale = { pid: number; qty: number; value: number; price: number | null };
type StoreRow = { pid: number; name: string; judet?: string; route: string | null; proposed?: string | null; manual?: boolean; pallets: number };
type RealSpeed = { speed: number; pieces: number; hours: number; sessions: number; products: string[]; from: string; to: string };
type Item = {
  product: { id: number; name: string; unitsPerCase: number };
  defaults: PriceConfig; warnings: string[]; components: SheetComponent[]; suggestedLabourSource?: string; realSpeed?: RealSpeed | null;
  salesHistory: Array<{ month: string; qty: number; value: number; price: number | null }>;
  storeSales: StoreSale[]; recentSale: { qty: number; value: number; price: number; from: string; to: string } | null;
  priceList: { price: number; currency: string; list: string; since: string } | null;
};
type Fees = { pct: number | null; discounts: number; services: Array<{ subject: string; account: string; total: number }>; servicesTotal: number; sales: number; from: string; to: string } | null;
type ListResult = {
  period: { startDay: string; endDay: string }; warnings: string[]; info?: string[]; fees?: Fees; eur: { rate: number; day: string } | null;
  stores: StoreRow[]; logistics: Logistics; rules?: RulesMeta;
  items: Array<Item | { product: { id: number; name: string }; error: string }>;
};
type Over = { rates: Record<string, string>; prices: Record<number, string>; losses: Record<number, string>; quantities: Record<number, string>; palletKg: Record<number, string>; line?: string };
type Computed = { s: ReturnType<typeof configuredSheet>["sheet"]; comps: SheetComponent[]; rates: ReturnType<typeof configuredSheet>["rates"]; effective: PriceConfig; cfg: PriceConfig };

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const n2 = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (s: string) => Number(String(s).replace(",", "."));
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const KIND_LABEL: Record<SheetComponent["kind"], string> = { mp: "Materie primă", marfa: "Marfă revândută ca atare", ambalaj: "Ambalaj" };
const LABOUR_FIELDS = ["labourPerPiece", "utilitiesPerPiece", "labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"];
/** Edits that belong to one product; transport, margin, fees and EUR apply to the whole list. */
const PRODUCT_KEYS = new Set(["unitsPerCase", "piecesPerPallet", ...LABOUR_FIELDS]);
const DIST_KEYS = ["distributionTotal", "distributionPallets", "distributionPerPallet", "distributionTrips", "distributionPalletsPerTrip"];
const EMPTY: Over = { rates: {}, prices: {}, losses: {}, quantities: {}, palletKg: {} };
const isItem = (x: ListResult["items"][number]): x is Item => !("error" in x);
const ZERO = (eur: number) => ({ labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: eur, eurBufferPct: priceRules().eurBufferPct, techLossPct: 0, marginPct: 0 });
const OVERRIDES_KEY = "argus-price-route-overrides";
const loadOverrides = (): Record<string, string> => { try { const v = JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const sheetName = (i: number, name: string) => `${i + 1}. ${name}`.replace(/[\\/:*?"<>|[\]]/g, " ").slice(0, 31);

/** A changed total or volume recalculates its tariff unless the tariff itself is typed afterwards. */
function applyEdit(p: Record<string, string>, k: string, v: string) {
  const next = { ...p, [k]: v };
  if (k === "supplyTotal" || k === "supplyPallets") delete next.supplyPerPallet;
  if (k === "supplyTotal" || k === "supplyKg") delete next.supplyPerKg;
  if (["distributionTotal", "distributionPallets", "distributionTrips", "distributionPalletsPerTrip"].includes(k)) delete next.distributionPerPallet;
  if (k === "distributionPallets") delete next.distributionPalletsPerTrip;
  if (["labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"].includes(k)) { delete next.labourPerPiece; delete next.utilitiesPerPiece; }
  return next;
}

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

function MultiPicker({ label, options, value, onChange }: { label: string; options: Opt[]; value: number[]; onChange: (v: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const set = new Set(value);
  const toggle = (id: number) => onChange(set.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            <span className="truncate">{value.length ? `${value.length} produse alese` : "Alege produsele"}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Caută produs…" />
            <div className="flex gap-2 border-b p-2">
              <Button size="sm" variant="secondary" className="h-7" onClick={() => onChange(options.slice(0, 60).map((o) => o.id))}>Toate{options.length > 60 ? " (primele 60)" : ` (${options.length})`}</Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => onChange([])}>Niciunul</Button>
            </div>
            <CommandList className="max-h-72 overflow-y-auto">
              <CommandEmpty>Nimic găsit.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.id} value={`${o.name} ${o.id}`} onSelect={() => toggle(o.id)}>
                    <Check className={`mr-2 h-4 w-4 ${set.has(o.id) ? "opacity-100" : "opacity-0"}`} />{o.name}
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
      <Input aria-label={label} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

const profitClass = (v: number | null | undefined) => (v == null ? "" : v >= 0 ? "text-crm-green" : "text-destructive");
const selectClass = "h-8 rounded-md border border-input bg-background px-2 text-xs";

function PriceListCalculator({ rulesVersion }: { rulesVersion: number }) {
  const now = new Date();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [client, setClient] = useState<number | null>(null);
  const [store, setStore] = useState<number | null>(null);
  const [onlySold, setOnlySold] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ListResult | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [globalRates, setGlobalRates] = useState<Record<string, string>>({});
  const [over, setOver] = useState<Record<number, Over>>({});
  const [mode, setMode] = useState<"annual" | "week">("annual");
  const [route, setRoute] = useState("România");
  const [routeManual, setRouteManual] = useState(false);
  const [basis, setBasis] = useState<"pallet" | "kg">("pallet");
  const [routeOverrides, setRouteOverrides] = useState<Record<string, string>>(loadOverrides);
  const [ranOverrides, setRanOverrides] = useState("{}");
  const [ranRules, setRanRules] = useState(rulesVersion);

  useEffect(() => {
    let off = false;
    setLoadingOpts(true);
    argusFetch<{ clients: Client[]; products: Product[]; stores?: Store[] }>("price_options", {}, { partnerId: client, allProducts: !onlySold, routeOverrides })
      .then((r) => {
        if (off) return;
        setClients(r.clients); setProducts(r.products); setStores(r.stores ?? []);
      })
      .catch((e) => !off && setError(e.message))
      .finally(() => !off && setLoadingOpts(false));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, onlySold]);

  const items = useMemo(() => (result?.items ?? []).filter(isItem), [result]);
  const failed = useMemo(() => (result?.items ?? []).filter((x) => !isItem(x)) as Array<{ product: { id: number; name: string }; error: string }>, [result]);
  const ov = (id: number) => over[id] ?? EMPTY;
  const setOv = (id: number, f: (o: Over) => Over) => setOver((p) => ({ ...p, [id]: f(p[id] ?? EMPTY) }));
  const toggle = (id: number) => setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const setOverride = (k: string, v: string) => setRouteOverrides((p) => {
    const n = { ...p };
    if (v) n[k] = v; else delete n[k];
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(n));
    return n;
  });
  const overridesDirty = !!result && JSON.stringify(routeOverrides) !== ranOverrides;

  const run = async () => {
    if (!selected.length) return;
    setLoading(true); setError(null);
    try {
      const r = await argusFetch<ListResult>("price_list", {}, { articolIds: selected, partnerId: client, storeId: store, year, month, rawPriceMode: mode, routeOverrides });
      // Rules read on the server for this run: the screen computes with the same ones.
      if (r.rules) setPriceRules(r.rules.rules);
      setRanRules(rulesVersion);
      setResult(r);
      setRanOverrides(JSON.stringify(routeOverrides));
      // The client's cursă (or the pallet-weighted client average) is proposed unless the user picked a cursă by hand.
      const first = r.items.find(isItem);
      if (!routeManual) { setRoute(first?.defaults.route ?? "România"); setGlobalRates((p) => { const n = { ...p }; for (const k of DIST_KEYS) delete n[k]; return n; }); }
      if (r.items.length === 1 && first) setOpen(new Set([first.product.id]));
    } catch (e) { setError((e as Error).message); setResult(null); }
    finally { setLoading(false); }
  };

  // Store cursă: the user's store choice, then the county choice, then the address proposal — applied instantly to the client average.
  const routeOf = (st: StoreRow) => routeOverrides[`p:${st.pid}`] ?? routeOverrides[`j:${countyKey(st.judet)}`] ?? st.proposed ?? st.route;
  const perPalletMap = useMemo(() => Object.fromEntries(Object.entries(result?.logistics.distribution ?? {}).filter(([k]) => k !== CLIENT_AVERAGE_ROUTE).map(([k, v]) => [k, v?.distributionPerPallet ?? null])), [result]);
  const storesNow = useMemo(() => (result?.stores ?? []).map((st) => ({ ...st, route: routeOf(st) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, routeOverrides]);
  const logistics = useMemo<Logistics | null>(() => {
    if (!result) return null;
    const avg = client != null && store == null && storesNow.length ? clientAverageRoute(storesNow, perPalletMap) : null;
    if (!avg) return result.logistics;
    const dist = avg.weighted ? { distributionTotal: avg.allocated!, distributionPallets: avg.pallets, distributionPerPallet: avg.perPallet } : { distributionPerPallet: avg.perPallet };
    return { ...result.logistics, distribution: { ...result.logistics.distribution, [CLIENT_AVERAGE_ROUTE]: dist }, clientAverage: avg };
  }, [result, storesNow, perPalletMap, client, store]);

  const buildConfig = (it: Item, routeOverride?: string): PriceConfig => {
    const o = ov(it.product.id);
    const line = o.line ?? it.defaults.labourLine ?? "";
    const cfg: PriceConfig = { year, month, rawPriceMode: mode, route: routeOverride ?? route, supplyBasis: basis, ...(line ? { labourLine: line } : {}), rates: {}, components: {} };
    const vals: Record<string, string> = { ...Object.fromEntries(Object.entries(globalRates).filter(([k]) => !PRODUCT_KEYS.has(k))), ...o.rates };
    if (routeOverride) for (const k of DIST_KEYS) delete vals[k];
    for (const k of RATE_KEYS) if (vals[k] != null && vals[k] !== "") cfg.rates = { ...cfg.rates, [k]: num(vals[k]) };
    for (const k of CONFIG_NUMBERS) if (vals[k] != null && vals[k] !== "") Object.assign(cfg, { [k]: num(vals[k]) });
    for (const c of it.components) {
      const x: { price?: number; qty?: number; lossPct?: number; kgPerPallet?: number; piecesPerPallet?: number } = {};
      if (o.prices[c.id] != null && o.prices[c.id] !== "") x.price = num(o.prices[c.id]);
      if (o.losses[c.id] != null && o.losses[c.id] !== "") x.lossPct = num(o.losses[c.id]);
      if (o.quantities[c.id] != null && o.quantities[c.id] !== "") x.qty = num(o.quantities[c.id]);
      // Traded goods: the pallet field holds pieces per pallet.
      if (o.palletKg[c.id] != null && o.palletKg[c.id] !== "") x[c.kind === "marfa" ? "piecesPerPallet" : "kgPerPallet"] = num(o.palletKg[c.id]);
      cfg.components = { ...cfg.components, [c.id]: x };
    }
    return cfg;
  };
  const compute = (it: Item, cfg: PriceConfig): Computed | null => {
    if (!result || !logistics || !validPriceConfig(cfg)) return null;
    const comps = it.components.map((c) => ({ ...c, ...(c.kind === "mp" || c.kind === "marfa" ? { price: mode === "week" ? c.weekPrice ?? null : c.annualPrice ?? null } : {}) }));
    // The proposed cursă follows the store routes chosen on screen (client average recomputed locally).
    const base = it.defaults.route ? { ...it.defaults } : it.defaults;
    if (it.defaults.route && logistics.distribution?.[it.defaults.route]) { for (const k of DIST_KEYS) delete (base as Record<string, unknown>)[k]; Object.assign(base, logistics.distribution[it.defaults.route]); }
    const effective = prefilledConfig({ ...it, defaults: base, logistics }, cfg);
    const r = configuredSheet({ ...it, components: comps }, ZERO(result.eur?.rate ?? 0), effective);
    return { s: r.sheet, comps: r.components, rates: r.rates, effective, cfg };
  };
  const sheets = useMemo(() => new Map(items.map((it) => [it.product.id, compute(it, buildConfig(it))])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, result, logistics, globalRates, over, mode, route, basis, year, month, rulesVersion]);

  /** Values shown in the fields: calculated from Senior/CSV unless the user typed one. */
  const displayFor = (it: Item | null, c: Computed | null, rates: Record<string, string>) => {
    const out: Record<string, string> = {};
    const fmt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : "");
    for (const k of CONFIG_NUMBERS) out[k] = rates[k] ?? fmt(c?.effective[k]);
    for (const k of RATE_KEYS) {
      const used = k === "labourPerPiece" || k === "utilitiesPerPiece" ? (c?.effective.rates?.[k] ?? (c && lineLabour(c.effective) ? c.rates[k] : undefined)) : c?.effective.rates?.[k];
      out[k] = rates[k] ?? fmt(used);
    }
    void it;
    return out;
  };
  const globalOnly = useMemo(() => Object.fromEntries(Object.entries(globalRates).filter(([k]) => !PRODUCT_KEYS.has(k))), [globalRates]);
  const globalDisplay = useMemo(() => displayFor(items[0] ?? null, items[0] ? sheets.get(items[0].product.id) ?? null : null, globalOnly),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, sheets, globalOnly]);
  const marginShown = globalRates.marginPct ?? globalDisplay.marginPct ?? String(priceRules().marginPct);

  const setGlobal = (k: string, v: string) => setGlobalRates((p) => applyEdit(p, k, v));
  const setProduct = (id: number, k: string, v: string) => setOv(id, (o) => ({ ...o, rates: applyEdit(o.rates, k, v) }));
  const chooseLine = (id: number, v: string) => setOv(id, (o) => { const r = { ...o.rates }; for (const k of LABOUR_FIELDS) delete r[k]; return { ...o, rates: r, line: v }; });
  const clearDistribution = () => setGlobalRates((p) => { const n = { ...p }; for (const k of DIST_KEYS) delete n[k]; return n; });
  const pickRoute = (v: string, manual = true) => { setRoute(v); setRouteManual(manual); clearDistribution(); };
  const chooseClient = (v: number | null) => { setClient(v); setStore(null); setRouteManual(false); setResult(null); };
  const chooseStore = (v: number | null) => { setStore(v); setRouteManual(false); setResult(null); };
  const routeNames = useMemo(() => (logistics?.routes ?? []).map((r) => r.route), [logistics]);
  const routeOptions = useMemo(() => [
    ...(logistics?.clientAverage ? [{ value: CLIENT_AVERAGE_ROUTE, label: `Medie client (toate magazinele) · ${n2(logistics.clientAverage.perPallet)} lei/palet` }] : []),
    ...(logistics?.routes ?? []).map((r) => ({ value: r.route, label: `${r.route} · ${r.perPallet != null ? `${n2(r.perPallet)} lei/palet` : r.perTrip != null ? `${n2(r.perTrip)} lei/cursă, fără paleți atribuiți` : "fără curse"}` })),
    { value: "România", label: "Media curselor interne" },
  ], [logistics]);
  const clientName = clients.find((c) => c.id === client)?.name ?? "";
  const storeName = stores.find((x) => x.id === store)?.name ?? result?.logistics.store?.name;
  const routeLabel = (r: string) => (r === CLIENT_AVERAGE_ROUTE ? "medie client (toate magazinele, ponderat cu paleții)" : r);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const multiStore = !!result && client != null && store == null && result.stores.length > 1;

  // Per store, one product: the store's own cursă against what the store actually pays.
  const storeRowsFor = (it: Item) => {
    if (!multiStore) return [];
    return storesNow.map((st) => {
      const r = st.route && logistics?.distribution?.[st.route] ? st.route : null;
      const c = r ? compute(it, buildConfig(it, r)) : null;
      const sale = it.storeSales.find((x) => x.pid === st.pid) ?? null;
      const pr = c && c.s.complete && sale?.price != null ? profitAt(c.s, sale.price) : null;
      return { ...st, route: r, sheet: c?.s ?? null, perPallet: c?.effective.distributionPerPallet ?? null, sale, profit: pr };
    }).sort((a, b) => (b.sale?.qty ?? 0) - (a.sale?.qty ?? 0));
  };
  // Every store across the whole list: which store brings profit and which does not.
  const storeTotals = useMemo(() => {
    if (!multiStore) return [];
    return storesNow.map((st) => {
      const r = st.route && logistics?.distribution?.[st.route] ? st.route : null;
      let sales = 0, profit = 0, qty = 0, incomplete = 0;
      for (const it of items) {
        const sale = it.storeSales.find((x) => x.pid === st.pid);
        if (!sale || sale.price == null) continue;
        const c = r ? compute(it, buildConfig(it, r)) : null;
        if (!c || !c.s.complete) { incomplete++; continue; }
        const p = profitAt(c.s, sale.price);
        sales += sale.value; profit += p.profit * sale.qty; qty += sale.qty;
      }
      return { ...st, route: r, sales, profit, qty, incomplete, pct: sales > 0 ? (profit / sales) * 100 : null };
    }).sort((a, b) => b.sales - a.sales);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiStore, storesNow, logistics, items, sheets]);

  const listRows = useMemo(() => items.map((it) => {
    const c = sheets.get(it.product.id) ?? null;
    const s = c?.s ?? null;
    const sale = it.recentSale;
    const pr = s && s.complete && sale ? profitAt(s, sale.price) : null;
    return { it, c, s, sale, profit: pr };
  }), [items, sheets]);
  const totals = useMemo(() => {
    const rows = listRows.filter((r) => r.profit && r.sale);
    const sales = rows.reduce((t, r) => t + r.sale!.value, 0), profit = rows.reduce((t, r) => t + r.profit!.profit * r.sale!.qty, 0);
    return rows.length ? { sales, profit, pct: sales > 0 ? (profit / sales) * 100 : null, n: rows.length } : null;
  }, [listRows]);
  const incompleteCount = listRows.filter((r) => !r.s?.complete).length;

  const [saving, setSaving] = useState<number | null>(null);
  const saveLive = async (it: Item) => {
    const margin = num(marginShown || "0");
    const where = storeName && store != null ? storeName : clientName;
    setSaving(it.product.id);
    try {
      const r = await argusFetch<any>("live_save", {}, {
        kind: "price", articolId: it.product.id, partnerId: client, storeId: store, scope: "central", routeOverrides, marginPct: margin, config: buildConfig(it), year, month, product: it.product.name, client: where,
        title: `Fișă preț — ${it.product.name}${where ? ` · ${where}` : ""}${margin ? ` · marjă ${margin}%` : ""}`,
      });
      toast({ title: "Fișă live salvată", description: r.firstRunOk ? "O găsești în „Agenți & Rapoarte”. Actualizează oricând, fără credite AI." : "Salvată; prima recalculare a eșuat, încearcă Actualizează." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Nu s-a putut salva", description: e.message });
    } finally { setSaving(null); }
  };

  const sheetRows = (it: Item, c: Computed) => {
    const n = c.s.unitsPerCase;
    const rows: (string | number)[][] = [
      ["Fișă preț", it.product.name], ["Client", clientName || "Toți clienții"], ["Magazin", store != null ? storeName ?? "" : "Toate magazinele"],
      ["Perioadă", `${String(month).padStart(2, "0")}/${year}`], ["Bucăți / bax", n], ["Bucăți / palet", c.effective.piecesPerPallet ?? ""], ["Linie de producție", c.effective.labourLine ?? "nealeasă"],
      ["Sursă manoperă", it.suggestedLabourSource ?? ""], ["Cursă distribuție", routeLabel(route)], ["Marjă brută %", num(marginShown || "0")], ["Taxe client %", r4(c.s.feePct)], [],
      ["Componentă", "Tip", "UM", "Rețetă", "PT %", "Preț (lei/UM)", "Valoare (lei/bax)", "Valoare (lei/buc)", "Sursă"],
    ];
    for (const comp of c.comps) {
      const l = c.s.lines.find((x) => x.label === comp.name);
      rows.push([comp.name, KIND_LABEL[comp.kind], comp.unit, r4(comp.qty), comp.lossPct, r4(comp.price ?? 0), r4(l?.value ?? 0), r4((l?.value ?? 0) / n), [comp.priceSource, comp.lossSource, comp.palletSource].filter(Boolean).join(" · ")]);
    }
    for (const l of c.s.lines.filter((x) => !c.comps.some((k) => k.name === x.label))) rows.push([l.label, "", "", "", "", "", r4(l.value), r4(l.value / n), l.detail]);
    rows.push([], ["Rezultat", "", "", "", "", "", "lei/bax", "lei/buc"]);
    for (const [l, b, p] of [
      ["Materii prime", c.s.rawMaterial, c.s.rawMaterial / n], ["Transport aprovizionare", c.s.supplyTransport, c.s.supplyTransport / n], ["Ambalaje", c.s.packaging, c.s.packaging / n],
      ["Manoperă + regie", c.s.labour + c.s.utilities, (c.s.labour + c.s.utilities) / n],
      ["Cost producție", c.s.productionCost, c.s.perPiece.productionCost], ["Marjă brută", c.s.grossMargin, c.s.perPiece.grossMargin],
      ["Preț poartă fabrică", c.s.factoryGate, c.s.perPiece.factoryGate], ["Transport distribuție", c.s.logistics, c.s.perPiece.logistics],
      ["Taxe client", c.s.clientFees, c.s.perPiece.fees], ["Preț propus client", c.s.clientPrice, c.s.perPiece.clientPrice], ["Preț propus EUR", c.s.clientPriceEur, c.s.perPiece.clientPriceEur],
    ] as [string, number, number][]) rows.push([l, "", "", "", "", "", r4(b), r4(p)]);
    if (it.recentSale && c.s.complete) {
      const p = profitAt(c.s, it.recentSale.price);
      rows.push([], ["Preț vânzare actual (90 zile, lei/buc)", r4(it.recentSale.price)], ["Bucăți vândute 90 zile", Math.round(it.recentSale.qty)], ["Profit real (lei/buc)", r4(p.profit)], ["Profit real %", p.pct != null ? Math.round(p.pct * 10) / 10 : ""]);
    }
    if (!c.s.complete) rows.push([], ["Fișă incompletă", [...c.s.missingInputs, ...c.s.missingPrices].join("; ")]);
    if (it.warnings.length) { rows.push([], ["Avertismente"]); for (const w of it.warnings) rows.push([w]); }
    return rows;
  };
  const exportExcel = () => {
    if (!result || !items.length) return;
    const wb = XLSX.utils.book_new();
    const head: (string | number)[][] = [
      ["Listă de prețuri", clientName || "Toți clienții"], ["Magazin", store != null ? storeName ?? "" : "Toate magazinele (medie)"],
      ["Perioadă", `${String(month).padStart(2, "0")}/${year}`], ["Marjă brută %", num(marginShown || "0")], ["Cursă distribuție", routeLabel(route)],
      ["Transport", `ultimele prețuri: cost pe camion/cursă din facturile ${result.logistics.closedStart} – ${result.logistics.closedEnd}; încărcare din ${result.logistics.loadWindow.start} – ${result.logistics.loadWindow.end}`], [],
      ["Produs", "Buc/bax", "Cost producție (lei/buc)", "Distribuție (lei/buc)", "Taxe client (lei/buc)", "Marjă brută (lei/buc)", "Marjă brută %", "Preț propus (lei/buc)", "Preț propus (lei/bax)", "Preț propus (EUR/buc)", "Preț vânzare actual (lei/buc)", "Bucăți vândute 90 zile", "Profit real (lei/buc)", "Profit real %", "Stare"],
    ];
    for (const r of listRows) {
      const s = r.s;
      head.push([r.it.product.name, s?.unitsPerCase ?? "", s ? r4(s.perPiece.productionCost) : "", s ? r4(s.perPiece.logistics) : "", s ? r4(s.perPiece.fees) : "", s ? r4(s.perPiece.grossMargin) : "", num(marginShown || "0"),
        s ? r4(s.perPiece.clientPrice) : "", s ? r4(s.clientPrice) : "", s ? r4(s.perPiece.clientPriceEur) : "", r.sale ? r4(r.sale.price) : "", r.sale ? Math.round(r.sale.qty) : "",
        r.profit ? r4(r.profit.profit) : "", r.profit?.pct != null ? Math.round(r.profit.pct * 10) / 10 : "", s?.complete ? "calculat" : `incomplet: ${[...(s?.missingInputs ?? []), ...(s?.missingPrices ?? [])].join("; ")}`]);
    }
    for (const f of failed) head.push([f.product.name, "", "", "", "", "", "", "", "", "", "", "", "", "", f.error]);
    if (totals) head.push([], ["Total ultimele 90 de zile", "", "", "", "", "", "", "", "", "", r4(totals.sales), "", r4(totals.profit), totals.pct != null ? Math.round(totals.pct * 10) / 10 : ""]);
    const ws = XLSX.utils.aoa_to_sheet(head);
    ws["!cols"] = [{ wch: 40 }, ...Array(14).fill({ wch: 14 })];
    XLSX.utils.book_append_sheet(wb, ws, "Listă prețuri");
    if (multiStore) {
      const rows: (string | number)[][] = [["Magazin", "Cursă", "Paleți livrați 90 zile", "Vânzări 90 zile (lei)", "Profit real 90 zile (lei)", "Profit real %"]];
      for (const st of storeTotals) rows.push([st.name, st.route ?? "fără cursă", r4(st.pallets), r4(st.sales), r4(st.profit), st.pct != null ? Math.round(st.pct * 10) / 10 : ""]);
      rows.push([], ["Produs", "Magazin", "Cursă", "Distribuție (lei/palet)", "Distribuție (lei/buc)", "Preț propus (lei/buc)", "Preț vânzare actual (lei/buc)", "Bucăți vândute 90 zile", "Profit real (lei/buc)", "Profit real %"]);
      for (const it of items) for (const st of storeRowsFor(it)) {
        if (!st.sale && !st.sheet) continue;
        rows.push([it.product.name, st.name, st.route ?? "fără cursă", st.perPallet != null ? r4(st.perPallet) : "", st.sheet ? r4(st.sheet.perPiece.logistics) : "", st.sheet?.complete ? r4(st.sheet.perPiece.clientPrice) : "",
          st.sale?.price != null ? r4(st.sale.price) : "", st.sale ? Math.round(st.sale.qty) : "", st.profit ? r4(st.profit.profit) : "", st.profit?.pct != null ? Math.round(st.profit.pct * 10) / 10 : ""]);
      }
      const ws2 = XLSX.utils.aoa_to_sheet(rows);
      ws2["!cols"] = [{ wch: 36 }, { wch: 40 }, ...Array(8).fill({ wch: 14 })];
      XLSX.utils.book_append_sheet(wb, ws2, "Rentabilitate magazine");
    }
    // One price sheet per product.
    listRows.forEach((r, i) => {
      if (!r.c) return;
      const ws3 = XLSX.utils.aoa_to_sheet(sheetRows(r.it, r.c));
      ws3["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 70 }];
      XLSX.utils.book_append_sheet(wb, ws3, sheetName(i, r.it.product.name));
    });
    XLSX.writeFile(wb, `Lista preturi - ${(clientName || "toti clientii").replace(/[\\/:*?"<>|]/g, "")}.xlsx`);
  };

  /** Full price breakdown of one product, opened under its row; every value can be changed for this product. */
  const renderSheet = (it: Item, c: Computed | null) => {
    const id = it.product.id, o = ov(id);
    if (!c) return <p className="p-3 text-sm text-destructive">Parametri invalizi: valori pozitive, pierderi și marjă sub 100%, bucăți/palet și bucăți/bax peste zero.</p>;
    const s = c.s, n = s.unitsPerCase;
    const line = o.line ?? it.defaults.labourLine ?? "";
    const productRates = Object.fromEntries(Object.entries(o.rates).filter(([k]) => PRODUCT_KEYS.has(k)));
    const values = displayFor(it, c, productRates);
    const edited = Object.keys(o.rates).length + Object.keys(o.prices).length + Object.keys(o.losses).length + Object.keys(o.quantities).length + Object.keys(o.palletKg).length + (o.line != null ? 1 : 0);
    const rows = storeRowsFor(it);
    const p = it.recentSale && s.complete ? profitAt(s, it.recentSale.price) : null;
    const parts: Array<[string, number, string]> = [
      ["Materii prime", s.rawMaterial, ""], ["Transport aprovizionare", s.supplyTransport, ""], ["Ambalaje", s.packaging, ""], ["Manoperă + regie", s.labour + s.utilities, ""],
      ...(s.techLoss ? [["Pierdere scenariu", s.techLoss, ""] as [string, number, string]] : []),
      ["Cost producție", s.productionCost, "font-semibold"], [`Marjă brută (${marginShown}%)`, s.grossMargin, "text-primary"], ["Preț poartă fabrică", s.factoryGate, ""],
      [`Distribuție · ${routeLabel(route)}`, s.logistics, ""], [`Taxe client (${n2(s.feePct, 2)}%)`, s.clientFees, ""], ["Preț propus client", s.clientPrice, "font-bold"],
    ];
    return (
      <div className="space-y-4 border-l-2 border-primary bg-muted/20 p-3">
        {it.components.filter((x) => x.priceSafety?.suspect).map((x) => x.priceSafety ? <ReceiptPriceAlert key={x.id} safety={x.priceSafety} name={x.name} /> : null)}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={s.complete ? "secondary" : "destructive"}>{s.complete ? "Fișă completă" : "Fișă incompletă"}</Badge>
          <span className="text-xs text-muted-foreground">bax {n} buc · {c.effective.piecesPerPallet ? `${n2(c.effective.piecesPerPallet, 0)} buc/palet` : "buc/palet lipsă"} · {line || "linie nealeasă"}</span>
          <div className="ml-auto flex gap-2">
            {edited > 0 && <Button size="sm" variant="ghost" onClick={() => setOver((x) => { const nx = { ...x }; delete nx[id]; return nx; })}><RotateCcw className="mr-1 h-3.5 w-3.5" />Anulează modificările ({edited})</Button>}
            <Button size="sm" variant="secondary" disabled={saving === id} onClick={() => saveLive(it)}>
              {saving === id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1 h-3.5 w-3.5" />}Salvează fișa ca live
            </Button>
          </div>
        </div>
        {!s.complete && <p className="text-sm text-destructive">De completat: {[...s.missingInputs, ...s.missingPrices.map((x) => `preț ${x}`)].join("; ")}</p>}
        {it.warnings.map((w) => <p key={w} className="text-sm text-destructive">{w}</p>)}

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {parts.map(([l, bax, cls]) => (
            <div key={l} className="rounded-md border bg-background p-2">
              <div className="text-[11px] text-muted-foreground">{l}</div>
              <div className={`tabular-nums ${cls}`}>{n2(bax / n, 4)} <span className="text-[11px] text-muted-foreground">lei/buc</span></div>
              <div className="text-[11px] tabular-nums text-muted-foreground">{n2(bax)} lei/bax · {s.clientPrice > 0 ? n2((bax / s.clientPrice) * 100, 1) : "—"}%</div>
            </div>
          ))}
          <div className="rounded-md border bg-background p-2">
            <div className="text-[11px] text-muted-foreground">Preț propus EUR</div>
            <div className="tabular-nums">{n2(s.perPiece.clientPriceEur, 4)} <span className="text-[11px] text-muted-foreground">€/buc</span></div>
            <div className="text-[11px] tabular-nums text-muted-foreground">curs {n2(s.eurEffective, 4)} cu siguranță</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="py-2">Componentă (rețetă Senior pe bax)</th><th className="text-right">Cantitate</th><th className="text-right">PT %</th><th className="text-right">Cu pierdere</th><th className="text-right">Preț (lei/UM)</th><th className="text-right">kg (buc) / palet</th><th className="text-right">lei/bax</th><th className="text-right">lei/buc</th></tr>
            </thead>
            <tbody>
              {c.comps.map((x) => {
                const l = s.lines.find((y) => y.label === x.name);
                const weighed = x.kind === "mp" || x.kind === "marfa";
                const eff = weighed ? x.qty / (1 - Math.min(x.lossPct, 95) / 100) : x.qty * (1 + x.lossPct / 100);
                return (
                  <tr key={x.id} className="border-b last:border-0">
                    <td className="py-1.5">
                      <div className={`font-medium ${x.priceSafety?.suspect ? 'text-crm-warning' : ''}`}>{x.name}{x.priceSafety?.suspect ? ' · NIR suspect' : ''}</div>
                      <div className="text-[11px] text-muted-foreground">{KIND_LABEL[x.kind]} · {[x.priceSource, x.lossSource, x.palletSource].filter(Boolean).join(" · ")}</div>
                      {weighed && <div className="text-[11px] tabular-nums">Medie anuală <b>{x.annualPrice != null ? n2(x.annualPrice, 4) : "—"}</b> · ultimă săptămână <b>{x.weekPrice != null ? n2(x.weekPrice, 4) : "—"}</b> · ultima intrare <b>{x.lastPrice != null ? n2(x.lastPrice, 4) : "—"}</b> lei/{x.unit}</div>}
                      <details className="text-[11px]">
                        <summary className="cursor-pointer text-primary">Cum s-a calculat</summary>
                        <div className="mt-1 space-y-0.5 rounded bg-muted/40 p-2">
                          <div>1. Cantitate din rețeta Senior: {n2(x.qty, 4)} {x.unit} pe bax.</div>
                          <div>2. Cu pierdere ({n2(x.lossPct, 2)}%): {weighed ? `${n2(x.qty, 4)} ÷ (1 − ${n2(x.lossPct, 2)}%)` : `${n2(x.qty, 4)} × (1 + ${n2(x.lossPct, 2)}%)`} = <b>{n2(eff, 4)} {x.unit}</b>.</div>
                          <div>3. Preț folosit: {x.price != null ? n2(x.price, 4) : "lipsă"} lei/{x.unit} ({weighed ? (mode === "week" ? "media ultimei săptămâni" : "media anuală ponderată NIR") : "ultima intrare NIR"}) → {n2(eff, 4)} × {x.price != null ? n2(x.price, 4) : "?"} = <b>{x.price != null ? n2(eff * x.price, 4) : "—"} lei/bax</b>.</div>
                          {x.kind === "mp" && x.kgPerPallet ? <div>4. Paleți materie primă: {n2(eff, 4)} kg ÷ {n2(x.kgPerPallet, 0)} kg/palet = {n2(eff / x.kgPerPallet, 5)} paleți/bax (folosit la transportul de aprovizionare).</div> : null}
                          {x.kind === "marfa" && x.piecesPerPallet ? <div>4. Paleți aprovizionare: {n2(eff, 4)} buc ÷ {n2(x.piecesPerPallet, 0)} buc/palet = {n2(eff / x.piecesPerPallet, 5)} paleți/bax (folosit la transportul de aprovizionare). Marfă revândută ca atare: fără manoperă directă, doar regie.</div> : null}
                          {l?.detail && <div>Detaliu calcul: {l.detail}</div>}
                          <div>Total rând: <b>{n2(l?.value ?? 0, 4)} lei/bax</b> ÷ {n} buc = {n2((l?.value ?? 0) / n, 4)} lei/buc. Toate câmpurile din dreapta se pot modifica.</div>
                        </div>
                      </details>
                    </td>
                    <td className="text-right"><Input aria-label={`Cantitate ${x.name} (${x.unit})`} className="ml-auto h-8 w-24 text-right" value={o.quantities[x.id] ?? String(it.components.find((k) => k.id === x.id)?.qty ?? x.qty)} onChange={(e) => setOv(id, (q) => ({ ...q, quantities: { ...q.quantities, [x.id]: e.target.value } }))} /><div className="text-[10px] text-muted-foreground">{x.unit}</div></td>
                    <td className="text-right"><Input aria-label={`PT ${x.name}`} className="ml-auto h-8 w-16 text-right" value={o.losses[x.id] ?? String(it.components.find((k) => k.id === x.id)?.lossPct ?? x.lossPct)} onChange={(e) => setOv(id, (q) => ({ ...q, losses: { ...q.losses, [x.id]: e.target.value } }))} /></td>
                    <td className="text-right tabular-nums">{n2(eff, 4)}</td>
                    <td className="text-right"><Input aria-label={`Preț ${x.name}`} className="ml-auto h-8 w-24 text-right" value={o.prices[x.id] ?? (x.price == null ? "" : String(Math.round(x.price * 10000) / 10000))} onChange={(e) => setOv(id, (q) => ({ ...q, prices: { ...q.prices, [x.id]: e.target.value } }))} /></td>
                    <td>{weighed ? (() => { const base = x.kind === "marfa" ? it.components.find((k) => k.id === x.id)?.piecesPerPallet ?? x.piecesPerPallet : x.kgPerPallet; return <><Input aria-label={`${x.kind === "marfa" ? "buc" : "kg"}/palet ${x.name}`} className="ml-auto h-8 w-20 text-right" value={o.palletKg[x.id] ?? (base == null ? "" : String(base))} onChange={(e) => setOv(id, (q) => ({ ...q, palletKg: { ...q.palletKg, [x.id]: e.target.value } }))} /><div className="text-right text-[10px] text-muted-foreground">{x.kind === "marfa" ? "buc/palet" : "kg/palet"}</div></>; })() : <span className="block text-right">—</span>}</td>
                    <td className="text-right font-medium tabular-nums">{n2(l?.value ?? 0, 4)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{n2((l?.value ?? 0) / n, 4)}</td>
                  </tr>
                );
              })}
              {s.lines.filter((l) => !c.comps.some((x) => x.name === l.label)).map((l) => (
                <tr key={l.label} className="border-b last:border-0">
                  <td className="py-1.5" colSpan={6}>
                    <details>
                      <summary className="cursor-pointer font-medium">{l.label} <span className="text-[11px] font-normal text-primary">· cum s-a calculat</span></summary>
                      <div className="mt-1 rounded bg-muted/40 p-2 text-[11px]">{l.detail || "Fără detalii suplimentare."} → <b>{n2(l.value, 4)} lei/bax</b> ÷ {n} buc = {n2(l.value / n, 4)} lei/buc. Valorile de bază se modifică în „Parametri produs” sau „Parametri globali listă”; sursele din Senior sunt în secțiunea Logistică (facturi pe rând).</div>
                    </details>
                  </td>
                  <td className="text-right font-medium tabular-nums">{n2(l.value, 4)}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{n2(l.value / n, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="rounded-md border bg-background p-3">
          <summary className="cursor-pointer text-sm font-medium">Parametri produs · bucăți, palet, linie și manoperă</summary>
          {it.suggestedLabourSource && <p className="mt-2 text-[11px] text-muted-foreground">Manoperă: {it.suggestedLabourSource}</p>}
          <div className="mt-3"><PriceParameters scope="product" values={values} basis={basis} setBasis={setBasis} setValue={(k, v) => setProduct(id, k, v)} mode={mode} setMode={setMode} route={route} routes={routeOptions} setRoute={(v) => pickRoute(v)} line={line} setLine={(v) => chooseLine(id, v)} /></div>
        </details>

        <div className="rounded-md border bg-background p-3 text-sm">
          {p && it.recentSale ? (
            <div className="grid gap-2 sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Preț vânzare actual (90 zile)</div><div className="font-semibold tabular-nums">{n2(it.recentSale.price, 4)} lei/buc</div><div className="text-xs text-muted-foreground">{n2(it.recentSale.qty, 0)} buc vândute</div></div>
              <div><div className="text-xs text-muted-foreground">Cost total (producție + distribuție + taxe)</div><div className="font-semibold tabular-nums">{n2(p.cost + p.fees, 4)} lei/buc</div></div>
              <div><div className="text-xs text-muted-foreground">Profit real</div><div className={`font-semibold tabular-nums ${profitClass(p.profit)}`}>{n2(p.profit, 4)} lei/buc · {n2(p.pct, 1)}%</div><div className="text-xs text-muted-foreground">{n2(p.profit * it.recentSale.qty)} lei în 90 de zile</div></div>
              <div><div className="text-xs text-muted-foreground">Preț actual − preț propus</div><div className={`font-semibold tabular-nums ${profitClass(it.recentSale.price - s.perPiece.clientPrice)}`}>{n2(it.recentSale.price - s.perPiece.clientPrice, 4)} lei/buc</div><div className="text-xs text-muted-foreground">pozitiv = vinzi peste prețul propus</div></div>
            </div>
          ) : <p className="text-muted-foreground">{!s.complete ? "Profitul real apare după completarea fișei." : `Nu există vânzări ${client ? "către acest client" : "pentru acest produs"} în ultimele 90 de zile.`}</p>}
          {it.priceList && <Badge variant="secondary" className="mt-2">Listă de preț Senior: {n2(it.priceList.price, 4)} {it.priceList.currency} · {it.priceList.list} (din {it.priceList.since})</Badge>}
        </div>

        {rows.length > 0 && (
          <details className="rounded-md border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">Rentabilitate pe magazine · {it.product.name}</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[860px] text-xs">
                <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Magazin</th><th>Cursă</th><th className="text-right">Distribuție lei/palet</th><th className="text-right">Distribuție lei/buc</th><th className="text-right">Preț propus</th><th className="text-right">Preț actual</th><th className="text-right">Buc 90 zile</th><th className="text-right">Profit lei/buc</th><th className="text-right">Profit %</th></tr></thead>
                <tbody>
                  {rows.map((st) => (
                    <tr key={st.pid} className="border-b last:border-0">
                      <td className="py-1">{st.name}</td><td>{st.route ?? <span className="text-destructive">fără cursă</span>}</td>
                      <td className="text-right tabular-nums">{n2(st.perPallet)}</td><td className="text-right tabular-nums">{st.sheet ? n2(st.sheet.perPiece.logistics, 4) : "—"}</td>
                      <td className="text-right tabular-nums">{st.sheet?.complete ? n2(st.sheet.perPiece.clientPrice, 4) : "—"}</td>
                      <td className="text-right tabular-nums">{st.sale?.price != null ? n2(st.sale.price, 4) : <span className="text-muted-foreground">fără vânzări</span>}</td>
                      <td className="text-right tabular-nums">{st.sale ? n2(st.sale.qty, 0) : "—"}</td>
                      <td className={`text-right font-semibold tabular-nums ${profitClass(st.profit?.profit)}`}>{st.profit ? n2(st.profit.profit, 4) : "—"}</td>
                      <td className={`text-right tabular-nums ${profitClass(st.profit?.profit)}`}>{st.profit?.pct != null ? `${n2(st.profit.pct, 1)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {it.salesHistory.length > 0 && (
          <details className="rounded-md border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">Istoric vânzări lunar și profit la prețul de atunci</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Luna</th><th className="text-right">Bucăți</th><th className="text-right">Valoare (lei)</th><th className="text-right">Preț mediu (lei/buc)</th><th className="text-right">Profit real (lei/buc)</th></tr></thead>
                <tbody>
                  {it.salesHistory.map((h) => {
                    const hp = h.price != null && s.complete ? profitAt(s, h.price) : null;
                    return (
                      <tr key={h.month} className="border-b last:border-0">
                        <td className="py-1">{h.month}</td><td className="text-right tabular-nums">{n2(h.qty, 0)}</td><td className="text-right tabular-nums">{n2(h.value)}</td>
                        <td className="text-right tabular-nums">{n2(h.price, 4)}</td><td className={`text-right tabular-nums ${profitClass(hp?.profit)}`}>{hp ? n2(hp.profit, 4) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Calculator className="h-5 w-5" /> Calculator preț · listă de prețuri client</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {result && ranRules !== rulesVersion && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">Regulile de calcul s-au schimbat după acest calcul. Apasă „Calculează” ca să le aplici peste tot (normele de paleți și tarifele de transport se recitesc).</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Picker label="Client (partener central, după cod fiscal)" options={clients.map((c) => ({ id: c.id, name: c.stores > 1 ? `${c.name} · ${c.stores} magazine` : c.name }))} value={client} onChange={chooseClient} placeholder="Toți clienții" allowAll="Toți clienții (fără taxe client)" />
            {client != null && stores.length > 1 && (
              <Picker label="Magazin / punct de livrare" options={stores.map((x) => ({ id: x.id, name: `${x.name}${x.route ? ` · cursa ${x.route}` : " · cursă de ales"}` }))} value={store} onChange={chooseStore} placeholder="Toate magazinele" allowAll="Toate magazinele (medie client)" />
            )}
            <div className="space-y-1">
              <MultiPicker label={`Produse în listă${loadingOpts ? " · se încarcă…" : ""}`} options={products} value={selected} onChange={setSelected} />
              {client != null && (
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={onlySold} onChange={(e) => setOnlySold(e.target.checked)} /> Doar produse vândute acestui client în ultimul an
                </label>
              )}
            </div>
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
            <NumField label="Marjă brută %" value={marginShown} onChange={(v) => setGlobal("marginPct", v)} hint={`Implicit ${priceRules().marginPct}% (Reguli de calcul) · din prețul de vânzare: cost ÷ (1 − marjă)`} />
            <div className="flex items-end">
              <Button className="w-full" onClick={run} disabled={!selected.length || loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}Calculează {selected.length > 1 ? `${selected.length} produse` : ""}
              </Button>
            </div>
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.map((id) => {
                const p = products.find((x) => x.id === id) ?? items.find((x) => x.product.id === id)?.product;
                return <Badge key={id} variant="secondary" className="gap-1">{p?.name ?? `Articol ${id}`}<button aria-label={`Scoate ${p?.name ?? id}`} onClick={() => setSelected((s) => s.filter((x) => x !== id))}><X className="h-3 w-3" /></button></Badge>;
              })}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground">Citesc rețetele, prețurile NIR, ultimele facturi de transport, taxele clientului și viteza reală din Producție pentru {selected.length} produse…</p>}
        </CardContent>
      </Card>

      {result && logistics && (
        <>
          {(result.warnings.length > 0 || overridesDirty) && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="mb-1 flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" />De verificat</p>
              {result.warnings.map((w) => <p key={w} className="text-destructive">{w}</p>)}
              {overridesDirty && <div className="mt-2 flex flex-wrap items-center gap-2"><span>Ai schimbat cursele punctelor de livrare; media clientului e deja actualizată, tarifele pe cursă se refac la recalculare.</span><Button size="sm" onClick={run} disabled={loading}><RefreshCw className="mr-1 h-3.5 w-3.5" />Recalculează tarifele curselor</Button></div>}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Listă de prețuri · {clientName || "toți clienții"}{store != null && storeName ? ` · ${storeName}` : multiStore ? " · toate magazinele (medie)" : ""}</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(open.size ? new Set() : new Set(items.map((i) => i.product.id)))}>{open.size ? "Închide toate fișele" : "Deschide toate fișele"}</Button>
                  <Button size="sm" variant="outline" disabled={!items.length} onClick={exportExcel}><Download className="mr-1 h-3.5 w-3.5" />Export Excel</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Clic pe un produs ca să-i vezi structura prețului și să modifici orice valoare doar pentru el. Marja brută e adaosul peste cost la prețul propus; profitul real e ce rămâne la prețul cu care vinzi acum (media ultimelor 90 de zile). {incompleteCount ? <span className="text-destructive">{incompleteCount} fișe incomplete.</span> : "Toate fișele sunt complete."}</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2">Produs</th><th className="text-right">Cost producție</th><th className="text-right">Distribuție</th><th className="text-right">Taxe client</th>
                    <th className="border-l pl-2 text-right">Marjă brută</th><th className="text-right">Preț propus</th><th className="text-right">Preț propus bax</th>
                    <th className="border-l pl-2 text-right">Preț vânzare actual</th><th className="text-right">Profit real</th><th className="text-right">Profit %</th>
                  </tr>
                  <tr className="text-[10px]"><th /><th className="text-right">lei/buc</th><th className="text-right">lei/buc</th><th className="text-right">lei/buc</th><th className="border-l pl-2 text-right">lei/buc · %</th><th className="text-right">lei/buc</th><th className="text-right">lei/bax</th><th className="border-l pl-2 text-right">lei/buc · 90 zile</th><th className="text-right">lei/buc</th><th /></tr>
                </thead>
                <tbody>
                  {listRows.map(({ it, c, s, sale, profit }) => {
                    const isOpen = open.has(it.product.id);
                    return (
                      <Fragment key={it.product.id}>
                        <tr onClick={() => toggle(it.product.id)} aria-expanded={isOpen} className={`cursor-pointer border-b hover:bg-muted/50 ${isOpen ? "bg-muted font-medium" : ""}`}>
                          <td className="py-1.5">
                            <div className="flex items-center gap-1">{isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}{it.product.name}</div>
                            <div className="pl-5 text-[11px] text-muted-foreground">{s?.unitsPerCase ?? it.product.unitsPerCase} buc/bax{s && !s.complete ? <span className="text-destructive"> · incomplet: {[...s.missingInputs, ...s.missingPrices].slice(0, 2).join("; ")}</span> : ""}{it.warnings.length ? " · de verificat" : ""}{Object.keys(ov(it.product.id).rates).length + Object.keys(ov(it.product.id).prices).length + Object.keys(ov(it.product.id).quantities).length + Object.keys(ov(it.product.id).losses).length > 0 ? " · modificat" : ""}</div>
                          </td>
                          <td className="text-right tabular-nums">{s ? n2(s.perPiece.productionCost, 4) : "—"}</td>
                          <td className="text-right tabular-nums">{s ? n2(s.perPiece.logistics, 4) : "—"}</td>
                          <td className="text-right tabular-nums">{s ? n2(s.perPiece.fees, 4) : "—"}</td>
                          <td className="border-l pl-2 text-right tabular-nums">{s?.complete ? <>{n2(s.perPiece.grossMargin, 4)} <span className="text-muted-foreground">· {marginShown}%</span></> : "—"}</td>
                          <td className="text-right font-semibold tabular-nums">{s?.complete ? n2(s.perPiece.clientPrice, 4) : <span className="text-destructive">incomplet</span>}</td>
                          <td className="text-right tabular-nums">{s?.complete ? n2(s.clientPrice) : "—"}</td>
                          <td className="border-l pl-2 text-right tabular-nums">{sale ? <>{n2(sale.price, 4)} <span className="text-[11px] text-muted-foreground">({n2(sale.qty, 0)} buc)</span></> : <span className="text-muted-foreground">fără vânzări</span>}</td>
                          <td className={`text-right font-semibold tabular-nums ${profitClass(profit?.profit)}`}>{profit ? n2(profit.profit, 4) : "—"}</td>
                          <td className={`text-right tabular-nums ${profitClass(profit?.profit)}`}>{profit?.pct != null ? `${n2(profit.pct, 1)}%` : "—"}</td>
                        </tr>
                        {isOpen && <tr className="border-b"><td colSpan={10} className="p-0">{renderSheet(it, c)}</td></tr>}
                      </Fragment>
                    );
                  })}
                  {failed.map((f) => (
                    <tr key={f.product.id} className="border-b last:border-0"><td className="py-1.5">{f.product.name}</td><td colSpan={9} className="text-destructive">{f.error}</td></tr>
                  ))}
                </tbody>
              </table>
              {totals && (
                <p className="mt-3 text-sm">
                  Pe ultimele 90 de zile ({totals.n} produse cu vânzări): vânzări <b>{n2(totals.sales)} lei</b>, profit real <b className={profitClass(totals.profit)}>{n2(totals.profit)} lei</b>{totals.pct != null ? <> · <b className={profitClass(totals.profit)}>{n2(totals.pct, 1)}%</b></> : null}.
                </p>
              )}
            </CardContent>
          </Card>

          {storeTotals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rentabilitate pe magazine · toate produsele din listă</CardTitle>
                <p className="text-xs text-muted-foreground">Fiecare magazin cu costul de distribuție al cursei lui, la prețurile reale plătite în ultimele 90 de zile. Dacă un magazin are cursa greșită, alege-o aici: media clientului și profitul se refac imediat.</p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="py-2">Magazin</th><th>Cursă</th><th className="text-right">Paleți livrați (90 zile)</th><th className="text-right">Distribuție lei/palet</th><th className="text-right">Vânzări 90 zile</th><th className="text-right">Profit real 90 zile</th><th className="text-right">Profit %</th></tr></thead>
                  <tbody>
                    {storeTotals.map((st) => (
                      <tr key={st.pid} className="border-b last:border-0">
                        <td className="py-1.5">{st.name}<div className="text-[11px] text-muted-foreground">{st.judet}{st.incomplete ? ` · ${st.incomplete} produse incomplete` : ""}</div></td>
                        <td>
                          <select aria-label={`Cursa ${st.name}`} className={selectClass} value={routeOverrides[`p:${st.pid}`] ?? ""} onChange={(e) => setOverride(`p:${st.pid}`, e.target.value)}>
                            <option value="">{(() => { const r = routeOverrides[`j:${countyKey(st.judet)}`] ?? st.proposed; return r ? `propusă: ${r}` : "fără cursă — alege"; })()}</option>
                            {routeNames.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="text-right tabular-nums">{n2(st.pallets, 1)}</td>
                        <td className="text-right tabular-nums">{st.route ? n2(perPalletMap[st.route]) : "—"}</td>
                        <td className="text-right tabular-nums">{n2(st.sales)}</td>
                        <td className={`text-right font-semibold tabular-nums ${profitClass(st.profit)}`}>{st.sales ? n2(st.profit) : "—"}</td>
                        <td className={`text-right tabular-nums ${profitClass(st.profit)}`}>{st.pct != null ? `${n2(st.pct, 1)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              <details>
                <summary className="cursor-pointer text-sm font-medium">Parametri comuni listei · transport, marjă, taxe client, curs</summary>
                <p className="mt-2 text-[11px] text-muted-foreground">Se aplică tuturor produselor. Bucățile, paletul și manopera se schimbă din fișa fiecărui produs.</p>
                {result.fees && (
                  <p className="mt-2 text-xs">
                    <b>Taxe client {n2(result.fees.pct, 2)}%</b> din vânzări ({result.fees.from} – {result.fees.to}, pe codul fiscal): reduceri pe facturile noastre {n2(result.fees.discounts)} lei
                    {" "}+ servicii facturate de client {n2(result.fees.servicesTotal)} lei{result.fees.services.length ? ` (${result.fees.services.map((x) => `${x.subject} ${n2(x.total, 0)}`).join(", ")})` : ""} ÷ vânzări {n2(result.fees.sales)} lei. Istoric, nu tarif contractual — modifică procentul dacă ai contractul.
                  </p>
                )}
                <div className="mt-3"><PriceParameters scope="list" values={globalDisplay} basis={basis} setBasis={setBasis} setValue={setGlobal} mode={mode} setMode={setMode} route={route} routes={routeOptions} setRoute={(v) => pickRoute(v)} line="" setLine={() => undefined} /></div>
                {!!logistics.routes?.length && (
                  <div className="mt-4 overflow-x-auto">
                    <p className="mb-1 text-xs font-medium">Curse distribuție din Senior · cost din facturile {logistics.closedStart} – {logistics.closedEnd}, paleți din {logistics.loadWindow.start} – {logistics.loadWindow.end} · clic pe un rând ca să alegi cursa</p>
                    <table className="w-full min-w-[720px] text-xs">
                      <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Cursă</th><th className="text-right">Curse 30 zile</th><th className="text-right">Cost 30 zile (lei)</th><th className="text-right">Lei/cursă</th><th className="text-right">Paleți livrați 90 zile</th><th className="text-right">Paleți/cursă</th><th className="text-right">Lei/palet</th><th className="pl-3">Puncte de livrare incluse</th></tr></thead>
                      <tbody>
                        {logistics.routes.map((r) => (
                          <tr key={r.route} onClick={() => pickRoute(r.route)} className={`cursor-pointer border-b last:border-0 hover:bg-muted/50 ${r.route === route ? "bg-muted font-medium" : ""}`}>
                            <td className="py-1">{r.route}</td>
                            <td className="text-right tabular-nums">{r.trips}</td>
                            <td className="text-right tabular-nums">{n2(r.total)}</td>
                            <td className="text-right tabular-nums">{r.unitPrice != null ? `${n2(r.unitPrice)} lei/unitate` : `${n2(r.perTrip)} (${n2(r.pmin, 0)}–${n2(r.pmax, 0)})`}</td>
                            <td className="text-right tabular-nums">{n2(r.pallets, 1)}{r.estimatedPallets ? <span className="text-muted-foreground"> (din care {n2(r.estimatedPallets, 1)} estimați)</span> : null}</td>
                            <td className="text-right tabular-nums">{n2(r.palletsPerTrip, 1)}</td>
                            <td className="text-right tabular-nums">{n2(r.perPallet)}{r.pool && <div className="text-[10px] text-muted-foreground">comun {r.pool.routes.join(" + ")}: {n2(r.pool.total)} lei ÷ {n2(r.pool.pallets, 1)} paleți</div>}</td>
                            <td className="pl-3 text-muted-foreground">{r.points.length ? r.points.slice(0, 4).map((x) => `${x.name} (${n2(x.pallets, 1)})`).join(", ") + (r.points.length > 4 ? ` +${r.points.length - 4}` : "") : <span className="text-destructive">niciun punct atribuit — alege cursa pe județ mai jos</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!!logistics.unassigned?.length && (
                  <div className="mt-4 overflow-x-auto">
                    <p className="mb-1 text-xs font-medium">Puncte de livrare fără cursă · Senior nu leagă livrările de curse, așa că le propun după oraș/județ. Alege cursa pe județ (se ține minte pe acest calculator) și apasă „Recalculează tarifele curselor”.</p>
                    <table className="w-full min-w-[720px] text-xs">
                      <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Județ</th><th className="text-right">Paleți 90 zile</th><th className="text-right">Puncte</th><th className="pl-3">Exemple</th><th>Cursă</th></tr></thead>
                      <tbody>
                        {logistics.unassigned.map((g) => (
                          <tr key={g.county} className="border-b last:border-0">
                            <td className="py-1">{g.judet}</td><td className="text-right tabular-nums">{n2(g.pallets, 1)}</td><td className="text-right tabular-nums">{g.points}</td>
                            <td className="pl-3 text-muted-foreground">{g.names.join(", ")}</td>
                            <td><select aria-label={`Cursa județ ${g.judet}`} className={selectClass} value={routeOverrides[`j:${g.county}`] ?? ""} onChange={(e) => setOverride(`j:${g.county}`, e.target.value)}><option value="">alege cursa</option>{routeNames.map((r) => <option key={r} value={r}>{r}</option>)}</select></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {Object.keys(routeOverrides).length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">Cursele alese de tine: {Object.entries(routeOverrides).map(([k, v]) => `${k.startsWith("j:") ? `județ ${k.slice(2)}` : result.stores.find((x) => `p:${x.pid}` === k)?.name ?? k} → ${v}`).join("; ")}.
                    {" "}<button className="underline" onClick={() => Object.keys(routeOverrides).forEach((k) => setOverride(k, ""))}>Șterge toate</button></p>
                )}
              </details>
            </CardContent>
          </Card>

          <details className="rounded-md border p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Surse și metodă de calcul</summary>
            <div className="mt-2 space-y-1">
              <p>Materii prime: {mode === "annual" ? "media anuală ponderată" : "media ponderată ultimele 7 zile"}, până la {result.period.endDay} exclusiv. Ambalaje: ultima intrare NIR.</p>
              <p>Aprovizionare: {n2(logistics.supply.total)} lei ÷ {logistics.supply.trucks} camioane = <b>{n2(logistics.supply.costPerTruck)} lei/camion</b>, încărcare {n2(logistics.supply.palletsPerTruck, 1)} paleți/camion ({n2(logistics.supply.pallets, 0)} paleți din comenzi ÷ {logistics.supply.loadTrucks} camioane din comenzi, {logistics.loadWindow.start} – {logistics.loadWindow.end}).</p>
              {!!logistics.supply.orderedRows?.length && (
                <details className="rounded border bg-background p-2">
                  <summary className="cursor-pointer font-medium">Vezi paleții calculați din comenzile către furnizori ({n2(logistics.supply.pallets, 1)} paleți, {logistics.loadWindow.start} – {logistics.loadWindow.end})</summary>
                  <p className="mt-1 text-[11px]">Paleți = kg comandate (livrare în perioadă, fără comenzile anulate) ÷ kg/palet pe gamă: frunze/baby leaf/aromate 220, căpățâni 400, radicchio 500. Produsele fără normă nu se numără.</p>
                  <table className="mt-1 w-full text-[11px]">
                    <thead className="border-b text-left text-muted-foreground"><tr><th>Produs</th><th className="text-right">Cantitate comandată</th><th className="text-right">Kg/palet</th><th className="text-right">Paleți</th></tr></thead>
                    <tbody>{logistics.supply.orderedRows.map((r, i) => (
                      <tr key={i} className={`border-b last:border-0 ${r.kgPerPallet || r.piecesPerPallet ? "" : "text-crm-warning"}`}><td>{r.name}</td><td className="text-right tabular-nums">{n2(r.kg, 0)} {r.unit}</td><td className="text-right tabular-nums">{r.kgPerPallet ?? (r.piecesPerPallet ? `${r.piecesPerPallet} buc` : "fără normă")}</td><td className="text-right tabular-nums">{r.kgPerPallet || r.piecesPerPallet ? n2(r.pallets, 1) : "—"}</td></tr>
                    ))}</tbody>
                  </table>
                  {!!logistics.supply.orderedLoads?.length && (<>
                    <p className="mt-2 text-[11px] font-medium">Camioane din comenzi: {logistics.supply.loadTrucks} (paleții fiecărei zile de livrare, de la toți furnizorii ÷ 26 paleți/camion plin, rotunjit în sus){logistics.supply.invoiceTrucks90 != null ? ` · pentru comparație, rânduri „camion” pe facturile 624.01 în aceeași perioadă: ${logistics.supply.invoiceTrucks90}` : ""}</p>
                    <table className="mt-1 w-full text-[11px]">
                      <thead className="border-b text-left text-muted-foreground"><tr><th>Data livrare</th><th>Furnizori</th><th className="text-right">Paleți</th><th className="text-right">Camioane</th></tr></thead>
                      <tbody>{logistics.supply.orderedLoads.map((l, i) => (
                        <tr key={i} className="border-b last:border-0"><td>{l.day}</td><td>{l.supplier}</td><td className="text-right tabular-nums">{n2(l.pallets, 1)}</td><td className="text-right tabular-nums">{l.trucks}</td></tr>
                      ))}</tbody>
                    </table>
                  </>)}
                </details>
              )}
              {logistics.lastTrucks.length > 0 && (
                <details className="rounded border bg-background p-2">
                  <summary className="cursor-pointer font-medium">Vezi toate facturile de transport aprovizionare folosite ({logistics.lastTrucks.length} rânduri, {logistics.closedStart} – {logistics.closedEnd})</summary>
                  <p className="mt-1 text-[11px] text-muted-foreground">Pas 1: suma coloanei „Valoare” = {n2(logistics.supply.total)} lei. Pas 2: rândurile marcate „camion” = {logistics.supply.trucks} → {n2(logistics.supply.costPerTruck)} lei/camion. Pas 3: încărcare {n2(logistics.supply.pallets, 0)} paleți din comenzi ÷ {logistics.supply.loadTrucks} camioane din comenzi (paleți pe zi ÷ 26, rotunjit în sus) în 90 de zile = {n2(logistics.supply.palletsPerTruck, 1)} paleți/camion. Pas 4: {n2(logistics.supply.costPerTruck)} ÷ {n2(logistics.supply.palletsPerTruck, 1)} = lei/palet. Dacă vezi o factură care nu ține de aprovizionare sau lipsește cursa din luna asta, scrie tariful corect în „Parametri globali listă”.</p>
                  <table className="mt-1 w-full text-[11px]">
                    <thead className="border-b text-left text-muted-foreground"><tr><th>Data</th><th>Transportator</th><th>Rând factură</th><th className="text-right">Cant.</th><th className="text-right">Preț</th><th className="text-right">Valoare</th><th>Camion</th></tr></thead>
                    <tbody>{logistics.lastTrucks.map((t, i) => (
                      <tr key={i} className="border-b last:border-0"><td>{t.day}</td><td>{t.supplier || "—"}</td><td>{t.line}</td><td className="text-right tabular-nums">{n2(t.qty ?? 0, 2)}</td><td className="text-right tabular-nums">{n2(t.price)}</td><td className="text-right tabular-nums">{n2(t.value ?? 0)}</td><td>{t.truck ? "da" : "nu"}</td></tr>
                    ))}</tbody>
                  </table>
                </details>
              )}
              <p>{logistics.note}</p>
              {(result.info ?? []).map((w) => <p key={w}>{w}</p>)}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

/** Price list and the editable company-wide calculation rules it reads at every run. */
export default function PriceCalculator() {
  const [view, setView] = useState<"list" | "rules">("list");
  const [rulesVersion, setRulesVersion] = useState(0);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Calculator preț" className="inline-flex rounded-md border bg-muted p-1">
        {([["list", "Listă de prețuri"], ["rules", "Reguli de calcul"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${view === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>
      <div className={view === "list" ? "" : "hidden"}><PriceListCalculator rulesVersion={rulesVersion} /></div>
      <div className={view === "rules" ? "" : "hidden"}><PriceRulesEditor onSaved={() => setRulesVersion((v) => v + 1)} /></div>
    </div>
  );
}
