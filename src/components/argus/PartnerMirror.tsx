import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Loader2, Play, Search, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { argusFetch } from "@/lib/argusApi";
import { type SheetComponent } from "../../../supabase/functions/_shared/priceSheet";
import { configuredSheet, type PriceConfig } from "../../../supabase/functions/_shared/priceConfig";
import { lastClosedMonth, prefilledConfig } from "../../../supabase/functions/_shared/priceDefaults";
import { priceRules, profitFor, setPriceRules } from "../../../supabase/functions/_shared/priceRules";
import { currentPrice, groupPartners, mirrorLine, palletDensity, periodMonths, profitPerPiece, projectLine, targetCost, type PriceBasis } from "../../../supabase/functions/_shared/partnerMirrorMath";

type Article = { id: number; name: string; qty: number; value: number; lastQty?: number; lastValue?: number; latestPrice?: number | null; latestDate?: string | null };
type Partner = { key?: string; id: number; name: string; group?: string | null; subgroup?: string | null; qty: number; value: number; articles: Article[] };
type Item = { product: { id: number; name: string; unitsPerCase: number }; defaults: PriceConfig; components: SheetComponent[] };
type ListResult = { eur: { rate: number } | null; logistics: { distribution?: Record<string, PriceConfig | null> }; rules?: { rules: any }; items: Array<Item | { product: { id: number; name: string }; error: string }> };
type Sheet = ReturnType<typeof configuredSheet>["sheet"];
type Line = { a: Article; ppp?: number | null; sheet: Sheet | null; m: ReturnType<typeof mirrorLine> | null; error?: string };
type Row = { p: Partner; lines: Line[]; error?: string; sales: number; actual: number; proposedRevenue: number; proposed: number; covered: number; missing: number };

const PERIODS = [["1", "Ultima lună"], ["3", "3 luni"], ["6", "6 luni"], ["12", "1 an"], ["custom", "Personalizat"]] as const;
const day = (d: Date) => d.toISOString().slice(0, 10);
const n0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : Math.round(v).toLocaleString("ro-RO"));
const n2 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const tone = (v: number) => (v >= 0 ? "text-crm-green" : "text-destructive");
const ZERO = (eur: number) => ({ labourPerPiece: 0, utilitiesPerPiece: 0, supplyPerKg: 0, distributionPerPiece: 0, clientFeePerPiece: 0, eurRate: eur, eurBufferPct: priceRules().eurBufferPct, techLossPct: 0, marginPct: 0 });
const isItem = (x: ListResult["items"][number]): x is Item => !("error" in x);

