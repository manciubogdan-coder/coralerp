import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Square, CheckCircle, ArrowLeft, Package, Users, Loader2 } from 'lucide-react';
import { useHorecaWork } from '@/hooks/productie/useHorecaWork';
import { type ProductieComanda, type ProductieSesiuneLucru } from '@/hooks/productie/useProductionData';
import { horecaOrderGroup, type HorecaGroup } from '../../../supabase/functions/_shared/horecaRules';
import { wholeUnits } from '@/lib/productie/finishSession';
import { toast } from '@/hooks/use-toast';
import OrderPackaging from './OrderPackaging';
import { useHorecaGroups } from '@/hooks/productie/useHorecaGroups';

const unitOf = (order: ProductieComanda) => {
  const unit = order.productie_produse?.unitate_masura || 'buc';
  return /^\d+$/.test(unit) ? 'buc' : unit;
};
const done = (order: ProductieComanda) => (order as any).direct_picking || order.status === 'completed' ||
  Number(order.cantitate_reala_produsa || 0) + Number(order.cantitate_din_restock || 0) >= wholeUnits(order.cantitate);
const left = (order: ProductieComanda) => done(order) ? 0 : Math.max(0,
  wholeUnits(order.cantitate) - Number(order.cantitate_reala_produsa || 0) - Number(order.cantitate_din_restock || 0));
const fmt = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 2 });

