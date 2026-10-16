import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface Source { table: string; source: string; rows: number; synced_at?: string | null; error?: string | null; columns: { name: string; type: string }[] }
const categories = [
  { name: 'Clienți', match: /client|customer|partener|partner/i },
  { name: 'Furnizori', match: /furniz|supplier|partener|partner/i },
  { name: 'Comenzi de vânzare', match: /sales.*order|order.*sales|comenzi|comanda/i },
  { name: 'Comenzi de achiziție', match: /purchase.*order|order.*purchase|achiz|comenzi|comanda/i },
  { name: 'Facturi', match: /factur|invoice/i },
  { name: 'Toate datele', match: /./ },
];

export default function CeoCommercialData({ catalog, start, end, call }: { catalog: Source[]; start: string; end: string; call: (payload: Record<string, unknown>) => Promise<any> }) {
  const [category, setCategory] = useState(0);
  const [selected, setSelected] = useState('');
  const [dateCol, setDateCol] = useState('');
  const [searchCol, setSearchCol] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const sources = catalog.filter(t => categories[category].match.test(t.source));
  const source = catalog.find(t => t.table === selected);
  const dates = source?.columns.filter(c => c.type === 'date' || c.type.startsWith('timestamp')) ?? [];
  useEffect(() => { setRows([]); setOffset(0); setError(''); }, [selected, start, end, dateCol]);
  const choose = (value: string) => { setSelected(value); setDateCol(''); setSearchCol(''); setSearch(''); };
  const load = async (next = 0) => {
    if (!source?.synced_at) return;
    setBusy(true); setError('');
    try {
      const result = await call({ action: 'browse', config: { table: selected, date_col: dateCol, start, end, search_col: searchCol, search, offset: next } });
      setRows((result.rows ?? []).slice(0, 50)); setMore((result.rows ?? []).length > 50); setOffset(next);
    } catch (e) { setError((e as Error).message); setRows([]); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4">
    <div className="flex flex-wrap gap-2">{categories.map((c, i) => <Button key={c.name} variant={i === category ? 'default' : 'outline'} onClick={() => { setCategory(i); choose(''); }}>{c.name}</Button>)}</div>
    <label className="block text-sm space-y-1"><span>Sursa Senior</span><select aria-label="Sursa Senior" className="w-full border rounded-md bg-background p-2" value={selected} onChange={e => choose(e.target.value)}><option value="">Selectează sursa ({sources.length})</option>{sources.map(t => <option key={t.table} value={t.table}>{t.source} · {t.synced_at ? `${t.rows.toLocaleString('ro-RO')} rânduri` : 'încă neîncărcat'}</option>)}</select></label>
    {!sources.length && <p className="text-sm text-muted-foreground">Aceste surse nu au ajuns încă în oglindă. Vor apărea după identificarea lor de către programul de copiere.</p>}
    {source && <>
      <p className="text-sm text-muted-foreground">{source.synced_at ? `Ultima copiere completă: ${new Date(source.synced_at).toLocaleString('ro-RO')}` : 'Sursa nu a fost încă încărcată complet.'}{source.error ? ` · Eroare copiere: ${source.error}` : ''}</p>
      <p className="text-xs text-muted-foreground">Date originale din {source.source}; încadrarea surselor se face după denumire. Partenerii pot include atât clienți, cât și furnizori; nu se presupune automat rolul lor.</p>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm space-y-1"><span className="block">Data documentului</span><select aria-label="Data documentului" value={dateCol} onChange={e => setDateCol(e.target.value)} className="border rounded-md bg-background p-2 max-w-full"><option value="">Fără filtrare pe dată</option>{dates.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
        <label className="text-sm space-y-1"><span className="block">Caută în</span><select aria-label="Caută în" value={searchCol} onChange={e => setSearchCol(e.target.value)} className="border rounded-md bg-background p-2"><option value="">Selectează coloana</option>{source.columns.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
        <Input aria-label="Căutare în datele Senior" placeholder="Nume, număr document…" value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-64" />
        <Button disabled={busy || !source.synced_at || (!!search && !searchCol)} onClick={() => load()}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}Afișează</Button>
      </div>
      {!dateCol && <p className="text-xs text-muted-foreground">Perioada de sus nu se aplică fără o coloană de dată selectată; nomenclatoarele se afișează integral.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-auto max-h-[60vh] border rounded-md"><Table><TableHeader><TableRow>{source.columns.map(c => <TableHead key={c.name} className="whitespace-nowrap">{c.name}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((r, i) => <TableRow key={i}>{source.columns.map(c => <TableCell key={c.name} className="whitespace-nowrap">{r[c.name] == null ? '—' : typeof r[c.name] === 'object' ? JSON.stringify(r[c.name]) : String(r[c.name])}</TableCell>)}</TableRow>)}</TableBody></Table></div>
      <div className="flex items-center gap-3"><Button size="icon" variant="outline" title="Pagina anterioară" disabled={busy || offset === 0} onClick={() => load(Math.max(0, offset - 50))}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">{rows.length ? `${offset + 1}–${offset + rows.length}` : 'Nicio înregistrare afișată'}</span><Button size="icon" variant="outline" title="Pagina următoare" disabled={busy || !more} onClick={() => load(offset + 50)}><ChevronRight className="h-4 w-4" /></Button></div>
    </>}
  </section>;
}