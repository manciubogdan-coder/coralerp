import { Fragment, useMemo, useState } from "react";
import { Download, Loader2, Play, Save, Trash2, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { argusFetch } from "@/lib/argusApi";
import { setPriceRules } from "../../../supabase/functions/_shared/priceRules";
import { sheetFor } from "./PartnerMirror";
import { ACCOUNTS, BASE, COST_KEYS, COST_LABEL, DEFAULT_FIXED, accountMatch, breakEvenPricePct, fixedOf, gamaOf, partnerContributions, pctOf, structureOf, type CostKey, type SaleLine, type Scenario, type Structure } from "@/lib/argus/costStructure";
import { supabase } from "@/integrations/supabase/client";
import { edgeFetchJson } from "@/lib/edgeFetch";

const CLOUD_URL = "https://yeniohmlmxhjzywqlidx.supabase.co";
const CLOUD_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbmlvaG1sbXhoanp5d3FsaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjM0ODgsImV4cCI6MjA5MzEzOTQ4OH0.8rNaYX5D5hk22o_bUqERO9ChJfQdJYkaKiD9UsRi1mE";
type Account = { period: string; cont: string; name: string; rev: number; exp: number };
async function loadJournal(years: number[]): Promise<Account[]> {
  const { data } = await supabase.auth.getSession();
  const out: Account[] = [];
  for (const y of years) {
    const r: any = await edgeFetchJson(`${CLOUD_URL}/functions/v1/erp-mirror`, { method: "POST", headers: { apikey: CLOUD_ANON, Authorization: `Bearer ${CLOUD_ANON}`, "x-app-token": data.session?.access_token ?? "" }, body: { action: "pnl", year: y } });
    if (!r?.live) throw new Error(r?.live_error || "Registrul contabil Senior nu a răspuns.");
    out.push(...(r.accounts ?? []));
  }
  return out;
}
type RowKey = CostKey | "taxe" | "profit";
const FORMULA: Record<RowKey, string> = {
  mp: "Din fișa de preț: kg materie primă din rețetă × preț mediu anual NIR (Senior) ÷ bucăți pe bax, × bucăți facturate.",
  ambalaje: "Din fișa de preț: caserole, folii, etichete din rețetă × ultima intrare NIR, × bucăți facturate.",
  manopera: "Din fișa de preț: oameni pe linie × cost oră ÷ viteza normată a liniei (+ regie %). Nu conține ore moarte, TESA, depozit.",
  regie: "Procentul de regie din regulile de calcul aplicat pe fișă — alocare, nu factura reală de energie/chirie.",
  pierderi: "Pierderea tehnologică din fișă + „Pierderi reale % din MP” din scenariu (marfa aruncată la sortare/curățare).",
  aprovizionare: "Cost camion (facturi 624.01) ÷ paleți comandați pe zi de livrare ÷ bucăți pe palet.",
  distributie: "Facturi cărăuș „TRANSPORT DIST <cursă>” ÷ paleți facturați magazinelor de pe cursă.",
  taxe: "Taxele de rețea din tabelul clientului (Reguli de calcul) × valoarea facturată.",
  profit: "Venituri − taxe rețea − toate costurile de mai sus.",
};

type Article = { id: number; name: string; qty: number; value: number };
type Partner = { id: number; name: string; qty: number; value: number; articles: Article[] };
const PERIODS = [["ytd", "Anul curent"], ["12", "Medie anuală (12 luni)"], ["1", "Ultima lună"], ["3", "3 luni"], ["6", "6 luni"], ["custom", "Personalizat"]] as const;
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
  const [period, setPeriod] = useState<string>("ytd");
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
  const [allPartners, setAllPartners] = useState<Partner[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [openRow, setOpenRow] = useState<RowKey | "venituri" | null>(null);
  const [journal, setJournal] = useState<Account[] | null>(null);
  const [journalErr, setJournalErr] = useState<string | null>(null);

  const loadPartners = async () => {
    setLoadingPartners(true);
    try {
      const { partners } = await argusFetch<{ partners: Partner[] }>("partner_mirror_sales", {}, range());
      setAllPartners(partners);
      setExcluded(new Set());
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingPartners(false); }
  };
  const togglePartner = (id: number, on: boolean) => setExcluded((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });
  const changePeriod = (p: string) => { setPeriod(p); setAllPartners(null); setExcluded(new Set()); };

  const range = () => {
    if (period === "custom") return { start: from, end: day(new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400_000)) };
    const end = new Date(); end.setUTCDate(end.getUTCDate() + 1);
    if (period === "ytd") return { start: `${new Date().getUTCFullYear()}-01-01`, end: day(end) };
    const start = new Date(); start.setUTCMonth(start.getUTCMonth() - Number(period));
    return { start: day(start), end: day(end) };
  };

  const run = async () => {
    setError(null); setLines([]); setSkipped([]); setJournal(null); setJournalErr(null);
    const { start, end } = range();
    const ys = [...new Set([Number(start.slice(0, 4)), Number(end.slice(0, 4))])];
    void loadJournal(ys).then(setJournal, (e) => setJournalErr((e as Error).message));
    try {
      setProgress("Citesc vânzările din Senior…");
      const partners = allPartners ?? (await argusFetch<{ partners: Partner[] }>("partner_mirror_sales", {}, range())).partners;
      setAllPartners(partners);
      const list = partners.filter((p) => !excluded.has(p.id)).slice(0, limit);
      if (list.length === 0) { setError("Nu ai selectat niciun partener."); return; }
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
  const ROW_KEYS: RowKey[] = [...COST_KEYS, "taxe", "profit"];
  const contrib = useMemo(() => partnerContributions(view, sc), [view, sc]);
  const toggleDrop = (p: string) => setSc((s) => { const d = new Set(s.dropPartners ?? []); if (d.has(p)) d.delete(p); else d.add(p); return { ...s, dropPartners: [...d] }; });
  const months = useMemo(() => { const { start, end } = range(); const a = start.slice(0, 7).replace("-", ""), b = end.slice(0, 7).replace("-", ""); return { a, b }; }, [period, from, to]);
  const realOf = (key: RowKey | "venituri") => {
    if (!journal || key === "profit") return null;
    const pre = ACCOUNTS[key];
    const rows = journal.filter((r) => r.period >= months.a && r.period <= months.b && accountMatch(r.cont, pre));
    const byCont = new Map<string, { name: string; v: number }>();
    for (const r of rows) { const x = byCont.get(r.cont) ?? { name: r.name, v: 0 }; x.v += key === "venituri" ? r.rev : r.exp; byCont.set(r.cont, x); }
    return { total: [...byCont.values()].reduce((t, x) => t + x.v, 0), accounts: [...byCont].sort((a, b) => b[1].v - a[1].v) };
  };
  const lineValue = (l: SaleLine, key: RowKey | "venituri") => key === "venituri" ? l.value : key === "taxe" ? l.value * l.feePct / 100 : key === "profit" ? structureOf([l]).profit : l.cost[key] * l.qty;
  const top = (key: RowKey | "venituri", by: "product" | "partner") => {
    const m = new Map<string, number>();
    for (const l of view) m.set(l[by], (m.get(l[by]) ?? 0) + lineValue(l, key));
    return [...m].sort((a, b) => (key === "profit" ? a[1] - b[1] : b[1] - a[1])).slice(0, 10);
  };
  const monthsCount = period === "custom" ? Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / (30 * 86400_000)) : period === "ytd" ? new Date().getUTCMonth() + 1 : Number(period);
  const books = useMemo(() => {
    if (!journal) return null;
    const rows = journal.filter((r) => r.period >= months.a && r.period <= months.b);
    const byMonth = new Map<string, { rev: number; exp: number }>();
    for (const r of rows) { const m = byMonth.get(r.period) ?? { rev: 0, exp: 0 }; if (r.cont.startsWith("7")) m.rev += r.rev; if (r.cont.startsWith("6")) m.exp += r.exp; byMonth.set(r.period, m); }
    const sum = (f: (r: Account) => boolean, v: (r: Account) => number) => rows.filter(f).reduce((t, r) => t + v(r), 0);
    const mapped = COST_KEYS.flatMap((k) => ACCOUNTS[k]);
    const line = (k: CostKey) => sum((r) => accountMatch(r.cont, ACCOUNTS[k]), (r) => r.exp);
    return {
      months: [...byMonth].sort((a, b) => a[0].localeCompare(b[0])),
      sales: sum((r) => r.cont.startsWith("70"), (r) => r.rev),
      otherIncome: sum((r) => r.cont.startsWith("7") && !r.cont.startsWith("70"), (r) => r.rev),
      costs: Object.fromEntries(COST_KEYS.map((k) => [k, line(k)])) as Record<CostKey, number>,
      unmapped: [...rows.filter((r) => r.cont.startsWith("6") && !accountMatch(r.cont, mapped)).reduce((m, r) => m.set(r.cont, { name: r.name, v: (m.get(r.cont)?.v ?? 0) + r.exp }), new Map<string, { name: string; v: number }>())].sort((a, b) => b[1].v - a[1].v),
      rev: sum((r) => r.cont.startsWith("7"), (r) => r.rev), exp: sum((r) => r.cont.startsWith("6"), (r) => r.exp),
    };
  }, [journal, months]);
  const realProfit = journal ? (realOf("venituri")!.total - journal.filter((r) => r.period >= months.a && r.period <= months.b && r.cont.startsWith("6")).reduce((t, r) => t + r.exp, 0)) : null;
  const Detail = ({ k }: { k: RowKey | "venituri" }) => {
    const real = realOf(k); const theo = k === "venituri" ? base.revenue : k === "taxe" ? base.fees : k === "profit" ? base.profit : base.costs[k];
    return (
      <tr className="border-b bg-muted/40"><td colSpan={9} className="p-3 text-xs">
        <p className="mb-2"><b>Cum se calculează:</b> {k === "venituri" ? "Cantitate × preț din facturile Senior ale partenerilor incluși, în perioada aleasă." : FORMULA[k]}</p>
        {k !== "venituri" && k !== "taxe" && k !== "profit" && <p className="mb-2">Parte fixă în scenariu: <b>{Math.round(fixedOf(sc, k) * 100)}%</b> (rămâne și dacă scade volumul sau renunți la un client).</p>}
        <div className="grid gap-3 md:grid-cols-3">
          {(["product", "partner"] as const).map((by) => <div key={by}><p className="mb-1 font-medium">Top 10 {by === "product" ? "produse" : "parteneri"}</p>
            <table className="w-full"><tbody>{top(k, by).map(([n, v]) => <tr key={n} className="border-b last:border-0"><td className="truncate py-0.5 pr-2">{n}</td><td className="text-right tabular-nums">{n0(v)}</td><td className="w-12 text-right text-muted-foreground">{n1(theo ? (v / theo) * 100 : 0)}%</td></tr>)}</tbody></table></div>)}
          <div><p className="mb-1 font-medium">Contabilitate Senior (toată firma, {months.a}–{months.b})</p>
            {journalErr && <p className="text-destructive">{journalErr}</p>}
            {!journal && !journalErr && <p className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Citesc registrul…</p>}
            {k === "profit" && realProfit != null && <p>Rezultat real (clasa 7 − clasa 6): <b className={tone(realProfit)}>{n0(realProfit)} lei</b> vs. fișe <b>{n0(theo)}</b> lei.</p>}
            {real && <>
              <table className="w-full"><tbody>{real.accounts.slice(0, 8).map(([c, x]) => <tr key={c} className="border-b last:border-0"><td className="pr-2">{c}</td><td className="truncate pr-2 text-muted-foreground">{x.name}</td><td className="text-right tabular-nums">{n0(x.v)}</td></tr>)}</tbody></table>
              <p className="mt-1">Real: <b>{n0(real.total)}</b> · fișe: <b>{n0(theo)}</b> · diferență: <b className={tone(theo - real.total)}>{n0(real.total - theo)}</b> lei</p>
              {real.accounts.length === 0 && <p className="text-muted-foreground">Fără rulaj pe conturile {ACCOUNTS[k as keyof typeof ACCOUNTS].join(", ")}.</p>}
            </>}
            <p className="mt-1 text-muted-foreground">Contabilitatea e pe toată firma și toți clienții; fișele doar pe partenerii incluși ({excluded.size ? `${(allPartners?.length ?? 0) - excluded.size}` : "toți, max " + limit}).</p>
          </div>
        </div>
      </td></tr>);
  };

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
              {PERIODS.map(([k, l]) => <button key={k} onClick={() => changePeriod(k)} className={`rounded px-3 py-1 text-sm ${period === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{l}</button>)}
            </div>
            {period === "custom" && <>
              <div className="space-y-1"><Label className="text-xs">De la</Label><Input type="date" className="h-8" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Până la</Label><Input type="date" className="h-8" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>}
            <div className="space-y-1"><Label className="text-xs">Parteneri incluși</Label>
              <div className="flex gap-1">
                <Popover onOpenChange={(o) => { if (o && !allPartners && !loadingPartners) void loadPartners(); }}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8">
                      <Users className="mr-1 h-4 w-4" />
                      {!allPartners ? "Alege partenerii" : excluded.size === 0 ? `Toți (${allPartners.length})` : `${allPartners.length - excluded.size} din ${allPartners.length}`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-2" align="start">
                    {loadingPartners && <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Citesc partenerii din Senior…</p>}
                    {allPartners && <>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-muted">
                        <Checkbox checked={excluded.size === 0} onCheckedChange={(c) => setExcluded(c ? new Set() : new Set(allPartners.map((p) => p.id)))} />
                        Toți
                      </label>
                      <div className="mt-1 max-h-72 overflow-y-auto border-t pt-1">
                        {allPartners.map((p) => (
                          <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                            <Checkbox checked={!excluded.has(p.id)} onCheckedChange={(c) => togglePartner(p.id, !!c)} />
                            <span className="flex-1 truncate">{p.name}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{n0(p.value)} lei</span>
                          </label>
                        ))}
                      </div>
                    </>}
                  </PopoverContent>
                </Popover>
                <select className={sel} value={limit} onChange={(e) => setLimit(Number(e.target.value))} title="Maxim parteneri luați în calcul">{[5, 10, 15, 25, 40, 80].map((x) => <option key={x} value={x}>max {x}</option>)}</select>
              </div></div>
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
        <Card className={books && books.rev - books.exp < 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-base">Realitatea din contabilitatea Senior ({months.a}–{months.b}, toată firma)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {journalErr && <p className="text-destructive">Nu am putut citi registrul contabil: {journalErr}</p>}
            {!books && !journalErr && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Citesc registrul contabil Senior…</p>}
            {books && <>
              <div className="grid gap-2 sm:grid-cols-4">
                <p>Venituri (clasa 7): <b>{n0(books.rev)}</b> lei</p>
                <p>Cheltuieli (clasa 6): <b>{n0(books.exp)}</b> lei</p>
                <p>Rezultat real: <b className={tone(books.rev - books.exp)}>{n0(books.rev - books.exp)}</b> lei</p>
                <p>Pe lună: <b className={tone(books.rev - books.exp)}>{n0((books.rev - books.exp) / Math.max(1, books.months.length))}</b> lei</p>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Lună</th>{books.months.map(([m]) => <th key={m} className="text-right">{m.slice(4)}.{m.slice(0, 4)}</th>)}</tr></thead>
                <tbody>
                  <tr className="border-b"><td className="py-1">Venituri</td>{books.months.map(([m, x]) => <td key={m} className="text-right tabular-nums">{n0(x.rev)}</td>)}</tr>
                  <tr className="border-b"><td className="py-1">Cheltuieli</td>{books.months.map(([m, x]) => <td key={m} className="text-right tabular-nums">{n0(x.exp)}</td>)}</tr>
                  <tr className="font-medium"><td className="py-1">Rezultat</td>{books.months.map(([m, x]) => <td key={m} className={`text-right tabular-nums ${tone(x.rev - x.exp)}`}>{n0(x.rev - x.exp)}</td>)}</tr>
                </tbody></table></div>
              <p className="text-xs text-muted-foreground">Fișele de mai jos acoperă {n1(books.sales ? base.revenue / books.sales * 100 : 0)}% din vânzările din contabilitate (doar partenerii incluși). Pentru o comparație completă bifează toți partenerii și mărește „max”.</p>
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Unde e diferența</th><th className="text-right">Fișe (teoretic)</th><th className="text-right">Contabilitate</th><th className="text-right">Diferență</th></tr></thead>
                <tbody>
                  <tr className="border-b"><td className="py-1">Vânzări (70x)</td><td className="text-right tabular-nums">{n0(base.revenue)}</td><td className="text-right tabular-nums">{n0(books.sales)}</td><td className={`text-right tabular-nums ${tone(books.sales - base.revenue)}`}>{n0(books.sales - base.revenue)}</td></tr>
                  {COST_KEYS.map((k) => <tr key={k} className="border-b"><td className="py-1">{COST_LABEL[k]} <span className="text-muted-foreground">({ACCOUNTS[k].join(", ")})</span></td><td className="text-right tabular-nums">{n0(base.costs[k])}</td><td className="text-right tabular-nums">{n0(books.costs[k])}</td><td className={`text-right tabular-nums ${tone(base.costs[k] - books.costs[k])}`}>{n0(books.costs[k] - base.costs[k])}</td></tr>)}
                  <tr className="border-b"><td className="py-1">Taxe rețea client (în fișe; în contabilitate sunt în conturile de mai jos)</td><td className="text-right tabular-nums">{n0(base.fees)}</td><td className="text-right">—</td><td /></tr>
                  <tr className="border-b"><td className="py-1"><details><summary className="cursor-pointer">Alte cheltuieli care nu sunt în fișe ({books.unmapped.length} conturi)</summary>
                    <table className="mt-1 w-full"><tbody>{books.unmapped.slice(0, 25).map(([c, x]) => <tr key={c}><td className="pr-2">{c}</td><td className="truncate pr-2 text-muted-foreground">{x.name}</td><td className="text-right tabular-nums">{n0(x.v)}</td></tr>)}</tbody></table></details></td>
                    <td className="text-right">0</td><td className="text-right tabular-nums">{n0(books.unmapped.reduce((t, [, x]) => t + x.v, 0))}</td><td className="text-right tabular-nums text-destructive">{n0(books.unmapped.reduce((t, [, x]) => t + x.v, 0))}</td></tr>
                  <tr className="border-b"><td className="py-1">Alte venituri (71x–79x)</td><td className="text-right">0</td><td className="text-right tabular-nums">{n0(books.otherIncome)}</td><td /></tr>
                  <tr className="font-semibold"><td className="py-1">Rezultat</td><td className={`text-right tabular-nums ${tone(base.profit)}`}>{n0(base.profit)}</td><td className={`text-right tabular-nums ${tone(books.rev - books.exp)}`}>{n0(books.rev - books.exp)}</td><td className="text-right tabular-nums">{n0(books.rev - books.exp - base.profit)}</td></tr>
                </tbody></table></div>
            </>}
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Model din fișele de preț (teoretic, partenerii incluși) vs. „{sc.name}”</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="py-1">Linie</th><th className="text-right">Fișe lei</th><th className="text-right">%</th><th className="text-right">Scenariu lei</th><th className="text-right">%</th><th className="text-right">Diferență</th><th className="w-40" /></tr></thead>
                <tbody>
                  <tr className="cursor-pointer border-b font-medium hover:bg-muted/50" onClick={() => setOpenRow(openRow === "venituri" ? null : "venituri")}><td className="py-1">▸ Venituri ({n0(base.qty)} buc)</td><td className="text-right tabular-nums">{n0(base.revenue)}</td><td className="text-right">100</td><td className="text-right tabular-nums">{n0(what.revenue)}</td><td className="text-right">100</td><td className={`text-right tabular-nums ${tone(what.revenue - base.revenue)}`}>{n0(what.revenue - base.revenue)}</td><td /></tr>
                  {openRow === "venituri" && <Detail k="venituri" />}
                  {rowsOf(base).map(([k, v], i) => { const w = rowsOf(what)[i][1]; const isP = i === rowsOf(base).length - 1; const d = isP ? w - v : v - w; const rk = ROW_KEYS[i]; return (<Fragment key={k}>
                    <tr key={k} onClick={() => setOpenRow(openRow === rk ? null : rk)} className={`cursor-pointer border-b hover:bg-muted/50 ${isP ? "font-semibold" : ""}`}>
                      <td className="py-1">{openRow === rk ? "▾" : "▸"} {k}</td><td className={`text-right tabular-nums ${isP ? tone(v) : ""}`}>{n0(v)}</td><td className="text-right tabular-nums">{n1(pctOf(v, base))}</td>
                      <td className={`text-right tabular-nums ${isP ? tone(w) : ""}`}>{n0(w)}</td><td className="text-right tabular-nums">{n1(pctOf(w, what))}</td>
                      <td className={`text-right tabular-nums ${tone(d)}`}>{n0(isP ? w - v : w - v)}</td>
                      <td><div className="h-2 rounded bg-muted"><div className={`h-2 rounded ${isP ? (w >= 0 ? "bg-crm-green" : "bg-destructive") : "bg-primary"}`} style={{ width: `${Math.min(100, Math.abs(pctOf(w, what)))}%` }} /></div></td>
                    </tr>{openRow === rk && <Detail k={rk} />}</Fragment>); })}
                </tbody>
              </table>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <p>Cost/buc: <b>{n2(base.qty ? base.totalCost / base.qty : NaN)}</b> → <b>{n2(what.qty ? what.totalCost / what.qty : NaN)}</b> lei</p>
                <p>Profit teoretic pe lună (fișe, scenariu): <b className={tone(what.profit)}>{n0(what.profit / monthsCount)} lei</b>{books && <> · real: <b className={tone(books.rev - books.exp)}>{n0((books.rev - books.exp) / Math.max(1, books.months.length))}</b></>}</p>
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
              <Knob label="Pierderi reale (% din materia primă)" value={sc.lossPct ?? 0} onChange={(v) => setSc({ ...sc, lossPct: v })} min={0} max={40} />
              {COST_KEYS.map((k) => <Knob key={k} label={k === "pierderi" ? "Pierderi din fișă" : COST_LABEL[k]} value={sc.pct[k] ?? 0} onChange={(v) => setPct(k, v)} />)}
              <details className="rounded border p-2 text-xs"><summary className="cursor-pointer font-medium">Cât din fiecare cost e fix</summary>
                <p className="my-1 text-muted-foreground">Partea fixă rămâne când scade volumul sau renunți la un client și se împarte pe bucățile rămase.</p>
                {COST_KEYS.map((k) => <div key={k} className="flex items-center justify-between gap-2 py-0.5"><span>{COST_LABEL[k]}</span>
                  <Input className="h-7 w-16 text-right" inputMode="decimal" value={String(sc.fixedPct?.[k] ?? DEFAULT_FIXED[k])} onChange={(e) => { const x = Number(e.target.value.replace(",", ".")); if (Number.isFinite(x)) setSc({ ...sc, fixedPct: { ...sc.fixedPct, [k]: x } }); }} /></div>)}
              </details>
              <div className="flex gap-2"><Button size="sm" onClick={saveSc}><Save className="mr-1 h-4 w-4" />Salvează</Button><Button size="sm" variant="outline" onClick={() => setSc({ ...BASE, name: "Scenariu nou" })}>Resetează</Button></div>
              <p className="text-[11px] text-muted-foreground">Volumul schimbă doar bucățile; costurile pe bucată rămân, ca să vezi și efectul invers (ex. regia care rămâne când scade volumul pune „Regie” în plus).</p>
            </CardContent>
          </Card>
        </div>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Portofoliu clienți: ce se întâmplă dacă renunț la unul</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <p className="mb-2 text-xs text-muted-foreground">Contribuția = venituri − taxe − costuri variabile. Dacă renunți la client pierzi contribuția lui; partea lui de costuri fixe rămâne și o plătesc ceilalți. Bifează ca să-l scoți din scenariu.</p>
            <table className="w-full text-xs">
              <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1">Renunț</th><th>Partener</th><th className="text-right">Venituri</th><th className="text-right">Costuri variabile</th><th className="text-right">Contribuție</th><th className="text-right">Contribuție %</th><th className="text-right">Costuri fixe purtate</th><th className="text-right">Profit „pe hârtie”</th><th className="text-right">Efect real dacă renunț</th></tr></thead>
              <tbody>{contrib.map((c) => { const on = (sc.dropPartners ?? []).includes(c.partner); return (
                <tr key={c.partner} className={`border-b last:border-0 ${on ? "bg-destructive/5 line-through decoration-muted-foreground/40" : ""}`}>
                  <td className="py-1"><Checkbox checked={on} onCheckedChange={() => toggleDrop(c.partner)} aria-label={`Renunț la ${c.partner}`} /></td>
                  <td className="max-w-56 truncate">{c.partner}</td><td className="text-right tabular-nums">{n0(c.revenue)}</td><td className="text-right tabular-nums">{n0(c.variable)}</td>
                  <td className={`text-right tabular-nums ${tone(c.contribution)}`}>{n0(c.contribution)}</td><td className="text-right">{n1(c.revenue ? c.contribution / c.revenue * 100 : 0)}</td>
                  <td className="text-right tabular-nums">{n0(c.fixedShare)}</td><td className={`text-right tabular-nums ${tone(c.fullProfit)}`}>{n0(c.fullProfit)}</td>
                  <td className={`text-right font-medium tabular-nums ${tone(c.dropDelta)}`}>{c.dropDelta > 0 ? "+" : ""}{n0(c.dropDelta)}</td>
                </tr>); })}</tbody>
            </table>
            {(sc.dropPartners?.length ?? 0) > 0 && <p className="mt-2 text-sm">Fără {sc.dropPartners!.join(", ")}: profit <b className={tone(what.profit)}>{n0(what.profit)}</b> lei (față de {n0(base.profit)}), cost/buc la restul {n2(base.qty ? base.totalCost / base.qty : NaN)} → <b>{n2(what.qty ? what.totalCost / what.qty : NaN)}</b> lei, din care fix {n2(base.qty ? COST_KEYS.reduce((t, k) => t + base.costs[k] * fixedOf(sc, k), 0) / base.qty : NaN)} → <b>{n2(what.qty ? COST_KEYS.reduce((t, k) => t + view.reduce((a, l) => a + l.cost[k] * l.qty, 0) * fixedOf(sc, k) * (1 + (sc.pct[k] ?? 0) / 100), 0) / what.qty : NaN)}</b> lei.</p>}
          </CardContent></Card>

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