export default function HorecaOrdersView({ orders, sessions, day }: {
  orders: ProductieComanda[]; sessions: ProductieSesiuneLucru[]; day: string;
}) {
  const [opened, setOpened] = useState<HorecaGroup | null>(null);
  const [dialog, setDialog] = useState<'start' | 'full' | 'partial' | null>(null);
  const [operator, setOperator] = useState('');
  const [people, setPeople] = useState(1);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [waste, setWaste] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const work = useHorecaWork();
  const config = useHorecaGroups();
  const groupOrders = orders.filter(o => horecaOrderGroup(o) === opened);
  const active = sessions.filter(s => s.status === 'activa' && groupOrders.some(o => o.id === s.comanda_id));
  const activeIds = new Set(active.map(s => s.comanda_id));
  const products = new Map<string, ProductieComanda[]>();
  groupOrders.forEach(o => products.set(o.produs_id, [...(products.get(o.produs_id) || []), o]));
  const productRows = [...products].sort((a, b) => (a[1][0]?.productie_produse?.nume || '').localeCompare(b[1][0]?.productie_produse?.nume || ''));
  const finishRows = productRows.filter(([, rows]) => rows.some(o => activeIds.has(o.id) && !(o as any).direct_picking));
  const canStart = groupOrders.some(o => left(o) > 0 && !activeIds.has(o.id));
  const showError = (error: any) => toast({ title: 'Nu s-a terminat acțiunea', description: error?.message || String(error), variant: 'destructive' });

  const openFinish = (mode: 'full' | 'partial') => {
    setQuantities(Object.fromEntries(finishRows.map(([id, rows]) => [id, String(mode === 'full' ? rows.filter(o => activeIds.has(o.id)).reduce((sum, o) => sum + left(o), 0) : 0)])));
    setWaste({}); setDialog(mode);
  };
  const submit = async () => {
    try {
      if (dialog === 'start') {
        const count = await work.start(groupOrders.map(o => o.id), operator, people);
        toast({ title: 'Sesiune HoReCa pornită', description: `${count || 0} rânduri de comandă pornite.` });
      } else {
        const parse = (values: Record<string, string>, id: string) => {
          const text = values[id] ?? '0';
          const n = Number(text.trim().replace(',', '.'));
          if (!text.trim() || !Number.isFinite(n) || n < 0) throw new Error('Completează cantități valide pentru fiecare produs.');
          return n;
        };
        const made = new Map(finishRows.map(([id]) => [id, parse(quantities, id)]));
        const losses = new Map(finishRows.map(([id]) => [id, parse(waste, id)]));
        if ([...made.values()].some(n => n > 0) && [...losses.values()].every(n => n === 0) &&
          !window.confirm('Ești sigur că nu ai avut rebut deloc?')) return;
        const result = await work.finish(groupOrders.map(o => o.id), made, losses, dialog === 'full');
        toast({ title: result?.some(r => r.remaining > 0) || dialog === 'partial' ? 'Sesiune închisă parțial' : 'Comandă HoReCa finalizată',
          description: result?.some(r => r.remaining > 0) ? 'Cantitățile rămase sunt disponibile pentru reluare.' : undefined });
      }
      setDialog(null);
    } catch (error) { showError(error); }
  };

  if (!opened) return (
    <div className="grid gap-4 md:grid-cols-2">
      {config.isError && <p role="alert" className="text-destructive">Grupele HoReCa nu s-au putut încărca.</p>}
      {(config.data?.groups || []).map(({ name: group }) => {
        const rows = orders.filter(o => horecaOrderGroup(o) === group);
        const running = sessions.filter(s => s.status === 'activa' && rows.some(o => o.id === s.comanda_id));
        const finished = rows.filter(done).length;
        return <Card key={group}>
          <CardHeader className="pb-3"><CardTitle className="flex items-center justify-between gap-2 text-lg">
            {group}<Badge variant={running.length ? 'default' : 'secondary'}>{running.length ? 'În lucru' : rows.length && finished === rows.length ? 'Terminată' : 'De făcut'}</Badge>
          </CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span>{new Set(rows.map(o => o.magazin)).size} clienți</span><span>{new Set(rows.map(o => o.produs_id)).size} produse</span>
              <span>{finished}/{rows.length} rânduri terminate</span>
            </div>
            <Button className="w-full" variant="outline" disabled={!rows.length} onClick={() => { setOpened(group); setSearch(''); }}>
              <Package className="mr-2 h-4 w-4" />Deschide comanda {group}
            </Button>
          </CardContent>
        </Card>;
      })}
    </div>
  );

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={() => setOpened(null)}><ArrowLeft className="mr-2 h-4 w-4" />Comenzi HoReCa</Button>
      <h3 className="text-xl font-semibold">{opened}</h3>
      <span className="text-sm text-muted-foreground">{day.split('-').reverse().join('.')}</span>
      {active.length > 0 && <Badge>În lucru</Badge>}
    </div>
    {active.length > 0 && <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
      {[...new Set(active.map(s => `${s.nume_operator} · ${s.numar_angajati} oameni`))].map(team => <span key={team} className="inline-flex items-center gap-1"><Users className="h-4 w-4" />{team}</span>)}
      <span>Pornită: {new Date(Math.min(...active.map(s => new Date(s.ora_start).getTime()))).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>}
    <div className="flex flex-wrap gap-2">
      {canStart && <Button disabled={work.busy} onClick={() => setDialog('start')}><Play className="mr-2 h-4 w-4" />{active.length ? 'Pornește produsele rămase' : 'Pornire sesiune'}</Button>}
      {active.length > 0 && <>
        <Button disabled={work.busy || canStart} onClick={() => openFinish('full')}><CheckCircle className="mr-2 h-4 w-4" />Finalizează toată comanda</Button>
        <Button variant="outline" disabled={work.busy} onClick={() => openFinish('partial')}><Square className="mr-2 h-4 w-4" />Închide parțial</Button>
      </>}
    </div>
    <Input placeholder="Caută produs sau client" aria-label="Caută în comanda HoReCa" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="max-h-[65vh] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background"><TableRow>
          <TableHead>Produs / clienți</TableHead><TableHead className="text-right">Comandat</TableHead><TableHead className="text-right">Terminat</TableHead><TableHead className="text-right">Rămas</TableHead><TableHead>Stare</TableHead>
        </TableRow></TableHeader>
        <TableBody>{productRows.filter(([, rows]) => rows.some(o => `${o.productie_produse?.nume} ${o.magazin}`.toLowerCase().includes(search.toLowerCase()))).map(([id, rows]) => {
          const first = rows[0]; if (!first) return null;
          const requested = rows.reduce((sum, o) => sum + wholeUnits(o.cantitate), 0);
          const remains = rows.reduce((sum, o) => sum + left(o), 0);
          const direct = rows.every(o => (o as any).direct_picking);
          return <TableRow key={id}>
            <TableCell className="min-w-[210px] align-top"><p className="font-semibold">{first.productie_produse?.nume || id}</p>
              <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">{rows.length} rânduri · {new Set(rows.map(o => o.magazin)).size} clienți</summary>
                <div className="mt-2 space-y-1">{rows.map(o => <div key={o.id} className="flex flex-wrap gap-x-2"><span>{o.magazin} · #{o.numar_comanda}</span><span>{fmt(o.cantitate)} {unitOf(o)}</span><OrderPackaging order={o} /><span>Rămas: {fmt(left(o))} {unitOf(o)}</span></div>)}</div>
              </details>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">{fmt(requested)} {unitOf(first)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{fmt(requested - remains)} {unitOf(first)}</TableCell>
            <TableCell className="text-right whitespace-nowrap font-semibold">{fmt(remains)} {unitOf(first)}</TableCell>
            <TableCell><Badge variant={remains ? 'secondary' : 'outline'}>{direct ? 'Terminat · direct Picking' : !remains ? 'Terminat' : rows.some(o => activeIds.has(o.id)) ? 'În lucru' : requested > remains ? 'Parțial' : 'De făcut'}</Badge></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
    </div>
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open && !work.busy) setDialog(null); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader><DialogTitle>{dialog === 'start' ? 'Pornire sesiune' : dialog === 'partial' ? 'Închidere parțială' : 'Finalizare comandă'} · {opened}</DialogTitle></DialogHeader>
        <div className="min-h-0 overflow-auto py-2">
          {dialog === 'start' ? <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="horeca-operator">Operator principal</Label><Input id="horeca-operator" value={operator} onChange={e => setOperator(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="horeca-people">Număr total oameni</Label><NumberInput id="horeca-people" value={people} onValueChange={setPeople} minValue={1} integer /></div>
          </div> : <Table><TableHeader><TableRow><TableHead>Produs</TableHead><TableHead>Produs în sesiune</TableHead><TableHead>Rebut (kg)</TableHead></TableRow></TableHeader><TableBody>
            {finishRows.map(([id, rows]) => <TableRow key={id}>
              <TableCell className="min-w-[160px]">{rows[0]?.productie_produse?.nume}<span className="block text-xs text-muted-foreground">Rămas: {fmt(rows.filter(o => activeIds.has(o.id)).reduce((sum, o) => sum + left(o), 0))} {rows[0] ? unitOf(rows[0]) : ''}</span></TableCell>
              <TableCell><Input className="min-w-[95px]" type="number" min="0" step="1" aria-label={`Produs ${rows[0]?.productie_produse?.nume}`} value={quantities[id] ?? '0'} onChange={e => setQuantities(v => ({ ...v, [id]: e.target.value }))} /></TableCell>
              <TableCell><Input className="min-w-[90px]" type="number" min="0" step="0.01" aria-label={`Rebut ${rows[0]?.productie_produse?.nume}`} value={waste[id] ?? '0'} onChange={e => setWaste(v => ({ ...v, [id]: e.target.value }))} /></TableCell>
            </TableRow>)}
          </TableBody></Table>}
        </div>
        <DialogFooter className="shrink-0 gap-2"><Button variant="outline" disabled={work.busy} onClick={() => setDialog(null)}>Anulează</Button><Button disabled={work.busy} onClick={submit}>
          {work.busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dialog === 'start' ? 'Pornește sesiunea' : dialog === 'partial' ? 'Salvează și închide parțial' : 'Finalizează comanda'}
        </Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}