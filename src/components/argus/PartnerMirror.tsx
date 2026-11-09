import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Loader2, Play } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { argusFetch } from "@/lib/argusApi";
import { type SheetComponent } from "../../../supabase/functions/_shared/priceSheet";
import { configuredSheet, type PriceConfig } from "../../../supabase/functions/_shared/priceConfig";
import { prefilledConfig } from "../../../supabase/functions/_shared/priceDefaults";
import { priceRules, profitFor, setPriceRules } from "../../../supabase/functions/_shared/priceRules";
import { mirrorLine, palletDensity, profitPerPiece, targetCost } from "../../../supabase/functions/_shared/partnerMirrorMath";

type Article = { id: number; name: string; qty: number; value: number };
type Partner = { id: number; name: string; qty: number; value: number; articles: Article[] };
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

function sheetFor(it: Item, res: ListResult, partner: string): Sheet {
  const now = new Date();
  const cfg: PriceConfig = { year: now.getFullYear(), month: now.getMonth() + 1, rawPriceMode: "annual", route: it.defaults.route, supplyBasis: "pallet", ...(it.defaults.labourLine ? { labourLine: it.defaults.labourLine } : {}), rates: { profitPct: profitFor(it.product.name, null, partner).pct }, components: {} };
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
  const [price, setPrice] = useState(n2(l.m!.actualPrice).replace(/\./g, ""));
  const v = Number(price.replace(",", "."));
  const valid = Number.isFinite(v) && v > 0;
  const margin = priceRules().marginPct;
  const profitPct = s.profitPct ?? priceRules().profitPct;
  const unit = valid ? profitPerPiece(s, v) : 0;
  const target = valid ? targetCost(v, s.feePct, margin, profitPct) : 0;
  const cost = s.perPiece.factoryGate;
  const parts: Array<[string, number]> = [["Materie primă", s.rawMaterial], ["Ambalaje", s.packaging], ["Manoperă", s.labour], ["Regie / utilități", s.utilities], ["Pierderi tehnologice", s.techLoss], ["Transport aprovizionare", s.supplyTransport], ["Distribuție", s.logistics]].map(([k, x]) => [k as string, (x as number) / n] as [string, number]).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]) as Array<[string, number]>;
  const gap = cost - target;
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

