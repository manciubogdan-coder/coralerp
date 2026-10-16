import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Bot, Loader2, Save, Trash2, X, TrendingUp, TrendingDown, Wallet, Play } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import BackToHubButton from '@/components/BackToHubButton';
import { supabase } from '@/integrations/supabase/client';
import { edgeFetchJson } from '@/lib/edgeFetch';

const CLOUD_URL = 'https://yeniohmlmxhjzywqlidx.supabase.co';
const CLOUD_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbmlvaG1sbXhoanp5d3FsaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjM0ODgsImV4cCI6MjA5MzEzOTQ4OH0.8rNaYX5D5hk22o_bUqERO9ChJfQdJYkaKiD9UsRi1mE';

async function callFn(payload: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  return edgeFetchJson(`${CLOUD_URL}/functions/v1/erp-mirror`, {
    method: 'POST',
    headers: { apikey: CLOUD_ANON, Authorization: `Bearer ${CLOUD_ANON}`, 'x-app-token': data.session?.access_token ?? '' },
    body: payload,
  });
}

type Fn = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';
type Chart = 'table' | 'bar' | 'line' | 'pie';
interface Config {
  table: string;
  groups: { col: string; bucket?: 'month' | 'year' | 'day' | null }[];
  measures: { col: string | null; fn: Fn }[];
  filters: { col: string; op: string; value: string }[];
  chart: Chart;
  limit?: number;
  order?: 'value' | 'group';
}
interface CatTable { table: string; source: string; rows: number; columns: { name: string; type: string }[] }
interface SavedReport { id: string; title: string; config: Config; created_by?: string }

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142 60% 40%)', 'hsl(38 90% 50%)', 'hsl(200 70% 45%)', 'hsl(280 50% 55%)', 'hsl(0 0% 55%)'];
const FN_LABEL: Record<Fn, string> = { sum: 'Sumă', count: 'Număr', avg: 'Medie', min: 'Minim', max: 'Maxim', count_distinct: 'Distincte' };
const lei = (n: number) => (n ?? 0).toLocaleString('ro-RO', { maximumFractionDigits: 0 }) + ' lei';
const num = (n: unknown) => (typeof n === 'number' ? n.toLocaleString('ro-RO', { maximumFractionDigits: 2 }) : String(n ?? '—'));
const isDate = (t: string) => t.startsWith('timestamp') || t === 'date';
const isNum = (t: string) => ['numeric', 'bigint', 'integer'].includes(t);