export const MONTHS_RO = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
/** Cost month shown and sent to price_list: by default the last whole month, like the price calculator. */
export const defaultCostMonth = () => lastClosedMonth(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" }));

export function sheetFor(it: Item, res: ListResult, partner: string, ym = defaultCostMonth()): Sheet {
  const cfg: PriceConfig = { year: ym.year, month: ym.month, rawPriceMode: "annual", route: it.defaults.route, supplyBasis: "pallet", ...(it.defaults.labourLine ? { labourLine: it.defaults.labourLine } : {}), rates: { profitPct: profitFor(it.product.name, null, partner).pct }, components: {} };
  const comps = it.components.map((c) => ({ ...c, ...(c.kind === "mp" || c.kind === "marfa" ? { price: c.annualPrice ?? null } : {}) }));
  const effective = prefilledConfig({ ...it, logistics: res.logistics }, cfg);
  return configuredSheet({ ...it, components: comps }, ZERO(res.eur?.rate ?? 0), effective).sheet;
}

function summarize(p: Partner, lines: Line[]): Row {
  const ok = lines.filter((l) => l.m);
  const s = (f: (m: NonNullable<Line["m"]>) => number) => ok.reduce((t, l) => t + f(l.m!), 0);
  return { p, lines, sales: s((m) => m.value), actual: s((m) => m.actualProfit), proposedRevenue: s((m) => m.proposedRevenue), proposed: s((m) => m.proposedProfit), covered: ok.length, missing: lines.length - ok.length };
}

/** What-if and reverse target cost for one product: the user types the price the buyer accepts. */
function Simulator({ l }: { l: Line }) {
  const s = l.sheet!;
  const n = s.unitsPerCase || 1;
  const [price, setPrice] = useState(n2(currentPrice(l.a, "latest").price || l.m!.actualPrice).replace(/\./g, ""));
  const v = Number(price.replace(",", "."));
  const valid = Number.isFinite(v) && v > 0;
  const margin = priceRules().marginPct;
  const profitPct = s.profitPct ?? priceRules().profitPct;
  const unit = valid ? profitPerPiece(s, v) : 0;
  const target = valid ? targetCost(v, s.feePct, margin, profitPct) : 0;
  const cost = s.perPiece.factoryGate;
  const parts: Array<[string, number]> = [["Materie primă", s.rawMaterial], ["Ambalaje", s.packaging], ["Manoperă", s.labour], ["Regie / utilități", s.utilities], ["Pierderi tehnologice", s.techLoss], ["Transport aprovizionare", s.supplyTransport], ["Distribuție", s.logistics]].map(([k, x]) => [k as string, (x as number) / n] as [string, number]).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]) as Array<[string, number]>;
  const gap = cost - target;
  const supplyLine = s.lines.find((x) => x.group === "transport" && x.label === "Transport aprovizionare");
  const supplyNote = supplyLine?.detail.split(" · ")[0]?.replace(/^pe palet: /, "pe palet (bax): ");
  return (
    <div className="grid gap-4 rounded-md border bg-muted/40 p-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Simulare: prețul acceptat de client (lei/buc, cu taxe)</Label>
        <Input className="h-8 w-40" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        {valid && <div className="space-y-1 text-sm">
          <p>Profit la acest preț: <b className={tone(unit)}>{n2(unit)} lei/buc</b> · pe perioadă <b className={tone(unit)}>{n0(unit * l.a.qty)} lei</b></p>
          <p className="text-muted-foreground">Taxe rețea {n2(s.feePct)}% · preț minim {n2(s.minPrice / n)} · propus {n2(s.perPiece.clientPrice)} lei/buc</p>
        </div>}
      </div>
      {valid && <div className="space-y-1 text-sm">
        <p className="font-medium">Ce trebuie să reduc ca să păstrez marja {margin}% + profit {profitPct}%?</p>
        <p>Cost maxim admis (producție + distribuție): <b>{n2(target)} lei/buc</b> · cost actual <b>{n2(cost)}</b></p>
        <p className={gap > 0 ? "font-semibold text-destructive" : "font-semibold text-crm-green"}>{gap > 0 ? `De tăiat: ${n2(gap)} lei/buc (${n2((gap / cost) * 100)}% din cost)` : "Încape în preț fără reduceri."}</p>
        <table className="mt-1 w-full text-xs">
          <tbody>{parts.map(([k, x]) => <tr key={k} className="border-t"><td className="py-0.5">{k}</td><td className="text-right">{n2(x)} lei/buc</td><td className="w-14 text-right text-muted-foreground">{n2((x / cost) * 100)}%</td></tr>)}</tbody>
        </table>
        {supplyNote && <p className="text-xs text-muted-foreground">Transport aprovizionare {supplyNote}. Costurile sunt din luna aleasă la „Costuri din luna”, la fel ca în Calculator de preț pe aceeași lună.</p>}
      </div>}
      <Density l={l} margin={margin} profitPct={profitPct} />
    </div>
  );
}

