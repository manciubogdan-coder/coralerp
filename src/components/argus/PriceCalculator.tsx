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
import { computeSheet, type SheetComponent, type SheetRates } from "../../../supabase/functions/_shared/priceSheet";

type Opt = { id: number; name: string };
type Rate = { value: number; total: number; volume: number; unit: string; accounts: Array<{ cont: string; name: string; value: number }> };
type Data = {
  product: { id: number; name: string; unitsPerCase: number };
  period: { startDay: string; endDay: string };
  components: SheetComponent[];
  rates: Record<"labourPerPiece" | "utilitiesPerPiece" | "supplyPerKg" | "distributionPerPiece" | "clientFeePerPiece", Rate>;
  eur: { rate: number; day: string } | null;
  salesHistory: Array<{ month: string; qty: number; value: number; price: number | null }>;
  priceList: { price: number; currency: string; list: string; since: string } | null;
};

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const n2 = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (s: string) => { const v = Number(String(s).replace(",", ".")); return Number.isFinite(v) ? v : 0; };

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
  const [prices, setPrices] = useState<Record<number, string>>({});
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
      const d = await argusFetch<Data>("price_calc", {}, { articolId: product, partnerId: client, year, month });
      setData(d);
      setRates({
        labourPerPiece: String(d.rates.labourPerPiece.value), utilitiesPerPiece: String(d.rates.utilitiesPerPiece.value),
        supplyPerKg: String(d.rates.supplyPerKg.value), distributionPerPiece: String(d.rates.distributionPerPiece.value),
        clientFeePerPiece: String(d.rates.clientFeePerPiece.value), eurRate: String(d.eur?.rate ?? ""), eurBufferPct: "1.5",
        techLossPct: "0", marginPct: rates.marginPct ?? "0",
      });
      setPrices({}); setLosses({});
    } catch (e) { setError((e as Error).message); setData(null); }
    finally { setLoading(false); }
  };

  const [saving, setSaving] = useState(false);
  const saveLive = async () => {
    if (!data || !product) return;
    const clientName = clients.find((c) => c.id === client)?.name ?? "";
    const margin = num(rates.marginPct ?? "0");
    setSaving(true);
    try {
      const r = await argusFetch<any>("live_save", {}, {
        kind: "price", articolId: product, partnerId: client, marginPct: margin, product: data.product.name, client: clientName,
        title: `Fișă preț — ${data.product.name}${clientName ? ` · ${clientName}` : ""}${margin ? ` · marjă ${margin}%` : ""}`,
      });
      toast({ title: "Fișă live salvată", description: r.firstRunOk ? "O găsești în „Agenți & Rapoarte”. Actualizează oricând, fără credite AI." : "Salvată; prima recalculare a eșuat, încearcă Actualizează." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Nu s-a putut salva", description: e.message });
    } finally { setSaving(false); }
  };

  const sheet = useMemo(() => {
    if (!data) return null;
    const r = Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, num(v)])) as unknown as SheetRates;
    const comps = data.components.map((c) => ({
      ...c,
      price: prices[c.id] != null && prices[c.id] !== "" ? num(prices[c.id]) : c.price,
      lossPct: losses[c.id] != null && losses[c.id] !== "" ? num(losses[c.id]) : c.lossPct,
    }));
    return { s: computeSheet({ unitsPerCase: data.product.unitsPerCase, components: comps, rates: r }), comps };
  }, [data, rates, prices, losses]);

  const lastSale = data ? [...data.salesHistory].reverse().find((h) => h.price != null) ?? null : null;
  const setR = (k: string) => (v: string) => setRates((p) => ({ ...p, [k]: v }));
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          {data && product && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              <Button size="sm" variant="secondary" disabled={saving} onClick={saveLive}>
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1 h-3.5 w-3.5" />}Salvează ca fișă live
              </Button>
              Apare în „Agenți & Rapoarte”; o recalculezi cu prețurile Senior la zi dintr-un clic, fără credite AI.
            </div>
          )}
        </CardContent>
      </Card>

      {data && sheet && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tarife folosite · medie {data.period.startDay} — {data.period.endDay} din contabilitatea Senior</CardTitle>
              <p className="text-xs text-muted-foreground">Le poți modifica; fișa se recalculează imediat. Costul logistic e media firmei — pentru export sau rute lungi pune costul real al rutei.</p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["labourPerPiece", "Manoperă (lei/buc)"], ["utilitiesPerPiece", "Utilități și hală (lei/buc)"], ["supplyPerKg", "Transport aprovizionare (lei/kg MP)"],
                ["distributionPerPiece", "Cost logistic rută (lei/buc)"], ["clientFeePerPiece", "Taxe client (lei/buc)"],
              ] as const).map(([k, l]) => {
                const r = data.rates[k];
                return <NumField key={k} label={l} value={rates[k] ?? ""} onChange={setR(k)} hint={r.volume ? `${n2(r.total, 0)} lei ÷ ${n2(r.volume, 0)} ${r.unit}${r.accounts.length ? ` · conturi ${r.accounts.map((a) => a.cont).join(", ")}` : ""}` : "fără date în perioadă"} />;
              })}
              <NumField label="Curs EUR" value={rates.eurRate ?? ""} onChange={setR("eurRate")} hint={data.eur ? `BNR ${data.eur.day}` : "curs negăsit"} />
              <NumField label="Marjă siguranță curs %" value={rates.eurBufferPct ?? ""} onChange={setR("eurBufferPct")} />
              <NumField label="Pierdere tehnologică suplimentară %" value={rates.techLossPct ?? ""} onChange={setR("techLossPct")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fișă preț · {data.product.name} · bax {data.product.unitsPerCase} buc</CardTitle>
              {sheet.s.missingPrices.length > 0 && <p className="text-sm text-destructive">Fără preț în Senior: {sheet.s.missingPrices.join(", ")} — completează prețul ca fișa să fie corectă.</p>}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr><th className="py-2">Componentă</th><th className="text-right">Rețetă</th><th className="text-right">PT %</th><th className="text-right">Cantitate cu pierdere</th><th className="text-right">Preț (lei/UM)</th><th className="text-right">Valoare (lei/bax)</th></tr>
                </thead>
                <tbody>
                  {sheet.comps.map((c) => {
                    const line = sheet.s.lines.find((l) => l.label === c.name);
                    const eff = c.kind === "mp" ? c.qty / (1 - c.lossPct / 100) : c.qty;
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-1.5">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">{c.kind === "mp" ? "Materie primă" : "Ambalaj"} · {c.priceSource}{c.lossSource ? ` · ${c.lossSource}` : ""}</div>
                        </td>
                        <td className="text-right tabular-nums">{n2(c.qty, 3)} {c.unit}</td>
                        <td className="text-right">{c.kind === "mp" ? <Input className="ml-auto h-8 w-16 text-right" value={losses[c.id] ?? String(c.lossPct)} onChange={(e) => setLosses((p) => ({ ...p, [c.id]: e.target.value }))} /> : "—"}</td>
                        <td className="text-right tabular-nums">{n2(eff, 4)}</td>
                        <td className="text-right"><Input className="ml-auto h-8 w-24 text-right" value={prices[c.id] ?? (c.price == null ? "" : String(Math.round(c.price * 10000) / 10000))} onChange={(e) => setPrices((p) => ({ ...p, [c.id]: e.target.value }))} /></td>
                        <td className="text-right font-medium tabular-nums">{n2(line?.value ?? 0, 4)}</td>
                      </tr>
                    );
                  })}
                  {sheet.s.lines.filter((l) => !sheet.comps.some((c) => c.name === l.label)).map((l) => (
                    <tr key={l.label} className="border-b last:border-0">
                      <td className="py-1.5" colSpan={5}><div className="font-medium">{l.label}</div><div className="text-[11px] text-muted-foreground">{l.detail}</div></td>
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
                    <div className="text-lg font-semibold tabular-nums">{n2(bax as number)} lei/bax</div>
                    <div className="text-sm tabular-nums text-muted-foreground">{n2(buc as number, 4)} lei/buc</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 rounded-lg border bg-muted/40 p-3 text-sm">
                În EUR (curs {n2(sheet.s.eurEffective, 4)} cu marjă de siguranță): <b className="tabular-nums">{n2(sheet.s.clientPriceEur)} €/bax</b> · <b className="tabular-nums">{n2(sheet.s.perPiece.clientPriceEur, 4)} €/buc</b>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Comparație cu prețul de vânzare</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {lastSale ? (() => {
                const diff = lastSale.price! - sheet.s.perPiece.clientPrice;
                return (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Preț calculat</div><div className="text-lg font-semibold tabular-nums">{n2(sheet.s.perPiece.clientPrice, 4)} lei/buc</div></div>
                    <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Preț vânzare mediu {lastSale.month}</div><div className="text-lg font-semibold tabular-nums">{n2(lastSale.price, 4)} lei/buc</div></div>
                    <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Diferență (profit/pierdere pe bucată)</div><div className={`text-lg font-semibold tabular-nums ${diff >= 0 ? "text-primary" : "text-destructive"}`}>{n2(diff, 4)} lei · {n2((diff / lastSale.price!) * 100, 1)}%</div></div>
                  </div>
                );
              })() : <p className="text-sm text-muted-foreground">Nu există vânzări pentru {client ? "acest client" : "acest produs"} în ultimele 12 luni.</p>}
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