export default function PartnerMirror() {
  const [period, setPeriod] = useState<string>("3");
  const [from, setFrom] = useState(day(new Date(Date.now() - 30 * 86400_000)));
  const [to, setTo] = useState(day(new Date()));
  const [limit, setLimit] = useState(15);
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [sim, setSim] = useState<string | null>(null);

  const range = () => {
    if (period === "custom") return { start: from, end: day(new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400_000)) };
    const end = new Date(); end.setUTCDate(end.getUTCDate() + 1);
    const start = new Date(); start.setUTCMonth(start.getUTCMonth() - Number(period));
    return { start: day(start), end: day(end) };
  };

  const run = async () => {
    setError(null); setRows([]); setOpen(new Set());
    try {
      setProgress("Citesc vânzările din Senior…");
      const { partners } = await argusFetch<{ partners: Partner[] }>("partner_mirror_sales", {}, range());
      const list = partners.slice(0, limit);
      const out: Row[] = [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        setProgress(`Calculez costurile ${i + 1}/${list.length}: ${p.name}`);
        const arts = p.articles.slice(0, 60);
        try {
          const now = new Date();
          const res = await argusFetch<ListResult>("price_list", {}, { articolIds: arts.map((a) => a.id), partnerId: p.id, year: now.getFullYear(), month: now.getMonth() + 1, rawPriceMode: "annual" });
          if (res.rules) setPriceRules(res.rules.rules);
          const lines = arts.map((a): Line => {
            const it = res.items.find((x) => x.product.id === a.id);
            if (!it || !isItem(it)) return { a, sheet: null, m: null, error: it && !isItem(it) ? it.error : "Fără fișă" };
            const sheet = sheetFor(it, res, p.name);
            return sheet.complete ? { a, ppp: it.defaults.piecesPerPallet ?? null, sheet, m: mirrorLine(sheet, a.qty, a.value) } : { a, sheet, m: null, error: `Fișă incompletă: ${[...sheet.missingInputs, ...sheet.missingPrices].slice(0, 3).join(", ")}` };
          });
          out.push(summarize(p, lines));
        } catch (e) {
          out.push({ ...summarize(p, []), error: (e as Error).message });
        }
        setRows([...out]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setProgress(null); }
  };

  const total = useMemo(() => rows.reduce((t, r) => ({ sales: t.sales + r.sales, actual: t.actual + r.actual, proposed: t.proposed + r.proposed }), { sales: 0, actual: 0, proposed: 0 }), [rows]);
  const sorted = useMemo(() => [...rows].sort((a, b) => a.actual - b.actual), [rows]);
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const exportXlsx = () => {
    const a: (string | number | null)[][] = [["Partener", "Vânzări reale (lei)", "Profit real (lei)", "Profit real %", "Încasări la preț propus", "Profit la preț propus", "Bani lăsați pe masă", "Produse calculate", "Produse fără fișă"]];
    for (const r of sorted) a.push([r.p.name, Math.round(r.sales), Math.round(r.actual), r.sales ? Math.round((r.actual / r.sales) * 1000) / 10 : null, Math.round(r.proposedRevenue), Math.round(r.proposed), Math.round(r.proposed - r.actual), r.covered, r.missing]);
    const b: (string | number | null)[][] = [["Partener", "Produs", "Cantitate", "Vânzări", "Preț real/buc", "Preț propus/buc", "Profit real", "Profit la propus", "Diferență", "Observații"]];
    for (const r of sorted) for (const l of r.lines) b.push([r.p.name, l.a.name, l.a.qty, Math.round(l.a.value), l.m ? Math.round(l.m.actualPrice * 100) / 100 : null, l.m ? Math.round(l.m.proposedPrice * 100) / 100 : null, l.m ? Math.round(l.m.actualProfit) : null, l.m ? Math.round(l.m.proposedProfit) : null, l.m ? Math.round(l.m.gap) : null, l.error ?? ""]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), "Parteneri");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), "Produse");
    const { start, end } = range();
    XLSX.writeFile(wb, `Oglinda parteneri ${start} - ${end}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Oglindă parteneri: profit real vs. prețuri propuse</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="inline-flex rounded-md border bg-muted p-1">
              {PERIODS.map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} className={`rounded px-3 py-1 text-sm ${period === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{l}</button>)}
            </div>
            {period === "custom" && <>
              <div className="space-y-1"><Label className="text-xs">De la</Label><Input type="date" className="h-8" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Până la</Label><Input type="date" className="h-8" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>}
            <div className="space-y-1"><Label className="text-xs">Parteneri (după vânzări)</Label>
              <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                {[5, 10, 15, 25, 40].map((x) => <option key={x} value={x}>Primii {x}</option>)}
              </select>
            </div>
            <Button size="sm" onClick={run} disabled={!!progress}>{progress ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}Analizează</Button>
            {rows.length > 0 && <Button size="sm" variant="outline" onClick={exportXlsx}><Download className="mr-1 h-4 w-4" />Excel</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Vânzările și prețurile reale vin din facturile Senior din perioadă. Costurile sunt cele de acum (rețete, NIR, transport, taxe rețea din Reguli de calcul), deci oglinda arată ce ar fi ieșit cu prețurile propuse azi. Profit = preț − taxe rețea − preț minim (cost + marjă brută). Durează câteva secunde pe partener.</p>
          {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Vânzări analizate</p><p className="text-xl font-semibold">{n0(total.sales)} lei</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Profit real (după marjă)</p><p className={`text-xl font-semibold ${tone(total.actual)}`}>{n0(total.actual)} lei</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Dacă aveam prețurile propuse</p><p className={`text-xl font-semibold ${tone(total.proposed)}`}>{n0(total.proposed)} lei</p><p className="text-xs text-muted-foreground">diferență {n0(total.proposed - total.actual)} lei</p></CardContent></Card>
      </div>}

      {rows.length > 0 && <Card><CardContent className="overflow-x-auto pt-4">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground">
            <th className="py-1"></th><th>Partener</th><th className="text-right">Vânzări</th><th className="text-right">Profit real</th><th className="text-right">%</th><th className="text-right">Profit la propus</th><th className="text-right">Bani lăsați pe masă</th><th className="text-right">Fără fișă</th>
          </tr></thead>
          <tbody>{sorted.map((r) => <Fragment key={r.p.id}>
            <tr className="cursor-pointer border-t hover:bg-muted/50" onClick={() => toggle(r.p.id)}>
              <td className="py-1.5">{open.has(r.p.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
              <td className="font-medium">{r.p.name}{r.error && <span className="ml-2 text-xs text-destructive">{r.error}</span>}</td>
              <td className="text-right">{n0(r.sales)}</td>
              <td className={`text-right font-semibold ${tone(r.actual)}`}>{n0(r.actual)}</td>
              <td className={`text-right ${tone(r.actual)}`}>{r.sales ? n2((r.actual / r.sales) * 100) : "—"}</td>
              <td className={`text-right ${tone(r.proposed)}`}>{n0(r.proposed)}</td>
              <td className="text-right">{n0(r.proposed - r.actual)}</td>
              <td className="text-right text-muted-foreground">{r.missing || ""}</td>
            </tr>
            {open.has(r.p.id) && <tr><td></td><td colSpan={7} className="pb-3">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th>Produs</th><th className="text-right">Cant.</th><th className="text-right">Preț real</th><th className="text-right">Preț propus</th><th className="text-right">Profit real</th><th className="text-right">Profit la propus</th><th></th></tr></thead>
                <tbody>{[...r.lines].sort((a, b) => (a.m?.actualProfit ?? 0) - (b.m?.actualProfit ?? 0)).map((l) => {
                  const k = `${r.p.id}:${l.a.id}`;
                  return <Fragment key={k}>
                    <tr className="border-t">
                      <td className="py-1">{l.a.name}{l.error && <span className="block text-muted-foreground">{l.error}</span>}</td>
                      <td className="text-right">{n0(l.a.qty)}</td>
                      <td className="text-right">{l.m ? n2(l.m.actualPrice) : n2(l.a.value / l.a.qty)}</td>
                      <td className="text-right">{l.m ? n2(l.m.proposedPrice) : "—"}</td>
                      <td className={`text-right font-medium ${l.m ? tone(l.m.actualProfit) : ""}`}>{l.m ? n0(l.m.actualProfit) : "—"}</td>
                      <td className="text-right">{l.m ? n0(l.m.proposedProfit) : "—"}</td>
                      <td className="text-right">{l.m && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSim(sim === k ? null : k)}>Simulează</Button>}</td>
                    </tr>
                    {sim === k && l.m && <tr><td colSpan={7} className="py-2"><Simulator l={l} /></td></tr>}
                  </Fragment>;
                })}</tbody>
              </table>
            </td></tr>}
          </Fragment>)}</tbody>
        </table>
      </CardContent></Card>}
    </div>
  );
}
