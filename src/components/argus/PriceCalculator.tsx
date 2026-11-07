import { useEffect, useMemo, useState } from "react";
import { Calculator, Check, ChevronsUpDown, Download, Loader2, X, Zap } from "lucide-react";
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
import { CLIENT_AVERAGE_ROUTE, DEFAULT_MARGIN_PCT, profitAt } from "../../../supabase/functions/_shared/priceList";
import { PriceParameters, NumericParameter } from "./PriceParameters";
import { prefilledConfig } from "../../../supabase/functions/_shared/priceDefaults";
import { ReceiptPriceAlert } from '../inventory/ReceiptPriceAlert';

type Opt = { id: number; name: string };
type Client = Opt & { stores: number };
type Product = Opt & { qty: number };
type Store = Opt & { route: string | null };
type RouteStat = { route: string; country: string; trips: number; total: number; pallets: number; perPallet: number | null; perTrip: number | null; palletsPerTrip: number | null; unitPrice: number | null; pmin: number; pmax: number; points: Array<{ name: string; pallets: number }> };
type Logistics = {
  supplyTotal: number | null; supplyPallets: number | null; supplyKg: number | null; supplyTrucks: number; lastTrucks: Array<{ day: string; price: number; line: string }>;
  closedStart: string; closedEnd: string; note: string; distribution?: Record<string, PriceConfig | null>; routes?: RouteStat[];
  clientAverage: { perPallet: number; pallets: number; weighted: boolean; stores: number } | null;
  store?: { id: number; name: string; route: string | null } | null; suggestedRoute?: string | null;
};
type StoreSale = { pid: number; qty: number; value: number; price: number | null };
type Item = {
  product: { id: number; name: string; unitsPerCase: number };
  defaults: PriceConfig; warnings: string[]; components: SheetComponent[];
  salesHistory: Array<{ month: string; qty: number; value: number; price: number | null }>;
  storeSales: StoreSale[]; recentSale: { qty: number; value: number; price: number; from: string; to: string } | null;
  priceList: { price: number; currency: string; list: string; since: string } | null;
};
type ListResult = {
  period: { startDay: string; endDay: string }; warnings: string[]; eur: { rate: number; day: string } | null;
  stores: Array<{ pid: number; name: string; route: string | null; pallets: number }>; logistics: Logistics;
  items: Array<Item | { product: { id: number; name: string }; error: string }>;
};
type Over = { rates: Record<string, string>; prices: Record<number, string>; losses: Record<number, string>; quantities: Record<number, string>; palletKg: Record<number, string>; line?: string };

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const n2 = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (s: string) => Number(String(s).replace(",", "."));
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const LABOUR_FIELDS = ["labourPerPiece", "utilitiesPerPiece", "labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"];
/** Edits that belong to one product; transport, margin, fees and EUR apply to the whole list. */
const PRODUCT_KEYS = new Set(["unitsPerCase", "piecesPerPallet", ...LABOUR_FIELDS]);
const DIST_KEYS = ["distributionTotal", "distributionPallets", "distributionPerPallet", "distributionTrips", "distributionPalletsPerTrip"];
const EMPTY: Over = { rates: {}, prices: {}, losses: {}, quantities: {}, palletKg: {} };
const isItem = (x: ListResult["items"][number]): x is Item => !("error" in x);
const ZERO = (eur: number) => ({ labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: eur, eurBufferPct: 1.5, techLossPct: 0, marginPct: 0 });

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

const profitClass = (v: number | null | undefined) => (v == null ? "" : v >= 0 ? "text-primary" : "text-destructive");

