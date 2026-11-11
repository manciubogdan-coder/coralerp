import { useMemo, useState } from "react";
import { Download, Loader2, Play, Save, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { argusFetch } from "@/lib/argusApi";
import { setPriceRules } from "../../../supabase/functions/_shared/priceRules";
import { sheetFor } from "./PartnerMirror";
import { BASE, COST_KEYS, COST_LABEL, breakEvenPricePct, gamaOf, pctOf, structureOf, type CostKey, type SaleLine, type Scenario, type Structure } from "@/lib/argus/costStructure";

type Article = { id: number; name: string; qty: number; value: number };
type Partner = { id: number; name: string; qty: number; value: number; articles: Article[] };
const PERIODS = [["12", "Medie anuală (12 luni)"], ["1", "Ultima lună"], ["3", "3 luni"], ["6", "6 luni"], ["custom", "Personalizat"]] as const;
const SC_KEY = "argus-cost-scenarios";
const day = (d: Date) => d.toISOString().slice(0, 10);
const n0 = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString("ro-RO") : "—");
const n1 = (v: number) => (Number.isFinite(v) ? v.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—");
const n2 = (v: number) => (Number.isFinite(v) ? v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");
const tone = (v: number) => (v >= 0 ? "text-crm-green" : "text-destructive");
const loadSc = (): Scenario[] => { try { const v = JSON.parse(localStorage.getItem(SC_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const sel = "h-8 rounded-md border border-input bg-background px-2 text-sm";

function Knob({ label, value, onChange, min = -50, max = 50, unit = "%" }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2"><Label className="text-xs">{label}</Label>
        <Input className="h-7 w-20 text-right" inputMode="decimal" value={String(value)} onChange={(e) => { const x = Number(e.target.value.replace(",", ".")); if (Number.isFinite(x)) onChange(x); }} /></div>
      <Slider min={min} max={max} step={0.5} value={[value]} onValueChange={([v]) => onChange(v)} aria-label={label} />
      <p className="text-[11px] text-muted-foreground">{value > 0 ? "+" : ""}{value}{unit}</p>
    </div>
  );
}

/** Real weighted cost structure (sales × today's sheets) and an editable what-if on top. */
export default function CostStructure() {
  const [period, setPeriod] = useState<string>("12");
  const [from, setFrom] = useState(day(new Date(Date.now() - 30 * 86400_000)));
  const [to, setTo] = useState(day(new Date()));
  const [limit, setLimit] = useState(15);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [skipped, setSkipped] = useState<Array<{ partner: string; product: string; value: number; why: string }>>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fPartner, setFPartner] = useState("");
  const [fGama, setFGama] = useState("");
  const [fProduct, setFProduct] = useState("");
  const [groupBy, setGroupBy] = useState<"partner" | "gama" | "product">("gama");
  const [sc, setSc] = useState<Scenario>({ ...BASE, name: "Scenariu nou" });
  const [saved, setSaved] = useState<Scenario[]>(loadSc);

  const range = () => {
    if (period === "custom") return { start: from, end: day(new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400_000)) };
    const end = new Date(); end.setUTCDate(end.getUTCDate() + 1);
    const start = new Date(); start.setUTCMonth(start.getUTCMonth() - Number(period));
    return { start: day(start), end: day(end) };
  };

  const run = async () => {
    setError(null); setLines([]); setSkipped([]);
    try {
      setProgress("Citesc vânzările din Senior…");
      const { partners } = await argusFetch<{ partners: Partner[] }>("partner_mirror_sales", {}, range());
      const list = partners.slice(0, limit);
      const out: SaleLine[] = [], miss: typeof skipped = [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        setProgress(`Calculez structura ${i + 1}/${list.length}: ${p.name}`);
        const arts = p.articles.slice(0, 60);
        try {
          const now = new Date();
          const res = await argusFetch<any>("price_list", {}, { articolIds: arts.map((a) => a.id), partnerId: p.id, year: now.getFullYear(), month: now.getMonth() + 1, rawPriceMode: "annual" });
          if (res.rules) setPriceRules(res.rules.rules);
          for (const a of arts) {
            const it = res.items.find((x: any) => x.product.id === a.id);
            if (!it || "error" in it) { miss.push({ partner: p.name, product: a.name, value: a.value, why: it?.error ?? "Fără fișă" }); continue; }
            const s = sheetFor(it, res, p.name);
            if (!s.complete) { miss.push({ partner: p.name, product: a.name, value: a.value, why: `Fișă incompletă: ${[...s.missingInputs, ...s.missingPrices].slice(0, 3).join(", ")}` }); continue; }
            const n = s.unitsPerCase || 1;
            out.push({ partner: p.name, product: a.name, gama: gamaOf(a.name), qty: a.qty, value: a.value, feePct: s.feePct ?? 0,
              cost: { mp: s.rawMaterial / n, ambalaje: s.packaging / n, manopera: s.labour / n, regie: s.utilities / n, pierderi: s.techLoss / n, aprovizionare: s.supplyTransport / n, distributie: s.logistics / n } });
          }
        } catch (e) { miss.push({ partner: p.name, product: "toate", value: p.value, why: (e as Error).message }); }
        setLines([...out]); setSkipped([...miss]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setProgress(null); }
  };

  const opts = (f: (l: SaleLine) => string) => [...new Set(lines.map(f))].sort((a, b) => a.localeCompare(b, "ro"));
  const view = useMemo(() => lines.filter((l) => (!fPartner || l.partner === fPartner) && (!fGama || l.gama === fGama) && (!fProduct || l.product === fProduct)), [lines, fPartner, fGama, fProduct]);
  const base = useMemo(() => structureOf(view), [view]);
  const what = useMemo(() => structureOf(view, sc), [view, sc]);
  const be = useMemo(() => breakEvenPricePct(view, { ...sc, pricePct: 0 }), [view, sc]);
  const groups = useMemo(() => {
    const m = new Map<string, SaleLine[]>();
    for (const l of view) { const k = l[groupBy]; m.set(k, [...(m.get(k) ?? []), l]); }
    return [...m].map(([k, ls]) => ({ k, b: structureOf(ls), w: structureOf(ls, sc) })).sort((a, b) => a.w.profit - b.w.profit);
  }, [view, groupBy, sc]);

  const setPct = (k: CostKey, v: number) => setSc((s) => ({ ...s, pct: { ...s.pct, [k]: v } }));
  const persist = (list: Scenario[]) => { setSaved(list); localStorage.setItem(SC_KEY, JSON.stringify(list)); };
  const saveSc = () => persist([...saved.filter((x) => x.name !== sc.name), sc]);
  const rowsOf = (s: Structure): Array<[string, number]> => [...COST_KEYS.map((k) => [COST_LABEL[k], s.costs[k]] as [string, number]), [COST_LABEL.taxe, s.fees], [COST_LABEL.profit, s.profit]];

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const pl = (s: Structure) => [["Venituri", Math.round(s.revenue), 100], ...rowsOf(s).map(([k, v]) => [k, Math.round(v), Math.round(pctOf(v, s) * 10) / 10])];
    const cmp = [["Linie P&L", "Realitate (lei)", "Realitate %", `${sc.name} (lei)`, `${sc.name} %`, ...saved.flatMap((x) => [`${x.name} (lei)`, `${x.name} %`])]];
    const all = [base, what, ...saved.map((x) => structureOf(view, x))];
    pl(base).forEach((r, i) => cmp.push([r[0] as string, ...all.flatMap((s) => pl(s)[i].slice(1)) as any]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cmp), "P&L scenarii");
    const g = [["Grup", "Cantitate", "Venituri", ...COST_KEYS.map((k) => `${COST_LABEL[k]} %`), "Taxe %", "Profit real", "Profit scenariu"]];
    for (const x of groups) g.push([x.k, Math.round(x.b.qty), Math.round(x.b.revenue), ...COST_KEYS.map((k) => Math.round(pctOf(x.b.costs[k], x.b) * 10) / 10), Math.round(pctOf(x.b.fees, x.b) * 10) / 10, Math.round(x.b.profit), Math.round(x.w.profit)] as any);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(g), "Pe grupuri");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Partener", "Produs", "Vânzări", "Motiv"], ...skipped.map((s) => [s.partner, s.product, Math.round(s.value), s.why])]), "Neincluse");
    const { start, end } = range();
    XLSX.writeFile(wb, `Structura costuri ${start} - ${end}.xlsx`);
  };

  const skippedValue = skipped.reduce((t, s) => t + s.value, 0);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Structura prețului: unde se duc banii din vânzări</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="inline-flex flex-wrap rounded-md border bg-muted p-1">
              {PERIODS.map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} className={`rounded px-3 py-1 text-sm ${period === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{l}</button>)}
            </div>
            {period === "custom" && <>
              <div className="space-y-1"><Label className="text-xs">De la</Label><Input type="date" className="h-8" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Până la</Label><Input type="date" className="h-8" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>}
            <div className="space-y-1"><Label className="text-xs">Parteneri incluși</Label>
              <select className={sel} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>{[5, 10, 15, 25, 40, 80].map((x) => <option key={x} value={x}>Primii {x} după vânzări</option>)}</select></div>
            <Button size="sm" onClick={run} disabled={!!progress}>{progress ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}Calculează</Button>
            {lines.length > 0 && <Button size="sm" variant="outline" onClick={exportXlsx}><Download className="mr-1 h-4 w-4" />Excel P&L</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Cantitățile și valorile vin din facturile Senior din perioadă; costul pe bucată e din fișele de preț de azi (materii prime la media anuală). Structura e ponderată cu bucățile vândute efectiv.</p>
          {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {lines.length > 0 && <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            {([["Partener", fPartner, setFPartner, opts((l) => l.partner)], ["Gamă", fGama, setFGama, opts((l) => l.gama)], ["Produs", fProduct, setFProduct, opts((l) => l.product)]] as const).map(([lab, v, set, o]) => (
              <div key={lab} className="space-y-1"><Label className="text-xs">{lab}</Label>
                <select className={`${sel} max-w-64`} value={v} onChange={(e) => set(e.target.value)}><option value="">Toți / toate</option>{o.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            ))}
            <div className="space-y-1"><Label className="text-xs">Defalcare pe</Label>
              <select className={sel} value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}><option value="gama">Gamă</option><option value="partner">Partener</option><option value="product">Produs</option></select></div>
          </div>}
          {skipped.length > 0 && <details className="text-xs"><summary className="cursor-pointer text-crm-warning">{skipped.length} produse nu sunt incluse ({n0(skippedValue)} lei vânzări) — fișă incompletă</summary>
            <ul className="mt-1 max-h-40 overflow-auto">{skipped.map((s, i) => <li key={i}>{s.partner} · {s.product}: {s.why}</li>)}</ul></details>}
        </CardContent>
      </Card>

      {view.length > 0 && <>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">P&L: realitate vs. „{sc.name}”</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="py-1">Linie</th><th className="text-right">Realitate lei</th><th className="text-right">%</th><th className="text-right">Scenariu lei</th><th className="text-right">%</th><th className="text-right">Diferență</th><th className="w-40" /></tr></thead>
                <tbody>
                  <tr className="border-b font-medium"><td className="py-1">Venituri ({n0(base.qty)} buc)</td><td className="text-right tabular-nums">{n0(base.revenue)}</td><td className="text-right">100</td><td className="text-right tabular-nums">{n0(what.revenue)}</td><td className="text-right">100</td><td className={`text-right tabular-nums ${tone(what.revenue - base.revenue)}`}>{n0(what.revenue - base.revenue)}</td><td /></tr>
                  {rowsOf(base).map(([k, v], i) => { const w = rowsOf(what)[i][1]; const isP = i === rowsOf(base).length - 1; const d = isP ? w - v : v - w; return (
                    <tr key={k} className={`border-b last:border-0 ${isP ? "font-semibold" : ""}`}>
                      <td className="py-1">{k}</td><td className={`text-right tabular-nums ${isP ? tone(v) : ""}`}>{n0(v)}</td><td className="text-right tabular-nums">{n1(pctOf(v, base))}</td>
                      <td className={`text-right tabular-nums ${isP ? tone(w) : ""}`}>{n0(w)}</td><td className="text-right tabular-nums">{n1(pctOf(w, what))}</td>
                      <td className={`text-right tabular-nums ${tone(d)}`}>{n0(isP ? w - v : w - v)}</td>
                      <td><div className="h-2 rounded bg-muted"><div className={`h-2 rounded ${isP ? (w >= 0 ? "bg-crm-green" : "bg-destructive") : "bg-primary"}`} style={{ width: `${Math.min(100, Math.abs(pctOf(w, what)))}%` }} /></div></td>
                    </tr>); })}
                </tbody>
              </table>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <p>Cost/buc: <b>{n2(base.qty ? base.totalCost / base.qty : NaN)}</b> → <b>{n2(what.qty ? what.totalCost / what.qty : NaN)}</b> lei</p>
                <p>Profit pe lună în scenariu: <b className={tone(what.profit)}>{n0(what.profit / (period === "custom" ? Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / (30 * 86400_000)) : Number(period)))} lei</b></p>
                <p>Prag de rentabilitate: {be == null ? "—" : <b>{be > 0 ? "+" : ""}{n1(be)}% la preț</b>}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Joacă-te cu scenariul</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={sc.name} onChange={(e) => setSc({ ...sc, name: e.target.value })} aria-label="Nume scenariu" />
              <Knob label="Preț de vânzare" value={sc.pricePct} onChange={(v) => setSc({ ...sc, pricePct: v })} min={-30} max={30} />
              <Knob label="Volum vândut" value={sc.volumePct} onChange={(v) => setSc({ ...sc, volumePct: v })} min={-80} max={100} />
              <Knob label="Taxe rețea (puncte procentuale)" value={sc.feeDelta} onChange={(v) => setSc({ ...sc, feeDelta: v })} min={-20} max={20} unit=" pp" />
              {COST_KEYS.map((k) => <Knob key={k} label={COST_LABEL[k]} value={sc.pct[k] ?? 0} onChange={(v) => setPct(k, v)} />)}
              <div className="flex gap-2"><Button size="sm" onClick={saveSc}><Save className="mr-1 h-4 w-4" />Salvează</Button><Button size="sm" variant="outline" onClick={() => setSc({ ...BASE, name: "Scenariu nou" })}>Resetează</Button></div>
              <p className="text-[11px] text-muted-foreground">Volumul schimbă doar bucățile; costurile pe bucată rămân, ca să vezi și efectul invers (ex. regia care rămâne când scade volumul pune „Regie” în plus).</p>
            </CardContent>
          </Card>
        </div>

        {saved.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Scenarii salvate (pe selecția curentă)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground"><tr><th>Scenariu</th><th className="text-right">Venituri</th><th className="text-right">Costuri</th><th className="text-right">Profit</th><th className="text-right">Profit %</th><th className="text-right">vs. realitate</th><th /></tr></thead>
            <tbody>{saved.map((x) => { const s = structureOf(view, x); return (
              <tr key={x.name} className="border-b last:border-0"><td className="py-1"><button className="underline" onClick={() => setSc(x)}>{x.name}</button></td><td className="text-right tabular-nums">{n0(s.revenue)}</td><td className="text-right tabular-nums">{n0(s.totalCost + s.fees)}</td><td className={`text-right tabular-nums ${tone(s.profit)}`}>{n0(s.profit)}</td><td className="text-right">{n1(pctOf(s.profit, s))}</td><td className={`text-right tabular-nums ${tone(s.profit - base.profit)}`}>{n0(s.profit - base.profit)}</td>
                <td><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Șterge ${x.name}`} onClick={() => persist(saved.filter((y) => y.name !== x.name))}><Trash2 className="h-3.5 w-3.5" /></Button></td></tr>); })}</tbody>
          </table></CardContent></Card>}

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Structura pe {groupBy === "gama" ? "game" : groupBy === "partner" ? "parteneri" : "produse"} (cei mai slabi sus)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto"><table className="w-full text-xs">
            <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Grup</th><th className="text-right">Venituri</th>{COST_KEYS.map((k) => <th key={k} className="text-right">{COST_LABEL[k]} %</th>)}<th className="text-right">Taxe %</th><th className="text-right">Profit %</th><th className="text-right">Profit lei</th><th className="text-right">Scenariu lei</th></tr></thead>
            <tbody>{groups.map((g) => (
              <tr key={g.k} className="border-b last:border-0"><td className="py-1">{g.k}</td><td className="text-right tabular-nums">{n0(g.b.revenue)}</td>{COST_KEYS.map((k) => <td key={k} className="text-right tabular-nums">{n1(pctOf(g.b.costs[k], g.b))}</td>)}<td className="text-right">{n1(pctOf(g.b.fees, g.b))}</td><td className={`text-right ${tone(g.b.profit)}`}>{n1(pctOf(g.b.profit, g.b))}</td><td className={`text-right tabular-nums ${tone(g.b.profit)}`}>{n0(g.b.profit)}</td><td className={`text-right tabular-nums ${tone(g.w.profit)}`}>{n0(g.w.profit)}</td></tr>
            ))}</tbody>
          </table></CardContent></Card>
      </>}
    </div>
  );
}
