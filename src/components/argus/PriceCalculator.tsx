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

import { configuredSheet, LABOUR_LINES, RATE_KEYS, CONFIG_NUMBERS, validPriceConfig, type PriceConfig } from "../../../supabase/functions/_shared/priceConfig";
import { PriceParameters, NumericParameter } from "./PriceParameters";
import { prefilledConfig } from "../../../supabase/functions/_shared/priceDefaults";

type Opt = { id: number; name: string };
type Rate = { value: number; total: number; volume: number; unit: string; accounts: Array<{ cont: string; name: string; value: number }> };
type Data = {
  product: { id: number; name: string; unitsPerCase: number };
  defaults?: PriceConfig;
  warnings?: string[];
  period: { startDay: string; endDay: string };
  components: SheetComponent[];
  rates: Record<"labourPerPiece" | "utilitiesPerPiece" | "supplyPerKg" | "distributionPerPiece" | "clientFeePerPiece", Rate>;
  logistics: { supplyTotal: number | null; closedStart: string; closedEnd: string; note: string; distribution?: Record<string, PriceConfig | null> };
  eur: { rate: number; day: string } | null;
  salesHistory: Array<{ month: string; qty: number; value: number; price: number | null }>;
  priceList: { price: number; currency: string; list: string; since: string } | null;
};

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const n2 = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (s: string) => Number(String(s).replace(",", "."));

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
  const [sg, setSg] = useState<number | null>(null);
  const [client, setClient] = useState<number | null>(null);
  const [product, setProduct] = useState<number | null>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [adjustedRates, setAdjustedRates] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<"annual" | "week">("annual");
  const [route, setRoute] = useState("România");
  const [line, setLine] = useState("");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [palletKg, setPalletKg] = useState<Record<number, string>>({});
  const [losses, setLosses] = useState<Record<number, string>>({});

  useEffect(() => {
    let off = false;
    setLoadingOpts(true);
    argusFetch<{ subgroups: Opt[]; clients: Opt[]; products: Opt[] }>("price_options", {}, { subgroupId: sg, partnerId: client })
      .then((r) => {
        if (off) return;
        setSubgroups(r.subgroups); setClients(r.clients); setProducts(r.products);
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
      const d = await argusFetch<Data>("price_calc", {}, { articolId: product, partnerId: client, year, month, rawPriceMode: mode });
      setData(d);
      const base = d.defaults ?? { unitsPerCase: d.product.unitsPerCase, rates: { eurRate: d.eur?.rate ?? 0, eurBufferPct: 1.5, techLossPct: 0, marginPct: 0 } };
      const filled: Record<string, string> = {};
      for (const k of CONFIG_NUMBERS) if (base[k] != null) filled[k] = String(base[k]);
      for (const k of RATE_KEYS) if (base.rates?.[k] != null) filled[k] = String(base.rates[k]);
      setRates({ ...filled, ...(data?.product.id === d.product.id ? adjustedRates : {}) });
      if (!line || data?.product.id !== d.product.id) setLine(base.labourLine ?? "");
      if (data?.product.id !== d.product.id) { setPrices({}); setLosses({}); setQuantities({}); setPalletKg({}); setAdjustedRates({}); }
    } catch (e) { setError((e as Error).message); setData(null); }
    finally { setLoading(false); }
  };

  const [saving, setSaving] = useState(false);
  const saveLive = async () => {
    if (!data || !product || data.product.id !== product) return;
    const clientName = clients.find((c) => c.id === client)?.name ?? "";
    const margin = num(rates.marginPct ?? "0");
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
    const cfg: PriceConfig = { year, month, rawPriceMode: mode, route, ...(line ? { labourLine: line } : {}), rates: {}, components: {} };
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
  }, [data, mode, route, line, adjustedRates, prices, losses, quantities, palletKg, year, month]);
  const sheet = useMemo(() => {
    if (!data || !validPriceConfig(config)) return null;
    const comps = data.components.map((c) => ({ ...c, ...(c.kind === "mp" ? { price: mode === "week" ? c.weekPrice ?? null : c.annualPrice ?? null } : {}) }));
    const result = configuredSheet({ ...data, components: comps }, { labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: data.eur?.rate ?? 0, eurBufferPct: 1.5, techLossPct: 0, marginPct: 0 }, prefilledConfig(data, config));
    return { s: result.sheet, comps: result.components };
  }, [data, config, mode]);
  const chooseLine = (v: string) => {
    setLine(v);
    const l = LABOUR_LINES.find((x) => x.name === v);
    setRates((p) => ({ ...p, labourPerPiece: l?.direct == null ? "" : String(l.direct), utilitiesPerPiece: l?.overhead == null ? "" : String(l.overhead) }));
    setAdjustedRates((p) => { const n = { ...p }; delete n.labourPerPiece; delete n.utilitiesPerPiece; return n; });
  };

  const lastSale = data ? [...data.salesHistory].reverse().find((h) => h.price != null) ?? null : null;
  const setR = (k: string) => (v: string) => {
    const derived = k === 'supplyTotal' || k === 'supplyPallets' ? 'supplyPerPallet' : k === 'distributionTotal' || k === 'distributionPallets' ? 'distributionPerPallet' : null;
    setRates((p) => {
      const next = { ...p, [k]: v };
      if (derived) {
        const total = num(next[derived === 'supplyPerPallet' ? 'supplyTotal' : 'distributionTotal'] ?? '');
        const pallets = num(next[derived === 'supplyPerPallet' ? 'supplyPallets' : 'distributionPallets'] ?? '');
        next[derived] = pallets > 0 ? String(total / pallets) : '';
      }
      return next;
    });
    setAdjustedRates((p) => { const next = { ...p, [k]: v }; if (derived) delete next[derived]; return next; });
  };
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Calculator className="h-5 w-5" /> Calculator preț</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Picker label="Subgrupă client" options={subgroups} value={sg} onChange={(v) => { setSg(v); setClient(null); }} placeholder="Toate" allowAll="Toate subgrupele" />
            <Picker label="Client" options={clients} value={client} onChange={setClient} placeholder="Toți clienții" allowAll="Toți clienții (fără taxe client)" />
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
            <NumField label="Marjă brută %" value={rates.marginPct ?? "0"} onChange={setR("marginPct")} hint="Din prețul de vânzare: cost ÷ (1 − marjă)" />
            <div className="flex items-end">
              <Button className="w-full" onClick={run} disabled={!product || loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}Calculează
              </Button>
            </div>
          </div>
          <details open className="border-t pt-3"><summary className="cursor-pointer font-medium text-sm">Filtre și parametri de calcul</summary><div className="mt-3"><PriceParameters values={rates} setValue={(k, v) => setR(k)(v)} mode={mode} setMode={setMode} route={route} setRoute={(v) => {
            setRoute(v);
            const defaults = data?.logistics.distribution?.[v];
            setRates((p) => ({ ...p, distributionTotal: defaults?.distributionTotal == null ? "" : String(defaults.distributionTotal), distributionPallets: defaults?.distributionPallets == null ? "" : String(defaults.distributionPallets), distributionPerPallet: defaults?.distributionPerPallet == null ? "" : String(defaults.distributionPerPallet) }));
            setAdjustedRates((p) => { const n = { ...p }; delete n.distributionTotal; delete n.distributionPallets; delete n.distributionPerPallet; return n; });
          }} line={line} setLine={chooseLine} /></div></details>
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
            <p>Aprovizionare: {data.logistics.closedStart} – {data.logistics.closedEnd} exclusiv. Distribuție: {route}. Manoperă: document octombrie 2026, regie inclusă, fără dublare.</p>
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
                  [`Preț poartă fabrică (marjă ${rates.marginPct || 0}%)`, sheet.s.factoryGate, sheet.s.perPiece.factoryGate],
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