export default function PriceCalculator() {
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
  const [active, setActive] = useState<number | null>(null);
  const [globalRates, setGlobalRates] = useState<Record<string, string>>({});
  const [over, setOver] = useState<Record<number, Over>>({});
  const [mode, setMode] = useState<"annual" | "week">("annual");
  const [route, setRoute] = useState("România");
  const [routeManual, setRouteManual] = useState(false);
  const [basis, setBasis] = useState<"pallet" | "kg">("pallet");

  useEffect(() => {
    let off = false;
    setLoadingOpts(true);
    argusFetch<{ clients: Client[]; products: Product[]; stores?: Store[] }>("price_options", {}, { partnerId: client, allProducts: !onlySold })
      .then((r) => {
        if (off) return;
        setClients(r.clients); setProducts(r.products); setStores(r.stores ?? []);
      })
      .catch((e) => !off && setError(e.message))
      .finally(() => !off && setLoadingOpts(false));
    return () => { off = true; };
  }, [client, onlySold]);

  const items = useMemo(() => (result?.items ?? []).filter(isItem), [result]);
  const failed = useMemo(() => (result?.items ?? []).filter((x) => !isItem(x)) as Array<{ product: { id: number; name: string }; error: string }>, [result]);
  const activeItem = items.find((i) => i.product.id === active) ?? items[0] ?? null;
  const ov = (id: number) => over[id] ?? EMPTY;
  const setOv = (id: number, f: (o: Over) => Over) => setOver((p) => ({ ...p, [id]: f(p[id] ?? EMPTY) }));

  const run = async () => {
    if (!selected.length) return;
    setLoading(true); setError(null);
    try {
      const r = await argusFetch<ListResult>("price_list", {}, { articolIds: selected, partnerId: client, storeId: store, year, month, rawPriceMode: mode });
      setResult(r);
      const first = r.items.find(isItem);
      if (!r.items.some((i) => i.product.id === active)) setActive(first?.product.id ?? null);
      // The client's cursă (or the pallet-weighted client average) is proposed unless the user picked a cursă by hand.
      if (!routeManual) { setRoute(first?.defaults.route ?? "România"); setGlobalRates((p) => { const n = { ...p }; for (const k of DIST_KEYS) delete n[k]; return n; }); }
    } catch (e) { setError((e as Error).message); setResult(null); }
    finally { setLoading(false); }
  };

  const buildConfig = (it: Item, routeOverride?: string): PriceConfig => {
    const o = ov(it.product.id);
    const line = o.line ?? it.defaults.labourLine ?? "";
    const cfg: PriceConfig = { year, month, rawPriceMode: mode, route: routeOverride ?? route, supplyBasis: basis, ...(line ? { labourLine: line } : {}), rates: {}, components: {} };
    const vals: Record<string, string> = { ...Object.fromEntries(Object.entries(globalRates).filter(([k]) => !PRODUCT_KEYS.has(k))), ...o.rates };
    if (routeOverride) for (const k of DIST_KEYS) delete vals[k];
    for (const k of RATE_KEYS) if (vals[k] != null && vals[k] !== "") cfg.rates = { ...cfg.rates, [k]: num(vals[k]) };
    for (const k of CONFIG_NUMBERS) if (vals[k] != null && vals[k] !== "") Object.assign(cfg, { [k]: num(vals[k]) });
    for (const c of it.components) {
      const x: { price?: number; qty?: number; lossPct?: number; kgPerPallet?: number } = {};
      if (o.prices[c.id] != null && o.prices[c.id] !== "") x.price = num(o.prices[c.id]);
      if (o.losses[c.id] != null && o.losses[c.id] !== "") x.lossPct = num(o.losses[c.id]);
      if (o.quantities[c.id] != null && o.quantities[c.id] !== "") x.qty = num(o.quantities[c.id]);
      if (o.palletKg[c.id] != null && o.palletKg[c.id] !== "") x.kgPerPallet = num(o.palletKg[c.id]);
      cfg.components = { ...cfg.components, [c.id]: x };
    }
    return cfg;
  };
  const compute = (it: Item, cfg: PriceConfig) => {
    if (!result || !validPriceConfig(cfg)) return null;
    const comps = it.components.map((c) => ({ ...c, ...(c.kind === "mp" ? { price: mode === "week" ? c.weekPrice ?? null : c.annualPrice ?? null } : {}) }));
    const effective = prefilledConfig({ ...it, logistics: result.logistics }, cfg);
    const r = configuredSheet({ ...it, components: comps }, ZERO(result.eur?.rate ?? 0), effective);
    return { s: r.sheet, comps: r.components, rates: r.rates, effective, cfg };
  };
  const sheets = useMemo(() => new Map(items.map((it) => [it.product.id, compute(it, buildConfig(it))])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, result, globalRates, over, mode, route, basis, year, month]);
  const sheet = activeItem ? sheets.get(activeItem.product.id) ?? null : null;
  const activeOv = activeItem ? ov(activeItem.product.id) : EMPTY;
  const line = activeItem ? activeOv.line ?? activeItem.defaults.labourLine ?? "" : "";

  // Per store: the same product with each store's own cursă, against what that store actually pays.
  const storeRows = useMemo(() => {
    if (!activeItem || !result || result.stores.length < 2 || store != null) return [];
    return result.stores.map((st) => {
      const r = st.route && result.logistics.distribution?.[st.route] ? st.route : null;
      const c = r ? compute(activeItem, buildConfig(activeItem, r)) : null;
      const sale = activeItem.storeSales.find((x) => x.pid === st.pid) ?? null;
      const pr = c && c.s.complete && sale?.price != null ? profitAt(c.s, sale.price) : null;
      return { ...st, route: r, sheet: c?.s ?? null, perPallet: c?.effective.distributionPerPallet ?? null, sale, profit: pr };
    }).sort((a, b) => (b.sale?.qty ?? 0) - (a.sale?.qty ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem, result, store, globalRates, over, mode, basis, year, month]);

  // Fields show the value actually used: calculated from Senior/CSV unless the user typed one.
  const adjusted = useMemo(() => ({ ...Object.fromEntries(Object.entries(globalRates).filter(([k]) => !PRODUCT_KEYS.has(k))), ...activeOv.rates }), [globalRates, activeOv]);
  const display = useMemo(() => {
    const out: Record<string, string> = {};
    const fmt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : "");
    for (const k of CONFIG_NUMBERS) out[k] = adjusted[k] ?? fmt(sheet?.effective[k]);
    for (const k of RATE_KEYS) {
      const used = k === "labourPerPiece" || k === "utilitiesPerPiece" ? (sheet?.effective.rates?.[k] ?? (sheet && lineLabour(sheet.effective) ? sheet.rates[k] : undefined)) : sheet?.effective.rates?.[k];
      out[k] = adjusted[k] ?? fmt(used);
    }
    return out;
  }, [adjusted, sheet]);
  const marginShown = globalRates.marginPct ?? display.marginPct ?? String(DEFAULT_MARGIN_PCT);

  const setR = (k: string) => (v: string) => {
    if (PRODUCT_KEYS.has(k) && activeItem) setOv(activeItem.product.id, (o) => ({ ...o, rates: applyEdit(o.rates, k, v) }));
    else setGlobalRates((p) => applyEdit(p, k, v));
  };
  const chooseLine = (v: string) => {
    if (!activeItem) return;
    setOv(activeItem.product.id, (o) => { const r = { ...o.rates }; for (const k of LABOUR_FIELDS) delete r[k]; return { ...o, rates: r, line: v }; });
  };
  const clearDistribution = () => setGlobalRates((p) => { const n = { ...p }; for (const k of DIST_KEYS) delete n[k]; return n; });
  const pickRoute = (v: string, manual = true) => { setRoute(v); setRouteManual(manual); clearDistribution(); };
  const chooseClient = (v: number | null) => { setClient(v); setStore(null); setRouteManual(false); setResult(null); };
  const chooseStore = (v: number | null) => { setStore(v); setRouteManual(false); setResult(null); };
  const routeOptions = useMemo(() => [
    ...(result?.logistics.clientAverage ? [{ value: CLIENT_AVERAGE_ROUTE, label: `Medie client (toate magazinele) · ${n2(result.logistics.clientAverage.perPallet)} lei/palet` }] : []),
    ...(result?.logistics.routes ?? []).map((r) => ({ value: r.route, label: `${r.route} · ${r.perPallet != null ? `${n2(r.perPallet)} lei/palet` : r.perTrip != null ? `${n2(r.perTrip)} lei/cursă, paleți necunoscuți` : "fără curse"}` })),
    { value: "România", label: "Media curselor interne" },
  ], [result]);
  const clientName = clients.find((c) => c.id === client)?.name ?? "";
  const storeName = stores.find((x) => x.id === store)?.name ?? result?.logistics.store?.name;
  const routeLabel = (r: string) => (r === CLIENT_AVERAGE_ROUTE ? "medie client (toate magazinele, ponderat cu paleții)" : r);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  // One row per product of the list.
  const listRows = useMemo(() => items.map((it) => {
    const c = sheets.get(it.product.id);
    const s = c?.s ?? null;
    const sale = it.recentSale;
    const pr = s && s.complete && sale ? profitAt(s, sale.price) : null;
    return { it, s, sale, profit: pr };
  }), [items, sheets]);
  const totals = useMemo(() => {
    const rows = listRows.filter((r) => r.profit && r.sale);
    const sales = rows.reduce((t, r) => t + r.sale!.value, 0), profit = rows.reduce((t, r) => t + r.profit!.profit * r.sale!.qty, 0);
    return rows.length ? { sales, profit, pct: sales > 0 ? (profit / sales) * 100 : null, n: rows.length } : null;
  }, [listRows]);

  const [saving, setSaving] = useState(false);
  const saveLive = async () => {
    if (!activeItem || !sheet) return;
    const margin = num(marginShown || "0");
    const where = storeName && store != null ? storeName : clientName;
    setSaving(true);
    try {
      const r = await argusFetch<any>("live_save", {}, {
        kind: "price", articolId: activeItem.product.id, partnerId: client, storeId: store, scope: "central", marginPct: margin, config: buildConfig(activeItem), year, month, product: activeItem.product.name, client: where,
        title: `Fișă preț — ${activeItem.product.name}${where ? ` · ${where}` : ""}${margin ? ` · marjă ${margin}%` : ""}`,
      });
      toast({ title: "Fișă live salvată", description: r.firstRunOk ? "O găsești în „Agenți & Rapoarte”. Actualizează oricând, fără credite AI." : "Salvată; prima recalculare a eșuat, încearcă Actualizează." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Nu s-a putut salva", description: e.message });
    } finally { setSaving(false); }
  };

  const sheetRows = (it: Item, c: NonNullable<ReturnType<typeof compute>>) => {
    const n = c.s.unitsPerCase;
    const rows: (string | number)[][] = [
      ["Fișă preț", it.product.name], ["Client", clientName || "Toți clienții"], ["Magazin", store != null ? storeName ?? "" : "Toate magazinele"],
      ["Perioadă", `${String(month).padStart(2, "0")}/${year}`], ["Bucăți / bax", n], ["Linie de producție", c.effective.labourLine ?? "nealeasă"],
      ["Cursă distribuție", routeLabel(route)], ["Marjă brută %", num(marginShown || "0")], [],
      ["Componentă", "Tip", "UM", "Rețetă", "PT %", "Preț (lei/UM)", "Valoare (lei/bax)", "Valoare (lei/buc)", "Sursă"],
    ];
    for (const comp of c.comps) {
      const l = c.s.lines.find((x) => x.label === comp.name);
      rows.push([comp.name, comp.kind === "mp" ? "Materie primă" : "Ambalaj", comp.unit, r4(comp.qty), comp.lossPct, r4(comp.price ?? 0), r4(l?.value ?? 0), r4((l?.value ?? 0) / n), comp.priceSource]);
    }
    for (const l of c.s.lines.filter((x) => !c.comps.some((k) => k.name === x.label))) rows.push([l.label, "", "", "", "", "", r4(l.value), r4(l.value / n), l.detail]);
    rows.push([], ["Rezultat", "", "", "", "", "", "lei/bax", "lei/buc"]);
    for (const [l, b, p] of [
      ["Cost producție", c.s.productionCost, c.s.perPiece.productionCost], ["Marjă brută", c.s.grossMargin, c.s.perPiece.grossMargin],
      ["Preț poartă fabrică", c.s.factoryGate, c.s.perPiece.factoryGate], ["Transport distribuție", c.s.logistics, c.s.perPiece.logistics],
      ["Taxe client", c.s.clientFees, c.s.perPiece.fees], ["Preț propus client", c.s.clientPrice, c.s.perPiece.clientPrice], ["Preț propus EUR", c.s.clientPriceEur, c.s.perPiece.clientPriceEur],
    ] as [string, number, number][]) rows.push([l, "", "", "", "", "", r4(b), r4(p)]);
    if (!c.s.complete) rows.push([], ["Fișă incompletă", c.s.missingInputs.join("; ")]);
    if (it.warnings.length) { rows.push([], ["Avertismente"]); for (const w of it.warnings) rows.push([w]); }
    return rows;
  };
  const exportExcel = () => {
    if (!result || !items.length) return;
    const wb = XLSX.utils.book_new();
    const head: (string | number)[][] = [
      ["Listă de prețuri", clientName || "Toți clienții"], ["Magazin", store != null ? storeName ?? "" : "Toate magazinele (medie)"],
      ["Perioadă", `${String(month).padStart(2, "0")}/${year}`], ["Marjă brută %", num(marginShown || "0")], ["Cursă distribuție", routeLabel(route)],
      ["Transport", `ultimele prețuri: facturi ${result.logistics.closedStart} – ${result.logistics.closedEnd} (exclusiv)`], [],
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
    if (result.stores.length > 1 && store == null) {
      const rows: (string | number)[][] = [["Produs", "Magazin", "Cursă", "Distribuție (lei/palet)", "Distribuție (lei/buc)", "Preț propus (lei/buc)", "Preț vânzare actual (lei/buc)", "Bucăți vândute 90 zile", "Profit real (lei/buc)", "Profit real %"]];
      for (const it of items) for (const st of result.stores) {
        const r = st.route && result.logistics.distribution?.[st.route] ? st.route : null;
        const c = r ? compute(it, buildConfig(it, r)) : null;
        const sale = it.storeSales.find((x) => x.pid === st.pid);
        const pr = c && c.s.complete && sale?.price != null ? profitAt(c.s, sale.price) : null;
        if (!sale && !c) continue;
        rows.push([it.product.name, st.name, r ?? "fără cursă", c?.effective.distributionPerPallet != null ? r4(c.effective.distributionPerPallet) : "", c ? r4(c.s.perPiece.logistics) : "", c?.s.complete ? r4(c.s.perPiece.clientPrice) : "",
          sale?.price != null ? r4(sale.price) : "", sale ? Math.round(sale.qty) : "", pr ? r4(pr.profit) : "", pr?.pct != null ? Math.round(pr.pct * 10) / 10 : ""]);
      }
      const ws2 = XLSX.utils.aoa_to_sheet(rows);
      ws2["!cols"] = [{ wch: 36 }, { wch: 40 }, ...Array(8).fill({ wch: 14 })];
      XLSX.utils.book_append_sheet(wb, ws2, "Rentabilitate magazine");
    }
    if (activeItem && sheet) {
      const ws3 = XLSX.utils.aoa_to_sheet(sheetRows(activeItem, sheet));
      ws3["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Fișă produs");
    }
    XLSX.writeFile(wb, `Lista preturi - ${(clientName || "toti clientii").replace(/[\\/:*?"<>|]/g, "")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Calculator className="h-5 w-5" /> Calculator preț · listă de prețuri client</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Picker label="Client (partener central)" options={clients.map((c) => ({ id: c.id, name: c.stores > 1 ? `${c.name} · ${c.stores} magazine` : c.name }))} value={client} onChange={chooseClient} placeholder="Toți clienții" allowAll="Toți clienții (fără taxe client)" />
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
            <NumField label="Marjă brută %" value={marginShown} onChange={setR("marginPct")} hint={`Implicit ${DEFAULT_MARGIN_PCT}% · din prețul de vânzare: cost ÷ (1 − marjă)`} />
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
          {loading && <p className="text-sm text-muted-foreground">Citesc rețetele, prețurile NIR și ultimele facturi de transport din Senior pentru {selected.length} produse…</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="border-y py-3 text-xs text-muted-foreground space-y-1">
            <p>Materii prime: {mode === "annual" ? "media anuală ponderată" : "media ponderată ultimele 7 zile"}, până la {result.period.endDay} exclusiv. Ambalaje: ultima intrare NIR.</p>
            <p>
              Transport — ultimele prețuri, facturi {result.logistics.closedStart} – {result.logistics.closedEnd} exclusiv. Aprovizionare: {n2(result.logistics.supplyTotal)} lei pe {result.logistics.supplyTrucks} camioane ÷ {n2(result.logistics.supplyPallets, 0)} paleți NIR
              {result.logistics.lastTrucks.length ? ` · ultimele camioane: ${result.logistics.lastTrucks.map((t) => `${t.day.slice(5)} ${n2(t.price, 0)} lei`).join(", ")}` : ""}.
              {" "}Distribuție: cursa {routeLabel(route)}{storeName && store != null ? ` (${storeName})` : ""}. Manoperă: tabel octombrie 2026 (directă + regie fabrică 41%).
            </p>
            <p>{result.logistics.note}</p>
            {result.warnings.map((w) => <p key={w} className="text-destructive">{w}</p>)}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Listă de prețuri · {clientName || "toți clienții"}{store != null && storeName ? ` · ${storeName}` : client != null && result.stores.length > 1 ? " · toate magazinele (medie)" : ""}</CardTitle>
                <Button size="sm" variant="outline" disabled={!items.length} onClick={exportExcel}><Download className="mr-1 h-3.5 w-3.5" />Export Excel</Button>
              </div>
              <p className="text-xs text-muted-foreground">Marja brută este adaosul tău peste cost la prețul propus. Profitul real este ce rămâne la prețul cu care vinzi acum (media ultimelor 90 de zile), după cost producție, distribuție și taxe client. Clic pe un produs pentru fișa detaliată.</p>
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
                  {listRows.map(({ it, s, sale, profit }) => (
                    <tr key={it.product.id} onClick={() => setActive(it.product.id)} className={`cursor-pointer border-b last:border-0 hover:bg-muted/50 ${activeItem?.product.id === it.product.id ? "bg-muted font-medium" : ""}`}>
                      <td className="py-1.5">
                        <div>{it.product.name}</div>
                        <div className="text-[11px] text-muted-foreground">{s?.unitsPerCase ?? it.product.unitsPerCase} buc/bax{s && !s.complete ? " · fișă incompletă" : ""}{it.warnings.length ? " · NIR suspect" : ""}</div>
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
                  ))}
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

          {storeRows.length > 0 && activeItem && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rentabilitate pe magazine · {activeItem.product.name}</CardTitle>
                <p className="text-xs text-muted-foreground">Același produs cu costul de distribuție al cursei fiecărui magazin, față de prețul real plătit de magazin în ultimele 90 de zile. Media clientului ponderează magazinele cu paleții livrați.</p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground">
                    <tr><th className="py-2">Magazin</th><th>Cursă</th><th className="text-right">Paleți livrați (30 zile)</th><th className="text-right">Distribuție lei/palet</th><th className="text-right">Distribuție lei/buc</th><th className="text-right">Preț propus lei/buc</th><th className="text-right">Preț vânzare actual</th><th className="text-right">Bucăți 90 zile</th><th className="text-right">Profit real lei/buc</th><th className="text-right">Profit %</th></tr>
                  </thead>
                  <tbody>
                    {sheet && (
                      <tr className="border-b bg-muted/40 font-medium">
                        <td className="py-1.5">Medie client</td><td>{routeLabel(route)}</td><td className="text-right tabular-nums">{n2(result.logistics.clientAverage?.pallets, 1)}</td>
                        <td className="text-right tabular-nums">{n2(sheet.effective.distributionPerPallet)}</td><td className="text-right tabular-nums">{n2(sheet.s.perPiece.logistics, 4)}</td>
                        <td className="text-right tabular-nums">{sheet.s.complete ? n2(sheet.s.perPiece.clientPrice, 4) : "—"}</td>
                        <td className="text-right tabular-nums">{n2(activeItem.recentSale?.price, 4)}</td><td className="text-right tabular-nums">{n2(activeItem.recentSale?.qty, 0)}</td>
                        {(() => { const p = sheet.s.complete && activeItem.recentSale ? profitAt(sheet.s, activeItem.recentSale.price) : null; return <><td className={`text-right tabular-nums ${profitClass(p?.profit)}`}>{p ? n2(p.profit, 4) : "—"}</td><td className={`text-right tabular-nums ${profitClass(p?.profit)}`}>{p?.pct != null ? `${n2(p.pct, 1)}%` : "—"}</td></>; })()}
                      </tr>
                    )}
                    {storeRows.map((st) => (
                      <tr key={st.pid} className="border-b last:border-0">
                        <td className="py-1.5">{st.name}</td><td>{st.route ?? <span className="text-destructive">fără cursă</span>}</td>
                        <td className="text-right tabular-nums">{n2(st.pallets, 1)}</td><td className="text-right tabular-nums">{n2(st.perPallet)}</td>
                        <td className="text-right tabular-nums">{st.sheet ? n2(st.sheet.perPiece.logistics, 4) : "—"}</td>
                        <td className="text-right tabular-nums">{st.sheet?.complete ? n2(st.sheet.perPiece.clientPrice, 4) : "—"}</td>
                        <td className="text-right tabular-nums">{st.sale?.price != null ? n2(st.sale.price, 4) : <span className="text-muted-foreground">fără vânzări</span>}</td>
                        <td className="text-right tabular-nums">{st.sale ? n2(st.sale.qty, 0) : "—"}</td>
                        <td className={`text-right font-semibold tabular-nums ${profitClass(st.profit?.profit)}`}>{st.profit ? n2(st.profit.profit, 4) : "—"}</td>
                        <td className={`text-right tabular-nums ${profitClass(st.profit?.profit)}`}>{st.profit?.pct != null ? `${n2(st.profit.pct, 1)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {activeItem && sheet && (
            <>
              {activeItem.components.filter(c => c.priceSafety?.suspect).map(c => c.priceSafety ? <ReceiptPriceAlert key={c.id} safety={c.priceSafety} name={c.name} /> : null)}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Fișă preț · {activeItem.product.name} · bax {sheet.s.unitsPerCase} buc</CardTitle>
                  {activeItem.warnings.map((w) => <p key={w} className="text-sm text-destructive">{w}</p>)}
                  {!sheet.s.complete && <p className="text-sm text-destructive">Fișă incompletă — totaluri parțiale, nu preț final validat. De completat: {sheet.s.missingInputs.join("; ")}</p>}
                  {sheet.s.missingPrices.length > 0 && <p className="text-sm text-destructive">Fără preț în Senior: {sheet.s.missingPrices.join(", ")} — completează prețul ca fișa să fie corectă.</p>}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <Button size="sm" variant="secondary" disabled={saving} onClick={saveLive}>
                      {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1 h-3.5 w-3.5" />}Salvează fișa ca live
                    </Button>
                    Apare în „Agenți & Rapoarte”; o recalculezi cu prețurile Senior la zi dintr-un clic, fără credite AI.
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 overflow-x-auto">
                  <details open className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Parametri de calcul</summary>
                    <p className="mt-2 text-[11px] text-muted-foreground">Transportul, marja, taxele și cursul se aplică tuturor produselor din listă. Bucăți/bax, bucăți/palet și manopera se schimbă doar pentru produsul selectat.</p>
                    <div className="mt-3"><PriceParameters values={display} basis={basis} setBasis={setBasis} setValue={(k, v) => setR(k)(v)} mode={mode} setMode={setMode} route={route} routes={routeOptions} setRoute={(v) => pickRoute(v)} line={line} setLine={chooseLine} /></div>
                    {!!result.logistics.routes?.length && (
                      <div className="mt-4 overflow-x-auto">
                        <p className="mb-1 text-xs font-medium">Curse distribuție din Senior · facturi {result.logistics.closedStart} – {result.logistics.closedEnd} exclusiv · clic pe un rând ca să alegi cursa</p>
                        <table className="w-full min-w-[720px] text-xs">
                          <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Cursă</th><th className="text-right">Curse</th><th className="text-right">Cost (lei)</th><th className="text-right">Lei/cursă</th><th className="text-right">Paleți livrați</th><th className="text-right">Paleți/cursă</th><th className="text-right">Lei/palet</th><th className="pl-3">Puncte de livrare incluse</th></tr></thead>
                          <tbody>
                            {result.logistics.routes.map((r) => (
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
                  {!validPriceConfig(sheet.cfg) && <p className="text-sm text-destructive">Parametri invalizi: valori pozitive, pierderi și marjă sub 100%, bucăți/palet și bucăți/bax peste zero.</p>}
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground">
                      <tr><th className="py-2">Componentă</th><th className="text-right">Rețetă</th><th className="text-right">PT %</th><th className="text-right">Cantitate cu pierdere</th><th className="text-right">Preț (lei/UM)</th><th className="text-right">kg / palet MP</th><th className="text-right">Valoare (lei/bax)</th></tr>
                    </thead>
                    <tbody>
                      {sheet.comps.map((c) => {
                        const l = sheet.s.lines.find((x) => x.label === c.name);
                        const eff = c.kind === "mp" ? c.qty / (1 - Math.min(c.lossPct, 95) / 100) : c.qty * (1 + c.lossPct / 100);
                        const id = activeItem.product.id;
                        return (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="py-1.5">
                              <div className={`font-medium ${c.priceSafety?.suspect ? 'text-crm-warning' : ''}`}>{c.name}{c.priceSafety?.suspect ? ' · NIR suspect' : ''}</div>
                              <div className="text-[11px] text-muted-foreground">{c.kind === "mp" ? "Materie primă" : "Ambalaj"} · {c.priceSource}{c.lossSource ? ` · ${c.lossSource}` : ""}</div>
                            </td>
                            <td className="text-right"><NumericParameter label={`Cantitate ${c.name} (${c.unit})`} value={activeOv.quantities[c.id] ?? String(c.qty)} onChange={(v) => setOv(id, (o) => ({ ...o, quantities: { ...o.quantities, [c.id]: v } }))} /></td>
                            <td className="text-right"><Input aria-label={`PT ${c.name}`} className="ml-auto h-8 w-16 text-right" value={activeOv.losses[c.id] ?? String(c.lossPct)} onChange={(e) => setOv(id, (o) => ({ ...o, losses: { ...o.losses, [c.id]: e.target.value } }))} /></td>
                            <td className="text-right tabular-nums">{n2(eff, 4)}</td>
                            <td className="text-right"><Input aria-label={`Preț ${c.name}`} className="ml-auto h-8 w-24 text-right" value={activeOv.prices[c.id] ?? (c.price == null ? "" : String(Math.round(c.price * 10000) / 10000))} onChange={(e) => setOv(id, (o) => ({ ...o, prices: { ...o.prices, [c.id]: e.target.value } }))} /></td>
                            <td>{c.kind === "mp" ? <Input aria-label={`kg/palet ${c.name}`} className="ml-auto h-8 w-24 text-right" value={activeOv.palletKg[c.id] ?? (c.kgPerPallet == null ? "" : String(c.kgPerPallet))} onChange={(e) => setOv(id, (o) => ({ ...o, palletKg: { ...o.palletKg, [c.id]: e.target.value } }))} /> : "—"}</td>
                            <td className="text-right font-medium tabular-nums">{n2(l?.value ?? 0, 4)}</td>
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

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {([
                      ["Cost producție", sheet.s.productionCost, sheet.s.perPiece.productionCost, ""],
                      [`Marjă brută (${marginShown}%)`, sheet.s.grossMargin, sheet.s.perPiece.grossMargin, "text-primary"],
                      ["Preț poartă fabrică", sheet.s.factoryGate, sheet.s.perPiece.factoryGate, ""],
                      [`Transport distribuție · ${routeLabel(route)}`, sheet.s.logistics, sheet.s.perPiece.logistics, ""],
                      [`Taxe client (${n2(sheet.s.feePct, 2)}%)`, sheet.s.clientFees, sheet.s.perPiece.fees, ""],
                      ["Preț propus client", sheet.s.clientPrice, sheet.s.perPiece.clientPrice, "font-bold"],
                    ] as [string, number, number, string][]).map(([l, bax, buc, cls]) => (
                      <div key={l} className="rounded-lg border p-3">
                        <div className="text-xs text-muted-foreground">{l}</div>
                        <div className={`text-lg font-semibold tabular-nums ${cls}`}>{sheet.s.complete ? `${n2(bax)} lei/bax` : "Calcul incomplet"}</div>
                        <div className="text-sm tabular-nums text-muted-foreground">{sheet.s.complete ? `${n2(buc, 4)} lei/buc` : "Costuri lipsă — nu sunt zero"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    {sheet.s.complete ? <>În EUR (curs {n2(sheet.s.eurEffective, 4)} cu marjă de siguranță): <b>{n2(sheet.s.clientPriceEur)} €/bax</b> · <b>{n2(sheet.s.perPiece.clientPriceEur, 4)} €/buc</b></> : "Prețul final EUR nu este disponibil până la calcularea tuturor costurilor."}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Profit real la prețul de vânzare · {activeItem.product.name}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {activeItem.recentSale && sheet.s.complete ? (() => {
                    const p = profitAt(sheet.s, activeItem.recentSale.price);
                    return (
                      <div className="grid gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Preț vânzare actual (90 zile)</div><div className="text-lg font-semibold tabular-nums">{n2(activeItem.recentSale.price, 4)} lei/buc</div><div className="text-xs text-muted-foreground">{n2(activeItem.recentSale.qty, 0)} buc vândute</div></div>
                        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Cost total (producție + distribuție + taxe)</div><div className="text-lg font-semibold tabular-nums">{n2(p.cost + p.fees, 4)} lei/buc</div></div>
                        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Profit real</div><div className={`text-lg font-semibold tabular-nums ${profitClass(p.profit)}`}>{n2(p.profit, 4)} lei/buc · {n2(p.pct, 1)}%</div><div className="text-xs text-muted-foreground">{n2(p.profit * activeItem.recentSale.qty)} lei în 90 de zile</div></div>
                        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Preț propus vs actual</div><div className={`text-lg font-semibold tabular-nums ${profitClass(activeItem.recentSale.price - sheet.s.perPiece.clientPrice)}`}>{n2(activeItem.recentSale.price - sheet.s.perPiece.clientPrice, 4)} lei/buc</div><div className="text-xs text-muted-foreground">pozitiv = vinzi peste prețul propus</div></div>
                      </div>
                    );
                  })() : <p className="text-sm text-muted-foreground">{!sheet.s.complete ? "Profitul este indisponibil până la calcularea costului complet." : `Nu există vânzări ${client ? "către acest client" : "pentru acest produs"} în ultimele 90 de zile.`}</p>}
                  {activeItem.priceList && <Badge variant="secondary">Listă de preț Senior: {n2(activeItem.priceList.price, 4)} {activeItem.priceList.currency} · {activeItem.priceList.list} (din {activeItem.priceList.since})</Badge>}
                  {activeItem.salesHistory.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Luna</th><th className="text-right">Bucăți vândute</th><th className="text-right">Valoare (lei)</th><th className="text-right">Preț mediu (lei/buc)</th><th className="text-right">Profit real (lei/buc)</th></tr></thead>
                        <tbody>
                          {activeItem.salesHistory.map((h) => {
                            const p = h.price != null && sheet.s.complete ? profitAt(sheet.s, h.price) : null;
                            return (
                              <tr key={h.month} className="border-b last:border-0">
                                <td className="py-1">{h.month}</td><td className="text-right tabular-nums">{n2(h.qty, 0)}</td><td className="text-right tabular-nums">{n2(h.value)}</td>
                                <td className="text-right tabular-nums">{n2(h.price, 4)}</td>
                                <td className={`text-right tabular-nums ${profitClass(p?.profit)}`}>{p ? n2(p.profit, 4) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
