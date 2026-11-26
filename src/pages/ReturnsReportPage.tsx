import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, ComposedChart, Line, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, RotateCcw, X } from 'lucide-react';
import BackToHubButton from '@/components/BackToHubButton';
import { argusFetch } from '@/lib/argusApi';
import { enrich, groupBy, shippedBy, returnRateBreakdown, REASON_CATEGORIES, type EnrichedReturn, type Group, type ReturnLine, type ShippedRow, type ShippedDay } from '@/lib/returns/returnsReport';

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const lei = (v: number) => v.toLocaleString('ro-RO', { maximumFractionDigits: 0 }) + ' lei';
const num = (v: number) => v.toLocaleString('ro-RO', { maximumFractionDigits: 1 });
const pct = (v: number | null) => v == null ? '—' : (v * 100).toLocaleString('ro-RO', { maximumFractionDigits: 2 }) + '%';
const fmtDay = (d: string) => d.slice(8, 10) + '.' + d.slice(5, 7);
const COLORS = ['hsl(var(--destructive))', 'hsl(var(--primary))', 'hsl(var(--chart-3, 38 92% 50%))', 'hsl(var(--chart-4, 199 89% 48%))', 'hsl(var(--chart-5, 280 65% 60%))', 'hsl(var(--muted-foreground))', 'hsl(var(--accent-foreground))'];

function presets() {
  const t = new Date(); const y = t.getFullYear(), m = t.getMonth();
  return [
    { label: 'Luna trecută', s: iso(new Date(y, m - 1, 1)), e: iso(new Date(y, m, 0)) },
    { label: 'Luna aceasta', s: iso(new Date(y, m, 1)), e: iso(new Date(t.getTime() - 86400000)) },
    { label: 'Ultimele 7 zile', s: iso(new Date(t.getTime() - 7 * 86400000)), e: iso(new Date(t.getTime() - 86400000)) },
    { label: 'Ultimele 30 zile', s: iso(new Date(t.getTime() - 30 * 86400000)), e: iso(new Date(t.getTime() - 86400000)) },
    { label: 'Ultimele 3 luni', s: iso(new Date(y, m - 3, 1)), e: iso(new Date(y, m, 0)) },
  ];
}

interface Data { start: string; end: string; lag: number; returnStart: string; returnEnd: string; returns: ReturnLine[]; shipped: ShippedRow[]; shippedDays: ShippedDay[]; productionWarning?: string | null }
type Filter = { client?: string; store?: string; art?: string; category?: string };

