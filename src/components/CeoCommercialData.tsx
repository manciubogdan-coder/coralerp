import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShoppingCart, Truck, Receipt, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

type Kind = 'sales_orders' | 'purchase_orders' | 'sales_invoices' | 'purchase_invoices';
interface Metric { documents: number; value: number | null; valued_documents: number; partners: number; unidentified_partners: number; first_date: string; last_date: string }
interface Summary {
  available: boolean; reason?: string; partial: boolean;
  metrics: Partial<Record<Kind, Metric>>;
  monthly: { month: string; kind: Kind; documents: number; value: number | null }[];
  rankings: { kind: Kind; partner_id: number; name: string; documents: number; value: number | null }[];
  sources: { table: string; synced_at: string | null; error: string | null; complete: boolean }[];
}
const definitions: { kind: Kind; title: string; codes: string; icon: typeof ShoppingCart }[] = [
  { kind: 'sales_orders', title: 'Comenzi de vânzare', codes: 'CC · Comandă client', icon: ShoppingCart },
  { kind: 'purchase_orders', title: 'Comenzi de achiziție', codes: 'CF · Comandă furnizor', icon: Truck },
  { kind: 'sales_invoices', title: 'Facturare către clienți', codes: 'FC · Factură client', icon: Receipt },
  { kind: 'purchase_invoices', title: 'Facturi de achiziție', codes: 'FF + FFI · Factură furnizor + import', icon: Receipt },
];
const amount = (value: number | null | undefined) => value == null ? '—' : `${Number(value).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} lei`;
const count = (value: number) => Number(value).toLocaleString('ro-RO');
const date = (value: string) => new Date(value).toLocaleDateString('ro-RO');
const sourceNames: Record<string, string> = { c_h_note_contabile: 'Documente Senior', c_tipuri_document: 'Tipuri de documente', c_h_note_contabile_parteneri: 'Partenerii documentelor' };

function normalizeSummary(result: unknown): Summary {
  if (!result || typeof result !== 'object' || !('available' in result) || typeof result.available !== 'boolean') {
    throw new Error('Răspunsul cu indicatorii comerciali este incomplet. Reîncearcă încărcarea.');
  }
  const data = result as Partial<Summary>;
  const completeShape = data.metrics && typeof data.metrics === 'object' && !Array.isArray(data.metrics)
    && Array.isArray(data.monthly) && Array.isArray(data.rankings) && Array.isArray(data.sources);
  return {
    available: result.available,
    reason: typeof data.reason === 'string' ? data.reason : 'Datele comerciale nu sunt disponibile momentan.',
    partial: data.partial !== false || !completeShape,
    metrics: data.metrics && typeof data.metrics === 'object' && !Array.isArray(data.metrics) ? data.metrics : {},
    monthly: Array.isArray(data.monthly) ? data.monthly.filter(p => p && typeof p.month === 'string' && /^\d{4}-\d{2}$/.test(p.month) && definitions.some(d => d.kind === p.kind)) : [],
    rankings: Array.isArray(data.rankings) ? data.rankings.filter(r => r && definitions.some(d => d.kind === r.kind) && r.partner_id != null) : [],
    sources: Array.isArray(data.sources) ? data.sources.filter(s => s && typeof s.table === 'string') : [],
  };
}