/* ---------------- Rezultat raport (tabel / grafic) ---------------- */
const ReportView: React.FC<{ config: Config; rows: any[] }> = ({ config, rows }) => {
  const gLabels = config.groups.map((g) => g.col + (g.bucket ? ` (${g.bucket === 'month' ? 'lună' : g.bucket === 'year' ? 'an' : 'zi'})` : ''));
  const mLabels = (config.measures.length ? config.measures : [{ col: null, fn: 'count' as Fn }]).map(
    (m) => `${FN_LABEL[m.fn]} ${m.col ?? 'rânduri'}`,
  );
  const data = rows.map((r) => {
    const o: any = { name: config.groups.map((_, i) => r[`g${i + 1}`] ?? '—').join(' / ') || 'Total' };
    mLabels.forEach((l, i) => (o[l] = Number(r[`m${i + 1}`]) || 0));
    return o;
  });
  if (!rows.length) return <p className="text-sm text-muted-foreground py-6 text-center">Niciun rezultat.</p>;
  if (config.chart === 'bar' || config.chart === 'line') {
    const C = config.chart === 'bar' ? BarChart : LineChart;
    return (
      <ResponsiveContainer width="100%" height={320}>
        <C data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString('ro-RO', { notation: 'compact' })} />
          <Tooltip formatter={(v: number) => num(v)} />
          <Legend />
          {mLabels.map((l, i) =>
            config.chart === 'bar' ? <Bar key={l} dataKey={l} fill={COLORS[i % COLORS.length]} /> : <Line key={l} dataKey={l} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />,
          )}
        </C>
      </ResponsiveContainer>
    );
  }
  if (config.chart === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={data.slice(0, 12)} dataKey={mLabels[0]} nameKey="name" outerRadius={120} label={(e) => e.name}>
            {data.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => num(v)} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  return (
    <div className="max-h-[50vh] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            {gLabels.map((l) => <TableHead key={l}>{l}</TableHead>)}
            {mLabels.map((l) => <TableHead key={l} className="text-right">{l}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {config.groups.map((_, j) => <TableCell key={j}>{r[`g${j + 1}`] ?? '—'}</TableCell>)}
              {mLabels.map((_, j) => <TableCell key={j} className="text-right">{num(r[`m${j + 1}`])}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

/* ---------------- Card raport salvat ---------------- */
const SavedCard: React.FC<{ report: SavedReport; onDelete: () => void }> = ({ report, onDelete }) => {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    callFn({ action: 'aggregate', config: report.config }).then((r) => setRows(r.rows ?? [])).catch((e) => setErr(e.message));
  }, [report]);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{report.title}</CardTitle>
          <CardDescription className="font-mono text-xs">{report.config.table}</CardDescription>
        </div>
        <Button size="icon" variant="ghost" onClick={onDelete} title="Șterge raportul"><Trash2 className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent>
        {err ? <p className="text-sm text-destructive">{err}</p> : rows ? <ReportView config={report.config} rows={rows} /> : <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
      </CardContent>
    </Card>
  );
};

/* ---------------- Constructor drag & drop ---------------- */
const DropZone: React.FC<{ label: string; hint: string; onDrop: (col: string) => void; children: React.ReactNode }> = ({ label, hint, onDrop, children }) => {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const c = e.dataTransfer.getData('text/plain'); if (c) onDrop(c); }}
      className={`rounded-md border-2 border-dashed p-3 min-h-[84px] transition-colors ${over ? 'border-primary bg-primary/5' : 'border-border'}`}
    >
      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
      {React.Children.count(children) === 0 && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

const Builder: React.FC<{ catalog: CatTable[]; initial: Config | null; onSaved: () => void }> = ({ catalog, initial, onSaved }) => {
  const empty: Config = { table: '', groups: [], measures: [], filters: [], chart: 'table', order: 'value', limit: 200 };
  const [cfg, setCfg] = useState<Config>(initial ?? empty);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const [running, setRunning] = useState(false);
  const [title, setTitle] = useState('');
  useEffect(() => { if (initial) { setCfg(initial); setRows(null); } }, [initial]);

  const tbl = catalog.find((t) => t.table === cfg.table);
  const colType = (c: string) => tbl?.columns.find((x) => x.name === c)?.type ?? 'text';
  const tables = useMemo(
    () => catalog.filter((t) => t.source.toLowerCase().includes(search.toLowerCase())).slice(0, 300),
    [catalog, search],
  );

  const run = async () => {
    setRunning(true);
    try { setRows((await callFn({ action: 'aggregate', config: cfg })).rows ?? []); }
    catch (e) { toast.error((e as Error).message); }
    finally { setRunning(false); }
  };
  const save = async () => {
    if (!title.trim()) return toast.error('Dă un nume raportului.');
    try { await callFn({ action: 'reports_save', title, config: cfg }); toast.success('Raport salvat pe panou.'); setTitle(''); onSaved(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const chip = (text: string, onRemove: () => void, extra?: React.ReactNode) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs">
      <span className="font-mono">{text}</span>{extra}
      <button onClick={onRemove} aria-label="Elimină"><X className="h-3 w-3" /></button>
    </span>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1. Alege tabelul</CardTitle>
          <Input placeholder="Caută tabel…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full border rounded-md bg-background p-2 text-sm"
            size={8}
            value={cfg.table}
            onChange={(e) => { setCfg({ ...empty, table: e.target.value, chart: cfg.chart }); setRows(null); }}
          >
            {tables.map((t) => <option key={t.table} value={t.table}>{t.source} ({t.rows.toLocaleString('ro-RO')})</option>)}
          </select>
          {tbl && (
            <>
              <p className="text-xs font-semibold text-muted-foreground">2. Trage coloanele în dreapta</p>
              <div className="max-h-[40vh] overflow-y-auto space-y-1">
                {tbl.columns.map((c) => (
                  <div key={c.name} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', c.name)}
                    className="cursor-grab rounded border px-2 py-1 text-xs font-mono flex justify-between hover:border-primary">
                    <span>{c.name}</span><span className="text-muted-foreground">{isNum(c.type) ? '123' : isDate(c.type) ? 'dată' : 'abc'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DropZone label="Rânduri (grupare)" hint="Trage aici: client, produs, dată…" onDrop={(c) => setCfg({ ...cfg, groups: [...cfg.groups, { col: c, bucket: isDate(colType(c)) ? 'month' : null }] })}>
            {cfg.groups.map((g, i) => chip(g.col, () => setCfg({ ...cfg, groups: cfg.groups.filter((_, j) => j !== i) }),
              isDate(colType(g.col)) && (
                <select className="bg-transparent text-xs" value={g.bucket ?? ''} onChange={(e) => setCfg({ ...cfg, groups: cfg.groups.map((x, j) => j === i ? { ...x, bucket: (e.target.value || null) as any } : x) })}>
                  <option value="day">zi</option><option value="month">lună</option><option value="year">an</option><option value="">exact</option>
                </select>
              )))}
          </DropZone>
          <DropZone label="Valori" hint="Trage aici: cantitate, valoare…" onDrop={(c) => setCfg({ ...cfg, measures: [...cfg.measures, { col: c, fn: isNum(colType(c)) ? 'sum' : 'count' }] })}>
            {cfg.measures.map((m, i) => chip(m.col ?? '*', () => setCfg({ ...cfg, measures: cfg.measures.filter((_, j) => j !== i) }),
              <select className="bg-transparent text-xs" value={m.fn} onChange={(e) => setCfg({ ...cfg, measures: cfg.measures.map((x, j) => j === i ? { ...x, fn: e.target.value as Fn } : x) })}>
                {(Object.keys(FN_LABEL) as Fn[]).map((f) => <option key={f} value={f}>{FN_LABEL[f]}</option>)}
              </select>))}
          </DropZone>
          <DropZone label="Filtre" hint="Trage aici coloana după care filtrezi" onDrop={(c) => setCfg({ ...cfg, filters: [...cfg.filters, { col: c, op: isDate(colType(c)) || isNum(colType(c)) ? 'gte' : 'contains', value: '' }] })}>
            {cfg.filters.map((f, i) => chip(f.col, () => setCfg({ ...cfg, filters: cfg.filters.filter((_, j) => j !== i) }),
              <>
                <select className="bg-transparent text-xs" value={f.op} onChange={(e) => setCfg({ ...cfg, filters: cfg.filters.map((x, j) => j === i ? { ...x, op: e.target.value } : x) })}>
                  <option value="eq">=</option><option value="neq">≠</option><option value="contains">conține</option><option value="starts">începe cu</option><option value="gte">≥</option><option value="lte">≤</option><option value="notnull">completat</option>
                </select>
                {f.op !== 'notnull' && <input className="w-24 bg-background border rounded px-1 text-xs" value={f.value} onChange={(e) => setCfg({ ...cfg, filters: cfg.filters.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} />}
              </>))}
          </DropZone>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['table', 'bar', 'line', 'pie'] as Chart[]).map((c) => (
            <Button key={c} size="sm" variant={cfg.chart === c ? 'default' : 'outline'} onClick={() => setCfg({ ...cfg, chart: c })}>
              {{ table: 'Tabel', bar: 'Bare', line: 'Linie', pie: 'Plăcintă' }[c]}
            </Button>
          ))}
          <select className="border rounded-md bg-background p-1.5 text-sm" value={cfg.order ?? 'value'} onChange={(e) => setCfg({ ...cfg, order: e.target.value as any })}>
            <option value="value">Ordonează după valoare</option><option value="group">Ordonează după rânduri</option>
          </select>
          <Button size="sm" onClick={run} disabled={!cfg.table || running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Rulează
          </Button>
        </div>
        {rows && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <ReportView config={cfg} rows={rows} />
              <div className="flex gap-2">
                <Input placeholder="Nume raport (ex: Vânzări pe clienți)" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Button onClick={save}><Save className="h-4 w-4 mr-1" /> Salvează pe panou</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

/* ---------------- Pagina ---------------- */
const CeoDashboardPage: React.FC = () => {
  const year = new Date().getFullYear();
  const [pnl, setPnl] = useState<any>(null);
  const [pnlErr, setPnlErr] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatTable[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [tab, setTab] = useState('panou');
  const [builderCfg, setBuilderCfg] = useState<Config | null>(null);
  const [prompt, setPrompt] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ title?: string; explanation?: string; config?: Config | null; error?: string } | null>(null);
  const [answerRows, setAnswerRows] = useState<any[] | null>(null);

  const loadReports = useCallback(() => callFn({ action: 'reports_list' }).then((r) => setReports(r.reports ?? [])).catch(() => {}), []);
  useEffect(() => {
    callFn({ action: 'pnl', year }).then(setPnl).catch((e) => setPnlErr(e.message));
    callFn({ action: 'catalog' }).then((r) => setCatalog(r.tables ?? [])).catch(() => {});
    loadReports();
  }, [year, loadReports]);

  const months: any[] = pnl?.months ?? [];
  const cur = months.filter((m) => m.y === year);
  const prev = months.filter((m) => m.y === year - 1);
  const lastMonth = cur.filter((m) => m.revenue || m.expenses).slice(-1)[0];
  const sameMonthPrev = lastMonth && prev.find((m) => m.period.slice(4) === lastMonth.period.slice(4));
  const ytd = (arr: any[], upTo?: string) => arr.filter((m) => !upTo || m.period.slice(4) <= upTo).reduce((a, m) => ({ r: a.r + +m.revenue, e: a.e + +m.expenses }), { r: 0, e: 0 });
  const ytdCur = ytd(cur);
  const ytdPrev = ytd(prev, lastMonth?.period.slice(4));
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const c = cur.find((m) => m.period.slice(4) === mm);
    const p = prev.find((m) => m.period.slice(4) === mm);
    return { name: mm, Venituri: c ? +c.revenue : null, Cheltuieli: c ? +c.expenses : null, Profit: c ? +c.revenue - +c.expenses : null, [`Profit ${year - 1}`]: p ? +p.revenue - +p.expenses : null };
  });
  const delta = (a: number, b: number) => (b ? Math.round(((a - b) / Math.abs(b)) * 100) : null);

  const Kpi: React.FC<{ label: string; value: number; prevValue: number; icon: React.ReactNode; good?: 'up' | 'down' }> = ({ label, value, prevValue, icon, good = 'up' }) => {
    const d = delta(value, prevValue);
    const positive = d != null && (good === 'up' ? d >= 0 : d <= 0);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">{icon}{label}</CardDescription>
          <CardTitle className="text-2xl">{lei(value)}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {d != null ? <span className={positive ? 'text-primary font-medium' : 'text-destructive font-medium'}>{d > 0 ? '+' : ''}{d}%</span> : '—'}
          <span className="text-muted-foreground"> față de {lei(prevValue)} anul trecut</span>
        </CardContent>
      </Card>
    );
  };

  const ask = async () => {
    if (!prompt.trim()) return;
    setAsking(true); setAnswer(null); setAnswerRows(null);
    try {
      const a = await callFn({ action: 'assist', prompt });
      setAnswer(a);
      if (a.config) setAnswerRows((await callFn({ action: 'aggregate', config: a.config })).rows ?? []);
    } catch (e) { setAnswer({ error: (e as Error).message }); }
    finally { setAsking(false); }
  };
  const saveAnswer = async () => {
    if (!answer?.config) return;
    try { await callFn({ action: 'reports_save', title: answer.title || prompt.slice(0, 80), config: answer.config }); toast.success('Raport salvat pe panou.'); loadReports(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const del = async (id: string) => {
    try { await callFn({ action: 'reports_delete', id }); loadReports(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Panou CEO</h1>
          <p className="text-muted-foreground">Afacerea dintr-o privire, din datele copiate din Senior ERP.</p>
        </div>
        <BackToHubButton />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="panou">Panou</TabsTrigger>
          <TabsTrigger value="constructor">Constructor rapoarte</TabsTrigger>
          <TabsTrigger value="asistent">Asistent</TabsTrigger>
        </TabsList>

        <TabsContent value="panou" className="space-y-4">
          {pnlErr && <Card className="border-destructive"><CardContent className="py-4 text-destructive">{pnlErr}</CardContent></Card>}
          {!pnl && !pnlErr && <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" />}
          {pnl && (
            <>
              <p className="text-sm rounded-md bg-muted p-3">
                Date contabile până în luna {pnl.last_period ? `${pnl.last_period.slice(4)}/${pnl.last_period.slice(0, 4)}` : '—'} (după cât e închisă contabilitatea în Senior).
                Oglindirea încă rulează, așa că unele cifre pot fi parțiale.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Kpi label={`Venituri ${year} (de la 1 ian.)`} value={ytdCur.r} prevValue={ytdPrev.r} icon={<TrendingUp className="h-4 w-4" />} />
                <Kpi label={`Cheltuieli ${year} (de la 1 ian.)`} value={ytdCur.e} prevValue={ytdPrev.e} icon={<TrendingDown className="h-4 w-4" />} good="down" />
                <Kpi label={`Profit ${year} (de la 1 ian.)`} value={ytdCur.r - ytdCur.e} prevValue={ytdPrev.r - ytdPrev.e} icon={<Wallet className="h-4 w-4" />} />
              </div>
              {lastMonth && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Kpi label={`Venituri luna ${lastMonth.period.slice(4)}`} value={+lastMonth.revenue} prevValue={+(sameMonthPrev?.revenue ?? 0)} icon={<TrendingUp className="h-4 w-4" />} />
                  <Kpi label={`Cheltuieli luna ${lastMonth.period.slice(4)}`} value={+lastMonth.expenses} prevValue={+(sameMonthPrev?.expenses ?? 0)} icon={<TrendingDown className="h-4 w-4" />} good="down" />
                  <Kpi label={`Profit luna ${lastMonth.period.slice(4)}`} value={+lastMonth.revenue - +lastMonth.expenses} prevValue={+(sameMonthPrev?.revenue ?? 0) - +(sameMonthPrev?.expenses ?? 0)} icon={<Wallet className="h-4 w-4" />} />
                </div>
              )}
              <Card>
                <CardHeader><CardTitle className="text-base">Venituri, cheltuieli și profit pe luni — {year}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => Number(v).toLocaleString('ro-RO', { notation: 'compact' })} />
                      <Tooltip formatter={(v: number) => lei(v)} />
                      <Legend />
                      <Bar dataKey="Venituri" fill={COLORS[0]} />
                      <Bar dataKey="Cheltuieli" fill={COLORS[1]} />
                      <Bar dataKey="Profit" fill={COLORS[2]} />
                      <Bar dataKey={`Profit ${year - 1}`} fill={COLORS[6]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[['Top 10 surse de venit', pnl.top_revenue], ['Top 10 cheltuieli', pnl.top_expenses]].map(([t, list]: any) => (
                  <Card key={t}>
                    <CardHeader><CardTitle className="text-base">{t} — {year}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {(list ?? []).map((x: any) => {
                        const max = Math.max(...list.map((y: any) => +y.value), 1);
                        return (
                          <div key={x.cont} className="text-sm">
                            <div className="flex justify-between gap-2"><span className="truncate">{x.cont} · {x.name}</span><span className="font-medium whitespace-nowrap">{lei(+x.value)}</span></div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.max(0, (+x.value / max) * 100)}%` }} /></div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
          {reports.length > 0 && (
            <>
              <h2 className="text-lg font-semibold pt-2">Rapoartele mele</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {reports.map((r) => <SavedCard key={r.id} report={r} onDelete={() => del(r.id)} />)}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="constructor">
          <Builder catalog={catalog} initial={builderCfg} onSaved={() => { loadReports(); setTab('panou'); }} />
        </TabsContent>

        <TabsContent value="asistent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bot className="h-5 w-5" /> Spune ce raport vrei</CardTitle>
              <CardDescription>Ex: „cheltuielile pe conturi în 2026, pe luni” sau „top 20 conturi după rulaj debitor anul acesta”.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(); }} />
              <Button onClick={ask} disabled={asking || !prompt.trim()}>
                {asking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bot className="h-4 w-4 mr-1" />} Construiește raportul
              </Button>
            </CardContent>
          </Card>
          {answer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{answer.title ?? 'Rezultat'}</CardTitle>
                {(answer.explanation || answer.error) && <CardDescription className={answer.error ? 'text-destructive' : ''}>{answer.error ?? answer.explanation}</CardDescription>}
              </CardHeader>
              {answer.config && (
                <CardContent className="space-y-3">
                  {answerRows ? <ReportView config={answer.config} rows={answerRows} /> : <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={saveAnswer}><Save className="h-4 w-4 mr-1" /> Salvează pe panou</Button>
                    <Button variant="outline" onClick={() => { setBuilderCfg({ ...answer.config!, groups: answer.config!.groups ?? [], measures: answer.config!.measures ?? [], filters: answer.config!.filters ?? [] }); setTab('constructor'); }}>
                      Modifică în constructor
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CeoDashboardPage;