const ReturnsReportPage: React.FC = () => {
  const p0 = presets()[0];
  const [start, setStart] = useState(p0.s); const [end, setEnd] = useState(p0.e);
  const [data, setData] = useState<Data | null>(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState('');
  const [f, setF] = useState<Filter>({}); const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr('');
    try { setData(await argusFetch<Data>('returns_report', {}, { start, end })); setF({}); }
    catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  };

  const all = useMemo(() => data ? enrich(data.returns, data.lag) : [], [data]);
  const lines = useMemo(() => all.filter((l) => (!f.client || l.client === f.client) && (!f.store || l.partner === f.store) && (!f.art || l.art === f.art) && (!f.category || l.category === f.category)), [all, f]);
  const ship = useMemo(() => (data?.shipped ?? []).filter((r) => {
    const c = r.partner.split(/\s*-\s+|\s+-\s*/)[0].trim();
    return (!f.client || c === f.client) && (!f.store || r.partner === f.store) && (!f.art || r.art === f.art);
  }), [data, f]);

  const totV = lines.reduce((a, l) => a + l.v, 0), totQ = lines.reduce((a, l) => a + l.q, 0);
  const shipV = ship.reduce((a, r) => a + (Number(r.v) || 0), 0);
  const rate = shipV > 0 && !f.category ? totV / shipV : shipV > 0 ? totV / shipV : null;

  const byClient = useMemo(() => groupBy(lines, (l) => l.client, shippedBy(ship, (r) => r.client)), [lines, ship]);
  const byStore = useMemo(() => groupBy(lines, (l) => l.partner, shippedBy(ship, (r) => r.partner)), [lines, ship]);
  const byArt = useMemo(() => groupBy(lines, (l) => l.art, shippedBy(ship, (r) => r.art)), [lines, ship]);
  const byCat = useMemo(() => groupBy(lines, (l) => l.category), [lines]);
  const rateByCategory = useMemo(() => returnRateBreakdown(lines, shipV), [lines, shipV]);
  const rateByReason = useMemo(() => returnRateBreakdown(lines, shipV, (l) => l.reasonText), [lines, shipV]);
  const byDay = useMemo(() => {
    const m = new Map<string, { day: string; v: number; shipV: number }>();
    for (const d of data?.shippedDays ?? []) m.set(d.day, { day: d.day, v: 0, shipV: Number(d.v) || 0 });
    for (const l of lines) { const x = m.get(l.delivered) ?? { day: l.delivered, v: 0, shipV: 0 }; x.v += l.v; m.set(l.delivered, x); }
    const filtered = !!(f.client || f.store || f.art);
    return [...m.values()].sort((a, b) => a.day.localeCompare(b.day)).map((x) => ({ ...x, label: fmtDay(x.day), rate: !filtered && x.shipV > 0 ? +(x.v / x.shipV * 100).toFixed(2) : null }));
  }, [lines, data, f]);
  const byWeekday = useMemo(() => {
    const names = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
    const m = names.map((n) => ({ n, v: 0 }));
    for (const l of lines) m[new Date(l.delivered + 'T00:00:00Z').getUTCDay()].v += l.v;
    return [...m.slice(1), m[0]];
  }, [lines]);

  const insights = useMemo(() => {
    if (!lines.length) return [];
    const out: string[] = [];
    const c = byCat[0]; out.push(`Principala cauză: „${c.key}" — ${lei(c.v)} (${pct(c.v / totV)} din valoarea returnată).`);
    const cl = byClient[0]; if (cl) out.push(`Clientul cu cele mai mari retururi: ${cl.key} — ${lei(cl.v)}${cl.rateV != null ? `, adică ${pct(cl.rateV)} din cât i s-a livrat` : ''}.`);
    const worstRate = byClient.filter((g) => g.shippedV > 2000 && g.rateV != null).sort((a, b) => (b.rateV ?? 0) - (a.rateV ?? 0))[0];
    if (worstRate && worstRate.key !== cl?.key) out.push(`Cea mai mare rată de retur (clienți cu livrări peste 2.000 lei): ${worstRate.key} — ${pct(worstRate.rateV)}.`);
    const a = byArt[0]; if (a) out.push(`Produsul cel mai returnat: ${a.key} — ${num(a.q)} buc, ${lei(a.v)}.`);
    const top3 = byArt.slice(0, 5).reduce((s, g) => s + g.v, 0); if (byArt.length > 5) out.push(`Primele 5 produse fac ${pct(top3 / totV)} din toate retururile — acolo se câștigă cel mai repede.`);
    const wd = [...byWeekday].sort((x, y) => y.v - x.v)[0]; if (wd.v > 0) out.push(`Marfa produsă / expediată ${wd.n.toLowerCase()} se întoarce cel mai mult (${lei(wd.v)}).`);
    const peak = [...byDay].sort((x, y) => y.v - x.v)[0]; if (peak?.v) out.push(`Cea mai proastă zi: marfa din ${fmtDay(peak.day)} — ${lei(peak.v)} returnată.`);
    const none = byCat.find((g) => g.key === 'Fără motiv scris'); if (none) out.push(`${none.n} rânduri (${lei(none.v)}) nu au motiv scris în Senior — cere colegilor să completeze descrierea.`);
    return out;
  }, [lines, byCat, byClient, byArt, byWeekday, byDay, totV]);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const g = (rows: Group[], name: string) => rows.map((r) => ({ [name]: r.key, 'Rânduri': r.n, 'Cantitate returnată': +r.q.toFixed(2), 'Valoare returnată (lei)': +r.v.toFixed(2), 'Valoare livrată (lei)': +r.shippedV.toFixed(2), 'Rată retur %': r.rateV == null ? null : +(r.rateV * 100).toFixed(2) }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(g(byClient, 'Client')), 'Clienți');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(g(byStore, 'Magazin')), 'Magazine');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(g(byArt, 'Produs')), 'Produse');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(g(rateByReason, 'Motiv')), 'Motive');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rateByCategory.map((r) => ({ Categorie: r.key, 'Valoare returnată (lei)': +r.v.toFixed(2), 'Contribuție la rata de retur %': r.rateV == null ? null : +(r.rateV * 100).toFixed(2), 'Pondere din retururi %': r.shareV == null ? null : +(r.shareV * 100).toFixed(2) }))), 'Rată pe motive');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lines.map((l) => ({ 'Zi producție / expediție': l.delivered, 'Zi livrare / refuz': l.day, Aviz: l.doc, Client: l.client, Magazin: l.partner, Produs: l.art, 'Operator principal': [...new Set((l.production ?? []).map((w) => w.operator))].join(', ') || 'Neidentificat', Linie: [...new Set((l.production ?? []).map((w) => w.line))].join(', ') || 'Neidentificată', Cantitate: l.q, 'Valoare (lei)': +l.v.toFixed(2), Motiv: l.reasonText, Categorie: l.category }))), 'Linii');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lines.flatMap((l) => (l.production ?? []).map((w) => ({ 'Aviz refuz': l.doc, Magazin: l.partner, Produs: l.art, 'Zi producție': w.day, 'Comandă producție': w.order, 'Operator principal': w.operator, Linie: w.line, 'Persoane în echipă': w.employees, 'Cantitate produsă în sesiune': w.quantity, Start: w.start, Stop: w.end, 'Asociere': 'Produs + magazin + zi; nu lot confirmat' })))), 'Producție');
    XLSX.writeFile(wb, `Retururi_${data?.start}_${data?.end}.xlsx`);
  };

  const chips = Object.entries(f).filter(([, v]) => v) as [keyof Filter, string][];
  const chipLabel: Record<keyof Filter, string> = { client: 'Client', store: 'Magazin', art: 'Produs', category: 'Cauză' };

  const GroupTable = ({ rows, label, onPick, rateCol = true, contribution = false }: { rows: Group[]; label: string; onPick?: (k: string) => void; rateCol?: boolean; contribution?: boolean }) => (
    <div className="max-h-[520px] overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted z-10"><tr className="text-left">
          <th className="p-2">{label}</th><th className="p-2 text-right">Rânduri</th><th className="p-2 text-right">Cant. returnată</th><th className="p-2 text-right">Valoare returnată</th><th className="p-2 text-right">% din retururi</th>
          {rateCol && <><th className="p-2 text-right">Livrat (lei)</th><th className="p-2 text-right">{contribution ? 'Contribuție la rata de retur' : 'Rată retur'}</th></>}
        </tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.key} className={`border-t ${onPick ? 'cursor-pointer hover:bg-muted/50' : ''}`} onClick={() => onPick?.(r.key)}>
            <td className="p-2 font-medium">{r.key}</td><td className="p-2 text-right">{r.n}</td><td className="p-2 text-right">{num(r.q)}</td>
            <td className="p-2 text-right">{lei(r.v)}</td><td className="p-2 text-right">{pct(totV ? r.v / totV : null)}</td>
            {rateCol && <><td className="p-2 text-right text-muted-foreground">{r.shippedV ? lei(r.shippedV) : '—'}</td>
              <td className="p-2 text-right">{r.rateV == null ? '—' : <Badge variant={r.rateV > 0.05 ? 'destructive' : 'secondary'}>{pct(r.rateV)}</Badge>}</td></>}
          </tr>))}</tbody>
      </table>
    </div>
  );

  const q = search.trim().toLowerCase();
  const shownLines = q ? lines.filter((l) => `${l.partner} ${l.art} ${l.reasonText} ${l.doc} ${(l.production ?? []).map((w) => `${w.operator} ${w.line} ${w.order}`).join(" ")}`.toLowerCase().includes(q)) : lines;

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><RotateCcw className="h-6 w-6 text-primary" /> Retururi clienți</h1>
          <p className="text-muted-foreground text-sm">Din Senior: rândurile cu minus de pe avizele de expediție, cu motivul scris în descriere.</p>
        </div>
        <BackToHubButton />
      </div>

      <Card><CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap gap-2">{presets().map((p) => <Button key={p.label} size="sm" variant={start === p.s && end === p.e ? 'default' : 'outline'} onClick={() => { setStart(p.s); setEnd(p.e); }}>{p.label}</Button>)}</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Produs / expediat de la<Input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className="w-40" /></label>
          <label className="text-sm">până la<Input type="date" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} className="w-40" /></label>
          <Button onClick={load} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Analizează retururile</Button>
          {data && <Button variant="outline" onClick={exportXlsx}><Download className="h-4 w-4 mr-1" />Excel</Button>}
        </div>
        {data && <p className="text-xs text-muted-foreground">Marfa produsă / expediată {fmtDay(data.start)}–{fmtDay(data.end)} ajunge la client {fmtDay(data.returnStart)}–{fmtDay(data.returnEnd)}. Clientul decide la livrare ce acceptă și ce refuză. Refuzul din prima zi a lunii următoare se atribuie producției din ultima zi a lunii selectate.</p>}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </CardContent></Card>

      {data && <>
        {data.productionWarning && <p role="alert" className="text-sm text-destructive">{data.productionWarning}</p>}
        {chips.length > 0 && <div className="flex flex-wrap gap-2 items-center"><span className="text-sm text-muted-foreground">Filtre:</span>
          {chips.map(([k, v]) => <Badge key={k} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setF({ ...f, [k]: undefined })}>{chipLabel[k]}: {v}<X className="h-3 w-3" /></Badge>)}
          <Button size="sm" variant="ghost" onClick={() => setF({})}>Șterge filtrele</Button></div>}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ['Valoare returnată', lei(totV)],
            ['Rată de retur', f.category ? pct(rate) + ' (doar cauza aleasă)' : pct(rate)],
            ['Bucăți returnate', num(totQ)],
            ['Valoare livrată', lei(shipV)],
            ['Rânduri retur / avize', `${lines.length} / ${new Set(lines.map((l) => l.doc)).size}`],
          ].map(([t, v]) => <Card key={t}><CardHeader className="p-3 pb-1"><CardDescription>{t}</CardDescription><CardTitle className="text-xl">{v}</CardTitle></CardHeader></Card>)}
        </div>

        <section aria-label="Descompunerea ratei de retur" className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Din ce se compune rata de retur</h2>
            <span className="text-sm font-semibold">{f.category ? 'Cauza aleasă' : 'Total'}: {pct(rate)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Fiecare procent = valoarea returnată pentru acel motiv ÷ aceeași valoare livrată. Procentele se adună la rata de retur de mai sus; „% din retururi” arată ponderea motivului în retururi, nu în livrări. Pot apărea diferențe de 0,01 din rotunjire.</p>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr className="text-left"><th className="p-2">Motiv</th><th className="p-2 text-right">Valoare returnată</th><th className="p-2 text-right">Contribuție la rata de retur</th><th className="p-2 text-right">% din retururi</th></tr></thead>
              <tbody>{rateByCategory.map((r) => <tr key={r.key} className="border-t">
                <td className="p-2"><Button variant="link" className="h-auto p-0 text-left whitespace-normal" onClick={() => setF({ ...f, category: f.category === r.key ? undefined : r.key })}>{r.key}</Button></td>
                <td className="p-2 text-right whitespace-nowrap">{lei(r.v)}</td><td className="p-2 text-right font-semibold whitespace-nowrap">{pct(r.rateV)}</td><td className="p-2 text-right text-muted-foreground whitespace-nowrap">{pct(r.shareV)}</td>
              </tr>)}</tbody>
              <tfoot className="border-t bg-muted font-semibold"><tr><td className="p-2">{f.category ? 'Total — cauza aleasă' : 'Total'}</td><td className="p-2 text-right whitespace-nowrap">{lei(totV)}</td><td className="p-2 text-right whitespace-nowrap">{pct(rate)}</td><td className="p-2 text-right">{pct(totV > 0 ? 1 : null)}</td></tr></tfoot>
            </table>
          </div>
        </section>

        {insights.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Concluzii</CardTitle></CardHeader>
          <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{insights.map((s) => <li key={s}>{s}</li>)}</ul></CardContent></Card>}

        <div className="grid lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-base">Refuzuri pe ziua producției / expediției</CardTitle><CardDescription>Bare = lei returnați, linie = rată retur %</CardDescription></CardHeader>
            <CardContent className="h-72"><ResponsiveContainer><ComposedChart data={byDay}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" fontSize={11} /><YAxis yAxisId="l" fontSize={11} /><YAxis yAxisId="r" orientation="right" fontSize={11} unit="%" />
              <Tooltip formatter={(v: any, n: any) => n === 'Rată %' ? v + '%' : lei(+v)} /><Legend />
              <Bar yAxisId="l" dataKey="v" name="Returnat (lei)" fill="hsl(var(--destructive))" /><Line yAxisId="r" dataKey="rate" name="Rată %" stroke="hsl(var(--primary))" dot={false} />
            </ComposedChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">De ce se întoarce marfa</CardTitle><CardDescription>Clic pe o felie = filtru</CardDescription></CardHeader>
            <CardContent className="h-72"><ResponsiveContainer><PieChart><Pie data={byCat} dataKey="v" nameKey="key" outerRadius={90} onClick={(d: any) => setF({ ...f, category: d.key })}>
              {byCat.map((c) => <Cell key={c.key} fill={COLORS[REASON_CATEGORIES.indexOf(c.key as any) % COLORS.length]} className="cursor-pointer" />)}</Pie>
              <Tooltip formatter={(v: any) => lei(+v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></CardContent></Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-3">
          {([['Top clienți', byClient, 'client'], ['Top produse', byArt, 'art']] as const).map(([t, rows, k]) => (
            <Card key={t}><CardHeader className="pb-2"><CardTitle className="text-base">{t}</CardTitle><CardDescription>Clic pe bară = filtru</CardDescription></CardHeader>
              <CardContent className="h-80"><ResponsiveContainer><BarChart data={rows.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" fontSize={10} /><YAxis type="category" dataKey="key" width={130} fontSize={10} tickFormatter={(s: string) => s.length > 22 ? s.slice(0, 21) + '…' : s} />
                <Tooltip formatter={(v: any) => lei(+v)} /><Bar dataKey="v" name="Returnat" fill="hsl(var(--primary))" className="cursor-pointer" onClick={(d: any) => setF({ ...f, [k]: d.key })} />
              </BarChart></ResponsiveContainer></CardContent></Card>))}
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Pe ziua săptămânii (producție)</CardTitle></CardHeader>
            <CardContent className="h-80"><ResponsiveContainer><BarChart data={byWeekday}><XAxis dataKey="n" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: any) => lei(+v)} /><Bar dataKey="v" name="Returnat" fill="hsl(var(--destructive))" /></BarChart></ResponsiveContainer></CardContent></Card>
        </div>

        <Tabs defaultValue="clienti">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="clienti">Clienți</TabsTrigger><TabsTrigger value="magazine">Magazine</TabsTrigger><TabsTrigger value="produse">Produse</TabsTrigger>
            <TabsTrigger value="motive">Motive scrise</TabsTrigger><TabsTrigger value="linii">Detaliu și operatori</TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground my-2">Clic pe un rând ca să vezi doar acel client / magazin / produs în tot raportul. Rata de retur = lei returnați ÷ lei livrați aceluiași client/magazin/produs în perioadă.</p>
          <TabsContent value="clienti"><GroupTable rows={byClient} label="Client" onPick={(k) => setF({ ...f, client: k })} /></TabsContent>
          <TabsContent value="magazine"><GroupTable rows={byStore} label="Magazin" onPick={(k) => setF({ ...f, store: k })} /></TabsContent>
          <TabsContent value="produse"><GroupTable rows={byArt} label="Produs" onPick={(k) => setF({ ...f, art: k })} /></TabsContent>
          <TabsContent value="motive"><GroupTable rows={rateByReason} label="Motiv (cum e scris în Senior)" contribution /></TabsContent>
          <TabsContent value="linii" className="space-y-2">
            <Input placeholder="Caută magazin, produs, operator, linie, aviz…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            <p className="text-xs text-muted-foreground">Operatorul principal și linia provin din sesiunile cu producție înregistrată pentru același produs, magazin și zi. Asocierea nu confirmă lotul refuzat și nu dovedește vina operatorului. Cantitățile sesiunilor nu reprezintă cantități refuzate.</p>
            <div className="max-h-[560px] overflow-auto rounded-md border"><table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted z-10"><tr className="text-left"><th className="p-2">Zi producție</th><th className="p-2">Livrare / refuz</th><th className="p-2">Aviz</th><th className="p-2">Magazin</th><th className="p-2">Produs</th><th className="p-2">Operator principal / linie</th><th className="p-2 text-right">Cant.</th><th className="p-2 text-right">Valoare</th><th className="p-2">Motiv</th></tr></thead>
              <tbody>{shownLines.map((l: EnrichedReturn) => <React.Fragment key={l.id}><tr className="border-t">
                <td className="p-2">{fmtDay(l.delivered)}</td><td className="p-2 text-muted-foreground">{fmtDay(l.day)}</td><td className="p-2">{l.doc}</td><td className="p-2">{l.partner}</td><td className="p-2">{l.art}</td>
                <td className="p-2 min-w-48">{l.production?.length ? <><div className="space-y-1">{[...new Set(l.production.map((w) => `${w.operator} — ${w.line}`))].map((name) => <div key={name}>{name}</div>)}</div><Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === String(l.id) ? null : String(l.id))}>{expanded === String(l.id) ? 'Închide sesiuni' : 'Vezi sesiuni'}</Button></> : <span className="text-muted-foreground">{data.productionWarning ? 'Date indisponibile' : 'Fără sesiune asociată'}</span>}</td>
                <td className="p-2 text-right">{num(l.q)}</td><td className="p-2 text-right">{lei(l.v)}</td><td className="p-2"><Badge variant="outline">{l.reasonText}</Badge></td></tr>
                {expanded === String(l.id) && <tr className="bg-muted/30"><td colSpan={9} className="p-3"><table className="w-full text-xs"><thead><tr className="text-left"><th className="p-2">Comandă</th><th className="p-2">Operator principal</th><th className="p-2">Linie</th><th className="p-2">Echipă (persoane)</th><th className="p-2">Start</th><th className="p-2">Stop</th><th className="p-2 text-right">Produs în sesiune</th></tr></thead><tbody>{(l.production ?? []).map((w) => <tr key={w.sessionId} className="border-t"><td className="p-2">{w.order}</td><td className="p-2">{w.operator}</td><td className="p-2">{w.line}</td><td className="p-2">{w.employees || '—'}</td><td className="p-2">{new Date(w.start).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}</td><td className="p-2">{w.end ? new Date(w.end).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' }) : 'În lucru'}</td><td className="p-2 text-right">{num(w.quantity)}</td></tr>)}</tbody></table></td></tr>}
              </React.Fragment>)}</tbody>
            </table></div>
          </TabsContent>
        </Tabs>
      </>}
    </div>
  );
};

export default ReturnsReportPage;