export default function CeoCommercialData({ start, end, refresh, call }: { start: string; end: string; refresh: number; call: (payload: Record<string, unknown>) => Promise<any> }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [measure, setMeasure] = useState<'value' | 'documents'>('value');
  useEffect(() => {
    let active = true;
    setSummary(null); setError('');
    call({ action: 'commercial_summary', start, end }).then(result => { if (active) setSummary(normalizeSummary(result)); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Indicatorii comerciali nu au putut fi încărcați.'); });
    return () => { active = false; };
  }, [start, end, refresh, attempt, call]);
  if (error) return <div role="alert" className="space-y-3 py-4"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => setAttempt(v => v + 1)}><RefreshCw className="h-4 w-4 mr-2" />Reîncearcă</Button></div>;
  if (!summary) return <div role="status" className="flex justify-center items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Se încarcă indicatorii comerciali…</div>;
  if (!summary.available) return <p role="status" className="py-6 text-muted-foreground">{summary.reason}</p>;
  const chart = new Map<string, Record<string, string | number | null>>();
  for (const point of summary.monthly) {
    const row = chart.get(point.month) ?? { month: `${point.month.slice(5)}/${point.month.slice(0, 4)}` };
    row[point.kind] = point[measure]; chart.set(point.month, row);
  }
  const partial = summary.partial;
  const partnerCards = [
    { kind: 'sales_invoices' as Kind, title: 'Clienți facturați', detail: 'Parteneri distincți identificați pe facturile FC din perioada aleasă.' },
    { kind: 'purchase_invoices' as Kind, title: 'Furnizori cu facturi', detail: 'Parteneri distincți identificați pe facturile FF și FFI din perioada aleasă.' },
  ];
  return <section className="space-y-6">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">Activitate comercială</h2><p className="text-sm text-muted-foreground">{date(start)} – {date(end)}</p></div>
    {partial && <div role="status" className="flex items-start gap-2 border-l-2 border-destructive bg-muted p-3 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-destructive" /><p><strong>Copie incompletă — cifre parțiale.</strong> Totalurile reflectă numai documentele prezente în copie, nu întreaga activitate a firmei.</p></div>}
    <p className="text-xs text-muted-foreground">Valorile de mai jos sunt sumele din antetul documentelor Senior (valoare_rol), nu venituri contabile și nu totaluri fără TVA confirmate. Comenzile și facturile sunt etape diferite; nu se adună între ele. Documentele anulate sunt excluse.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {definitions.map(({ kind, title, codes, icon: Icon }) => {
        const m = summary.metrics[kind];
        return <Card key={kind} className="min-w-0"><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0" />{title}</CardDescription><CardTitle className="text-2xl break-words">{amount(m?.value)}</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
          <p>{m ? `${count(m.documents)} documente` : 'Niciun document în copie pentru interval'}</p>
          <p className="text-xs text-muted-foreground">{partial ? 'Total parțial' : 'Din copia Senior'} · {codes}</p>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setOpen(open === kind ? null : kind)}>{open === kind ? 'Ascunde' : 'Din ce se compune'}</Button>
          {open === kind && <div className="border-t pt-2 text-xs space-y-2"><p>Suma valoare_rol din C_H_Note_Contabile, o singură dată per document; tipul este verificat în C_Tipuri_Document. Filtrare pe Data documentului, inclusiv ultima zi; Anulat = false. Retururile și alte tipuri de documente nu sunt incluse.</p>{m && <><p>{count(m.valued_documents)} din {count(m.documents)} documente au valoarea completată.</p><p>Date prezente: {date(m.first_date)} – {date(m.last_date)}.</p></>}</div>}
        </CardContent></Card>;
      })}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {partnerCards.map(({ kind, title, detail }) => {
        const m = summary.metrics[kind];
        return <Card key={kind}><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" />{title}</CardDescription><CardTitle className="text-2xl">{m ? count(m.partners) : '—'}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground space-y-2"><p>{detail} {partial && 'Număr parțial.'}</p><p>Sursa: C_H_Note_Contabile_Parteneri, după Partener_Id; nu reprezintă întregul nomenclator.</p>{m && m.unidentified_partners > 0 && <p className="text-destructive">{count(m.unidentified_partners)} documente fără un partener unic identificat; nu sunt incluse în număr sau top.</p>}</CardContent></Card>;
      })}
    </div>
    <div className="space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Evoluție lunară{partial ? ' · parțială' : ''}</h3><div className="flex gap-1" role="group" aria-label="Măsura graficului"><Button size="sm" variant={measure === 'value' ? 'default' : 'outline'} onClick={() => setMeasure('value')}>Valori</Button><Button size="sm" variant={measure === 'documents' ? 'default' : 'outline'} onClick={() => setMeasure('documents')}>Documente</Button></div></div>
      {chart.size ? <ResponsiveContainer width="100%" height={320}><BarChart data={[...chart.values()]}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tickFormatter={v => Number(v).toLocaleString('ro-RO', { notation: 'compact' })} /><Tooltip formatter={(v: number) => measure === 'value' ? amount(v) : count(v)} /><Legend />{definitions.map((d, i) => <Bar key={d.kind} dataKey={d.kind} name={d.title} fill={['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--foreground))', 'hsl(var(--muted-foreground))'][i]} />)}</BarChart></ResponsiveContainer> : <p className="text-muted-foreground text-sm py-6">Nu există documente pentru perioada aleasă; aceasta nu confirmă o activitate zero.</p>}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t pt-5">
      {partnerCards.map(({ kind, title }) => {
        const rows = summary.rankings.filter(r => r.kind === kind);
        return <div key={kind} className="min-w-0 space-y-3"><h3 className="font-semibold">Top 10 · {title.toLowerCase()}{partial ? ' · parțial' : ''}</h3><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Partener</TableHead><TableHead className="text-right">Facturi</TableHead><TableHead className="text-right">Valoare antet</TableHead></TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.partner_id}><TableCell className="break-words">{r.name || `Partener ${r.partner_id}`}</TableCell><TableCell className="text-right">{count(r.documents)}</TableCell><TableCell className="text-right whitespace-nowrap">{amount(r.value)}</TableCell></TableRow>)}</TableBody></Table></div>{!rows.length && <p className="text-muted-foreground text-sm">Niciun partener identificat pentru acest interval.</p>}</div>;
      })}
    </div>
    <div className="border-t pt-4 space-y-2"><h3 className="text-sm font-semibold">Actualitatea surselor</h3>{summary.sources.map(s => <p key={s.table} className="text-xs text-muted-foreground">{sourceNames[s.table] ?? s.table} · {s.complete ? `Ultima copiere completă: ${new Date(s.synced_at ?? '').toLocaleString('ro-RO')}` : 'Copiere incompletă / în curs'}{s.error && <span className="text-destructive"> · Copierea a întâmpinat o eroare.</span>}</p>)}<p className="text-xs text-muted-foreground">Soldurile de încasat/plătit, întârzierile, comenzile deschise și stocul nu se deduc din aceste valori: necesită verificarea repartizărilor, stărilor și mișcărilor.</p></div>
  </section>;
}