/** Pallet density / case size what-if: distribution is paid per pallet, more pieces per pallet = cheaper piece. */
function Density({ l, margin, profitPct }: { l: Line; margin: number; profitPct: number }) {
  const s = l.sheet!;
  const n = s.unitsPerCase || 1;
  const ppp = l.ppp ?? 0;
  const dist = s.logistics / n;
  const [perCase, setPerCase] = useState(String(n));
  const [cases, setCases] = useState(ppp ? String(Math.round(ppp / n)) : "");
  if (!(ppp > 0) || !(dist > 0)) return <p className="text-xs text-muted-foreground md:col-span-2">Simulare densitate palet: lipsesc bucăți/palet sau tariful de distribuție pentru acest produs.</p>;
  const pc = Number(perCase.replace(",", ".")), cs = Number(cases.replace(",", "."));
  const newPpp = pc > 0 && cs > 0 ? pc * cs : 0;
  const d = palletDensity(dist, ppp, newPpp, margin, profitPct);
  return (
    <div className="space-y-2 border-t pt-3 md:col-span-2">
      <p className="font-medium text-sm">Densitate palet și baxare: ce câștig dacă încarc mai mult pe palet?</p>
      <p className="text-xs text-muted-foreground">Acum: {n} buc/bax · {n0(ppp / n)} baxuri/palet · {n0(ppp)} buc/palet · distribuție {n2(d.perPallet)} lei/palet = {n2(dist)} lei/buc. Distribuția se plătește pe palet, deci mai multe bucăți pe palet scad costul pe bucată fără să schimbi prețul la raft.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label className="text-xs">Bucăți / bax</Label><Input className="h-8 w-24" inputMode="decimal" value={perCase} onChange={(e) => setPerCase(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Baxuri / palet (straturi × baxuri pe strat)</Label><Input className="h-8 w-24" inputMode="decimal" value={cases} onChange={(e) => setCases(e.target.value)} /></div>
        <p className="text-sm">= <b>{n0(newPpp)} buc/palet</b> ({newPpp ? `${d.saving >= 0 ? "+" : ""}${n2(((newPpp - ppp) / ppp) * 100)}%` : "—"})</p>
      </div>
      {newPpp > 0 && <div className="grid gap-1 text-sm sm:grid-cols-3">
        <p>Distribuție nouă: <b>{n2(d.newDistPerPiece)} lei/buc</b></p>
        <p>Economie: <b className={tone(d.saving)}>{n2(d.saving)} lei/buc</b> · <b className={tone(d.saving)}>{n0(d.saving * l.a.qty)} lei</b> pe perioadă</p>
        <p>Profit în plus (cu marjă {margin}% + profit {profitPct}%): <b className={tone(d.profitGain)}>{n2(d.profitGain)} lei/buc</b></p>
      </div>}
      <p className="text-xs text-muted-foreground">Verifică înainte cu depozitul clientului înălțimea maximă admisă a paletului și rezistența baxului. Costul cutiei pe bax nu este recalculat aici; dacă schimbi baxul, modifică ambalajul în fișa de preț.</p>
    </div>
  );
}

const pkey = (p: Partner) => p.key ?? String(p.id);
const SAVED = "partnerMirror.selected";
const FUTURE = [1, 3, 6, 12];
const gLabel = (g: string | null) => g ?? "Fără subgrupă";
const roDate = (d: Date) => d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
type Proj = ReturnType<typeof projectLine>;

/** Senior-classified partner picker: Subgrupa → subgrupa 2 → partner, with tick boxes at every level. */
function PartnerPicker({ partners, selected, setSelected }: { partners: Partner[]; selected: Set<string>; setSelected: (s: Set<string>) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => (needle ? partners.filter((p) => p.name.toLowerCase().includes(needle)) : partners), [partners, needle]);
  const tree = useMemo(() => groupPartners(shown), [shown]);
  const toggleOpen = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const isOpen = (k: string) => !!needle || open.has(k);
  const state = (ps: Partner[]): boolean | "indeterminate" => { const c = ps.filter((p) => selected.has(pkey(p))).length; return c === 0 ? false : c === ps.length ? true : "indeterminate"; };
  const setMany = (ps: Partner[], on: boolean) => { const n = new Set(selected); for (const p of ps) { if (on) n.add(pkey(p)); else n.delete(pkey(p)); } setSelected(n); };
  const sum = (ps: Partner[]) => ps.reduce((t, p) => t + p.value, 0);
  const head = (k: string, label: string, ps: Partner[], depth: number) => (
    <div className={`flex items-center gap-2 border-t py-1.5 ${depth ? "pl-6" : "bg-muted/40 px-1 font-semibold"}`}>
      <button type="button" onClick={() => toggleOpen(k)} className="text-muted-foreground" aria-label={isOpen(k) ? "Restrânge" : "Deschide"}>{isOpen(k) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
      <Checkbox checked={state(ps)} onCheckedChange={(v) => setMany(ps, v === true)} aria-label={label} />
      <button type="button" onClick={() => toggleOpen(k)} className="flex-1 text-left text-sm">{label} <span className="font-normal text-muted-foreground">· {ps.filter((p) => selected.has(pkey(p))).length}/{ps.length}</span></button>
      <span className="text-xs text-muted-foreground">{n0(sum(ps))} lei</span>
    </div>
  );
  const row = (p: Partner, depth: number) => (
    <label key={pkey(p)} className={`flex cursor-pointer items-center gap-2 py-1 text-sm hover:bg-muted/50 ${depth === 2 ? "pl-16" : "pl-10"}`}>
      <Checkbox checked={selected.has(pkey(p))} onCheckedChange={(v) => setMany([p], v === true)} />
      <span className="flex-1">{p.name}</span>
      <span className="pr-1 text-xs text-muted-foreground">{n0(p.value)} lei</span>
    </label>
  );
  const top = (n: number) => setSelected(new Set([...partners].sort((a, b) => b.value - a.value).slice(0, n).map(pkey)));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" /><Input className="h-8 w-56 pl-7" placeholder="Caută partener" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {[10, 15, 25].map((n) => <Button key={n} size="sm" variant="outline" className="h-8" onClick={() => top(n)}>Primii {n}</Button>)}
        <Button size="sm" variant="outline" className="h-8" onClick={() => setMany(partners, true)}>Toți</Button>
        <Button size="sm" variant="outline" className="h-8" onClick={() => setSelected(new Set())}>Niciunul</Button>
        <span className="text-sm text-muted-foreground"><Users className="mr-1 inline h-4 w-4" />{selected.size} din {partners.length} aleși</span>
      </div>
      <div className="max-h-96 overflow-y-auto rounded-md border">
        {tree.map((g) => {
          const gk = `g:${g.group ?? ""}`;
          const all = g.subgroups.flatMap((s) => s.partners);
          const flat = g.subgroups.length === 1 && !g.subgroups[0].subgroup;
          return <div key={gk}>
            {head(gk, gLabel(g.group), all, 0)}
            {isOpen(gk) && (flat ? all.map((p) => row(p, 1)) : g.subgroups.map((s) => {
              const sk = `${gk}|${s.subgroup ?? ""}`;
              return <div key={sk}>{head(sk, s.subgroup ?? "Fără subgrupă 2", s.partners, 1)}{isOpen(sk) && s.partners.map((p) => row(p, 2))}</div>;
            }))}
          </div>;
        })}
        {!tree.length && <p className="p-3 text-sm text-muted-foreground">Niciun partener găsit.</p>}
      </div>
      <p className="text-xs text-muted-foreground">Grupele vin din clasificările partenerilor din Senior („Subgrupa” și „subgrupa 2”). Alegerea se păstrează pe acest dispozitiv.</p>
    </div>
  );
}

export default function PartnerMirror() {
  const [period, setPeriod] = useState<string>("3");
  const [from, setFrom] = useState(day(new Date(Date.now() - 30 * 86400_000)));
  const [to, setTo] = useState(day(new Date()));
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [loaded, setLoaded] = useState<{ start: string; end: string; lastStart?: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [sim, setSim] = useState<string | null>(null);
  const [future, setFuture] = useState("3");
  const [basis, setBasis] = useState<PriceBasis>("latest");
  const [costMonth, setCostMonth] = useState(defaultCostMonth);
  const thisYear = new Date().getFullYear();

  const range = () => {
    if (period === "custom") return { start: from, end: day(new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400_000)) };
    const end = new Date(); end.setUTCDate(end.getUTCDate() + 1);
    const start = new Date(); start.setUTCMonth(start.getUTCMonth() - Number(period));
    return { start: day(start), end: day(end) };
  };
  const cur = range();
  const stale = !loaded || loaded.start !== cur.start || loaded.end !== cur.end;

  const choose = (s: Set<string>) => { setSelected(s); try { localStorage.setItem(SAVED, JSON.stringify([...s])); } catch { /* storage full or blocked */ } };

  const loadPartners = async () => {
    setError(null); setRows([]); setOpen(new Set());
    try {
      setProgress("Citesc vânzările și partenerii din Senior…");
      const r = range();
      const res = await argusFetch<{ partners: Partner[]; lastStart?: string }>("partner_mirror_sales", {}, r);
      setPartners(res.partners); setLoaded({ ...r, lastStart: res.lastStart });
      let saved: string[] = [];
      try { saved = JSON.parse(localStorage.getItem(SAVED) ?? "[]"); } catch { saved = []; }
      const keys = new Set(res.partners.map(pkey));
      const keep = saved.filter((k) => keys.has(k));
      setSelected(new Set(keep.length ? keep : res.partners.slice(0, 15).map(pkey)));
    } catch (e) { setError((e as Error).message); }
    finally { setProgress(null); }
  };
  useEffect(() => { setRows([]); }, [cur.start, cur.end, costMonth.year, costMonth.month]);

  const run = async () => {
    if (!partners) return;
    setError(null); setRows([]); setOpen(new Set());
    const list = partners.filter((p) => selected.has(pkey(p)));
    const out: Array<Row | undefined> = new Array(list.length);
    let done = 0, next = 0;
    const analyse = async (p: Partner): Promise<Row> => {
      const arts = p.articles.slice(0, 60);
      try {
        const res = await argusFetch<ListResult>("price_list", {}, { articolIds: arts.map((a) => a.id), partnerId: p.id, year: costMonth.year, month: costMonth.month, rawPriceMode: "annual" });
        if (res.rules) setPriceRules(res.rules.rules);
        return summarize(p, arts.map((a): Line => {
          const it = res.items.find((x) => x.product.id === a.id);
          if (!it || !isItem(it)) return { a, sheet: null, m: null, error: it && !isItem(it) ? it.error : "Fără fișă" };
          const sheet = sheetFor(it, res, p.name, costMonth);
          return sheet.complete ? { a, ppp: it.defaults.piecesPerPallet ?? null, sheet, m: mirrorLine(sheet, a.qty, a.value) } : { a, sheet, m: null, error: `Fișă incompletă: ${[...sheet.missingInputs, ...sheet.missingPrices].slice(0, 3).join(", ")}` };
        }));
      } catch (e) { return { ...summarize(p, []), error: (e as Error).message }; }
    };
    try {
      setProgress(`Calculez costurile 0/${list.length}…`);
      const worker = async () => {
        while (next < list.length) {
          const i = next++;
          out[i] = await analyse(list[i]);
          done++;
          setProgress(`Calculez costurile ${done}/${list.length}: ${list[i].name}`);
          setRows(out.filter((x): x is Row => !!x));
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    } catch (e) { setError((e as Error).message); }
    finally { setProgress(null); }
  };

  const pastMonths = loaded ? periodMonths(loaded.start, loaded.end) : 0;
  const futureMonths = Math.max(0, Math.min(36, Number(future.replace(",", ".")) || 0));
  const futureEnd = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + Math.round(futureMonths)); return d; }, [futureMonths]);
  const projOf = (l: Line): Proj | null => (l.m && l.sheet ? projectLine(l.sheet, l.a, pastMonths, futureMonths, basis) : null);
  const proj = new Map(rows.map((r) => {
    const ps = r.lines.map(projOf).filter((x): x is Proj => !!x);
    return [r.p.id, { revenue: ps.reduce((t, x) => t + x.revenue, 0), profit: ps.reduce((t, x) => t + x.profit, 0) }];
  }));

  const total = rows.reduce((t, r) => ({ sales: t.sales + r.sales, actual: t.actual + r.actual, proposed: t.proposed + r.proposed, projRevenue: t.projRevenue + (proj.get(r.p.id)?.revenue ?? 0), projProfit: t.projProfit + (proj.get(r.p.id)?.profit ?? 0) }), { sales: 0, actual: 0, proposed: 0, projRevenue: 0, projProfit: 0 });
  const sorted = useMemo(() => [...rows].sort((a, b) => a.actual - b.actual), [rows]);
  const groups = groupPartners(rows.map((r) => ({ ...r, name: r.p.name, group: r.p.group, subgroup: r.p.subgroup }))).flatMap((g) => g.subgroups.map((s) => {
    const rs = s.partners;
    return { label: `${gLabel(g.group)}${s.subgroup ? ` · ${s.subgroup}` : ""}`, n: rs.length, sales: rs.reduce((t, r) => t + r.sales, 0), actual: rs.reduce((t, r) => t + r.actual, 0), projRevenue: rs.reduce((t, r) => t + (proj.get(r.p.id)?.revenue ?? 0), 0), projProfit: rs.reduce((t, r) => t + (proj.get(r.p.id)?.profit ?? 0), 0) };
  }));
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const fLabel = `${n2(futureMonths).replace(/,00$/, "")} ${futureMonths === 1 ? "lună" : "luni"}`;

  const exportXlsx = () => {
    const a: (string | number | null)[][] = [["Subgrupa", "Subgrupa 2", "Partener", "Vânzări reale (lei)", "Profit real (lei)", "Profit real %", "Încasări la preț propus", "Profit la preț propus", "Bani lăsați pe masă", `Proiecție ${fLabel}: vânzări`, `Proiecție ${fLabel}: profit`, "Produse calculate", "Produse fără fișă"]];
    for (const r of sorted) a.push([r.p.group ?? "", r.p.subgroup ?? "", r.p.name, Math.round(r.sales), Math.round(r.actual), r.sales ? Math.round((r.actual / r.sales) * 1000) / 10 : null, Math.round(r.proposedRevenue), Math.round(r.proposed), Math.round(r.proposed - r.actual), Math.round(proj.get(r.p.id)?.revenue ?? 0), Math.round(proj.get(r.p.id)?.profit ?? 0), r.covered, r.missing]);
    const b: (string | number | null)[][] = [["Partener", "Produs", "Cantitate", "Vânzări", "Preț real/buc", "Preț propus/buc", "Profit real", "Profit la propus", "Diferență", "Cant./lună", "Preț proiecție/buc", "Cant. proiecție", "Profit proiecție", "Observații"]];
    for (const r of sorted) for (const l of r.lines) { const pj = projOf(l); b.push([r.p.name, l.a.name, l.a.qty, Math.round(l.a.value), l.m ? Math.round(l.m.actualPrice * 100) / 100 : null, l.m ? Math.round(l.m.proposedPrice * 100) / 100 : null, l.m ? Math.round(l.m.actualProfit) : null, l.m ? Math.round(l.m.proposedProfit) : null, l.m ? Math.round(l.m.gap) : null, pj ? Math.round(pj.monthlyQty) : null, pj ? Math.round(pj.price * 100) / 100 : null, pj ? Math.round(pj.qty) : null, pj ? Math.round(pj.profit) : null, l.error ?? ""]); }
    const c: (string | number | null)[][] = [["Grupă", "Parteneri", "Vânzări reale", "Profit real", `Proiecție ${fLabel}: vânzări`, `Proiecție ${fLabel}: profit`]];
    for (const g of groups) c.push([g.label, g.n, Math.round(g.sales), Math.round(g.actual), Math.round(g.projRevenue), Math.round(g.projProfit)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), "Parteneri");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(c), "Grupe");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), "Produse");
    XLSX.writeFile(wb, `Oglinda parteneri ${loaded?.start ?? cur.start} - ${loaded?.end ?? cur.end}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Oglindă parteneri: profit real, prețuri propuse și proiecție</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">1. Perioada din trecut</Label>
              <div className="inline-flex rounded-md border bg-muted p-1">
                {PERIODS.map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} className={`rounded px-3 py-1 text-sm ${period === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{l}</button>)}
              </div>
            </div>
            {period === "custom" && <>
              <div className="space-y-1"><Label className="text-xs">De la</Label><Input type="date" className="h-8" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Până la</Label><Input type="date" className="h-8" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>}
            <div className="space-y-1"><Label className="text-xs">Costuri din luna</Label>
              <div className="flex gap-1">
                <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={costMonth.month} onChange={(e) => setCostMonth({ ...costMonth, month: Number(e.target.value) })} aria-label="Luna costurilor">
                  {MONTHS_RO.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={costMonth.year} onChange={(e) => setCostMonth({ ...costMonth, year: Number(e.target.value) })} aria-label="Anul costurilor">
                  {[thisYear - 1, thisYear].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <Button size="sm" variant={stale ? "default" : "outline"} onClick={loadPartners} disabled={!!progress}>{progress && !rows.length && stale ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Users className="mr-1 h-4 w-4" />}{partners && !stale ? "Reîncarcă partenerii" : "Încarcă partenerii"}</Button>
          </div>
          {partners && !stale && <>
            <Label className="text-xs">2. Alege partenerii</Label>
            <PartnerPicker partners={partners} selected={selected} setSelected={choose} />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={run} disabled={!!progress || !selected.size}>{progress ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}Analizează {selected.size} {selected.size === 1 ? "partener" : "parteneri"}</Button>
              {rows.length > 0 && <Button size="sm" variant="outline" onClick={exportXlsx}><Download className="mr-1 h-4 w-4" />Excel</Button>}
              {selected.size > 40 && <span className="text-xs text-muted-foreground">Mulți parteneri: poate dura câteva minute.</span>}
            </div>
          </>}
          {partners && stale && <p className="text-xs text-muted-foreground">Ai schimbat perioada: apasă „Încarcă partenerii” ca să iau vânzările din noua perioadă.</p>}
          <p className="text-xs text-muted-foreground">Vânzările și prețurile reale vin din facturile Senior din perioadă. Costurile (rețete, NIR, transport, taxe rețea din Reguli de calcul) sunt din luna aleasă la „Costuri din luna” — implicit ultima lună încheiată, ca în Calculator de preț. Profit = preț − taxe rețea − preț minim (cost + marjă brută). Durează câteva secunde pe partener.</p>
          {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && <Card><CardContent className="space-y-2 pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label className="text-xs">3. Proiecție în viitor</Label>
            <div className="flex items-center gap-1">
              <div className="inline-flex rounded-md border bg-muted p-1">
                {FUTURE.map((m) => <button key={m} onClick={() => setFuture(String(m))} className={`rounded px-3 py-1 text-sm ${Number(future) === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{m === 1 ? "1 lună" : m === 12 ? "1 an" : `${m} luni`}</button>)}
              </div>
              <Input className="h-8 w-20" inputMode="decimal" value={future} onChange={(e) => setFuture(e.target.value)} aria-label="Luni în viitor" /><span className="text-sm text-muted-foreground">luni</span>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Preț de vânzare în proiecție</Label>
            <div className="inline-flex rounded-md border bg-muted p-1">
              {([["latest", "Ultimul preț facturat"], ["last", "Media ultimei luni"], ["period", "Media perioadei"]] as const).map(([k, l]) => <button key={k} onClick={() => setBasis(k)} className={`rounded px-3 py-1 text-sm ${basis === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{l}</button>)}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Proiecția presupune că fiecare partener cumpără în continuare, din fiecare produs, aceeași cantitate medie pe lună ca în perioada aleasă ({n2(pastMonths)} luni), la prețul de vânzare de acum ({basis === "latest" ? "prețul de pe ultima factură a partenerului ales la acel produs, din Senior, până azi — chiar dacă factura e după perioada aleasă" : basis === "last" ? `media facturilor de la ${loaded?.lastStart ? roDate(new Date(`${loaded.lastStart}T00:00:00Z`)) : "ultima lună"}; produsele fără vânzări în ultima lună folosesc media perioadei` : "media facturilor din toată perioada"}) și cu costurile din {MONTHS_RO[costMonth.month - 1].toLowerCase()} {costMonth.year}. Perioada: azi – {roDate(futureEnd)}. Este o estimare, nu o comandă confirmată.</p>
      </CardContent></Card>}

      {rows.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Vânzări analizate</p><p className="text-xl font-semibold">{n0(total.sales)} lei</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Profit real (după marjă)</p><p className={`text-xl font-semibold ${tone(total.actual)}`}>{n0(total.actual)} lei</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Dacă aveam prețurile propuse</p><p className={`text-xl font-semibold ${tone(total.proposed)}`}>{n0(total.proposed)} lei</p><p className="text-xs text-muted-foreground">diferență {n0(total.proposed - total.actual)} lei</p></CardContent></Card>
        <Card className="border-primary/40"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Proiecție {fLabel} la prețul actual</p><p className={`text-xl font-semibold ${tone(total.projProfit)}`}>{total.projProfit >= 0 ? "Câștig" : "Pierdere"} {n0(Math.abs(total.projProfit))} lei</p><p className="text-xs text-muted-foreground">din vânzări estimate de {n0(total.projRevenue)} lei</p></CardContent></Card>
      </div>}

      {groups.length > 1 && <Card><CardContent className="overflow-x-auto pt-4">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Grupă</th><th className="text-right">Parteneri</th><th className="text-right">Vânzări</th><th className="text-right">Profit real</th><th className="text-right">Proiecție vânzări</th><th className="text-right">Proiecție profit</th></tr></thead>
          <tbody>{groups.map((g) => <tr key={g.label} className="border-t"><td className="py-1.5 font-medium">{g.label}</td><td className="text-right">{g.n}</td><td className="text-right">{n0(g.sales)}</td><td className={`text-right ${tone(g.actual)}`}>{n0(g.actual)}</td><td className="text-right">{n0(g.projRevenue)}</td><td className={`text-right font-semibold ${tone(g.projProfit)}`}>{n0(g.projProfit)}</td></tr>)}</tbody>
        </table>
      </CardContent></Card>}

      {rows.length > 0 && <Card><CardContent className="overflow-x-auto pt-4">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground">
            <th className="py-1"></th><th>Partener</th><th className="text-right">Vânzări</th><th className="text-right">Profit real</th><th className="text-right">%</th><th className="text-right">Profit la propus</th><th className="text-right">Bani lăsați pe masă</th><th className="text-right">Proiecție vânzări</th><th className="text-right">Proiecție profit</th><th className="text-right">Fără fișă</th>
          </tr></thead>
          <tbody>{sorted.map((r) => { const pr = proj.get(r.p.id); return <Fragment key={r.p.id}>
            <tr className="cursor-pointer border-t hover:bg-muted/50" onClick={() => toggle(r.p.id)}>
              <td className="py-1.5">{open.has(r.p.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
              <td className="font-medium">{r.p.name}<span className="block text-xs font-normal text-muted-foreground">{gLabel(r.p.group ?? null)}{r.p.subgroup ? ` · ${r.p.subgroup}` : ""}</span>{r.error && <span className="ml-2 text-xs text-destructive">{r.error}</span>}</td>
              <td className="text-right">{n0(r.sales)}</td>
              <td className={`text-right font-semibold ${tone(r.actual)}`}>{n0(r.actual)}</td>
              <td className={`text-right ${tone(r.actual)}`}>{r.sales ? n2((r.actual / r.sales) * 100) : "—"}</td>
              <td className={`text-right ${tone(r.proposed)}`}>{n0(r.proposed)}</td>
              <td className="text-right">{n0(r.proposed - r.actual)}</td>
              <td className="text-right">{n0(pr?.revenue)}</td>
              <td className={`text-right font-semibold ${tone(pr?.profit ?? 0)}`}>{n0(pr?.profit)}</td>
              <td className="text-right text-muted-foreground">{r.missing || ""}</td>
            </tr>
            {open.has(r.p.id) && <tr><td></td><td colSpan={9} className="pb-3">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th>Produs</th><th className="text-right">Cant.</th><th className="text-right">Preț real</th><th className="text-right">Preț propus</th><th className="text-right">Profit real</th><th className="text-right">Profit la propus</th><th className="text-right">Cant./lună</th><th className="text-right">Preț proiecție</th><th className="text-right">Profit proiecție</th><th></th></tr></thead>
                <tbody>{[...r.lines].sort((a, b) => (a.m?.actualProfit ?? 0) - (b.m?.actualProfit ?? 0)).map((l) => {
                  const k = `${r.p.id}:${l.a.id}`;
                  const pj = projOf(l);
                  return <Fragment key={k}>
                    <tr className="border-t">
                      <td className="py-1">{l.a.name}{l.error && <span className="block text-muted-foreground">{l.error}</span>}</td>
                      <td className="text-right">{n0(l.a.qty)}</td>
                      <td className="text-right">{l.m ? n2(l.m.actualPrice) : n2(l.a.value / l.a.qty)}</td>
                      <td className="text-right">{l.m ? n2(l.m.proposedPrice) : "—"}</td>
                      <td className={`text-right font-medium ${l.m ? tone(l.m.actualProfit) : ""}`}>{l.m ? n0(l.m.actualProfit) : "—"}</td>
                      <td className="text-right">{l.m ? n0(l.m.proposedProfit) : "—"}</td>
                      <td className="text-right">{pj ? n0(pj.monthlyQty) : "—"}</td>
                      <td className="text-right" title={pj ? (pj.priceFrom !== basis ? "Fără preț pe această bază: " + (pj.priceFrom === "last" ? "media ultimei luni" : "media perioadei") : pj.priceFrom === "latest" && l.a.latestDate ? `Ultima factură: ${roDate(new Date(`${l.a.latestDate}T00:00:00Z`))}` : undefined) : undefined}>{pj ? `${n2(pj.price)}${pj.priceFrom !== basis ? "*" : ""}` : "—"}{pj?.priceFrom === "latest" && l.a.latestDate && <span className="block text-[10px] text-muted-foreground">{roDate(new Date(`${l.a.latestDate}T00:00:00Z`))}</span>}</td>
                      <td className={`text-right font-medium ${pj ? tone(pj.profit) : ""}`}>{pj ? n0(pj.profit) : "—"}</td>
                      <td className="text-right">{l.m && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSim(sim === k ? null : k)}>Simulează</Button>}</td>
                    </tr>
                    {sim === k && l.m && <tr><td colSpan={10} className="py-2"><Simulator l={l} /></td></tr>}
                  </Fragment>;
                })}</tbody>
              </table>
              <p className="mt-1 text-xs text-muted-foreground">„Preț real” = media facturilor din perioada aleasă. „Preț proiecție” = prețul ales sus (implicit ultima factură, cu data ei). * nu există preț pe baza aleasă: s-a folosit media ultimei luni sau a perioadei.</p>
            </td></tr>}
          </Fragment>; })}</tbody>
        </table>
      </CardContent></Card>}
    </div>
  );
}
