import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { argusFetch } from '@/lib/argusApi';
import BackToHubButton from '@/components/BackToHubButton';
import ClientOrdersForecast from '@/components/forecast/ClientOrdersForecast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-custom-toast';
import { Loader2, RefreshCw, Truck as TruckIcon, Settings2, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_RADAR_SETTINGS, addDays, delayImpact, truckLight, truckLines, trucks,
  type OrderVersion, type RadarOrder, type RadarRow, type RadarSettings,
} from '@/lib/achizitii/truckRadar';

type InvType = 'materii-prime' | 'ambalaje' | 'etichete';
const ORDERS_TABLE: Record<InvType, string> = { 'materii-prime': 'product_orders', ambalaje: 'ambalaje_product_orders', etichete: 'etichete_product_orders' };
const WD = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
const fmt = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 1 });
const dLabel = (d: string) => `${WD[((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7)]} ${d.slice(8, 10)}.${d.slice(5, 7)}`;
const bucharest = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { today: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour').replace('24', '00')}:${g('minute')}` };
};
const LIGHT = { rosu: 'bg-destructive text-destructive-foreground', galben: 'bg-accent text-accent-foreground', verde: 'bg-primary text-primary-foreground' };
const LIGHT_TEXT = { rosu: 'Risc', galben: 'De verificat', verde: 'În regulă' };
// Forecastul ascuns se recalculează doar când i se schimbă tipul, nu la fiecare clic pe pagină.
const HiddenForecast = React.memo(ClientOrdersForecast);
const PHASE = { inchis: 'Comandă închisă', azi: 'De definitivat azi', viitor: 'Încă deschisă' };

const AchizitiiRadarPage: React.FC = () => {
  const [type, setType] = useState<InvType>('materii-prime');
  const [rows, setRows] = useState<RadarRow[]>([]);
  const [orders, setOrders] = useState<RadarOrder[]>([]);
  const [history, setHistory] = useState<OrderVersion[]>([]);
  const [settings, setSettings] = useState<RadarSettings>(DEFAULT_RADAR_SETTINGS);
  const [draft, setDraft] = useState<RadarSettings>(DEFAULT_RADAR_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [tick, setTick] = useState(0);
  const [delayArrival, setDelayArrival] = useState('');
  const [delayDays, setDelayDays] = useState(1);
  const [clock, setClock] = useState(bucharest());

  useEffect(() => {
    argusFetch<{ settings: RadarSettings }>('radar_settings').then((r) => { setSettings(r.settings); setDraft(r.settings); })
      .catch((e) => toast({ title: 'Setările radarului nu s-au încărcat', description: String(e?.message || e), variant: 'destructive' }));
  }, []);
  // Reîmprospătare automată la 5 minute.
  useEffect(() => { const t = setInterval(() => { setClock(bucharest()); setTick((x) => x + 1); }, 5 * 60 * 1000); return () => clearInterval(t); }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const from = addDays(bucharest().today, -3);
      const all: any[] = [];
      for (let p = 0; ; p += 1000) {
        const { data, error } = await (supabase as any).from(ORDERS_TABLE[type])
          .select('id, product_id, quantity_ordered, expected_delivery_date, order_date, status')
          .gte('expected_delivery_date', from).order('id').range(p, p + 999);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      const list: RadarOrder[] = all.map((o) => ({ id: String(o.id), product_id: o.product_id, quantity: Number(o.quantity_ordered) || 0,
        delivery_date: String(o.expected_delivery_date || '').slice(0, 10), order_date: o.order_date, status: o.status }));
      setOrders(list);
      const snap = await argusFetch<{ history: OrderVersion[] }>('radar_snapshot', {}, {
        inventory_type: type, orders: list.map((o) => ({ order_id: o.id, product_id: o.product_id, delivery_date: o.delivery_date, quantity: o.quantity, status: o.status })),
      });
      setHistory(snap.history || []);
    } catch (e: any) {
      toast({ title: 'Comenzile furnizor nu s-au încărcat', description: String(e?.message || e), variant: 'destructive' });
    } finally { setLoadingOrders(false); }
  }, [type]);
  useEffect(() => { loadOrders(); }, [loadOrders, tick]);

  const onRows = useCallback((r: any[]) => setRows(r as RadarRow[]), []);
  const list = useMemo(() => trucks(settings, clock.today, clock.time), [settings, clock]);
  const truckData = useMemo(() => list.map((t, i) => {
    const next = list[i + 1]?.arrival ?? addDays(t.arrival, 1);
    const lines = truckLines(rows, orders, t, next, settings, clock.today, history);
    return { truck: t, lines, light: truckLight(t, lines) };
  }), [list, rows, orders, settings, clock.today, history]);
  const totals = useMemo(() => ({
    rosu: truckData.filter((t) => t.light === 'rosu').length,
    galben: truckData.filter((t) => t.light === 'galben').length,
    verde: truckData.filter((t) => t.light === 'verde').length,
  }), [truckData]);
  const overall = totals.rosu ? 'rosu' : totals.galben ? 'galben' : 'verde';
  const impact = useMemo(() => (delayArrival ? delayImpact(rows, delayArrival, delayDays, clock.today) : []), [rows, delayArrival, delayDays, clock.today]);
  const onTruck = useMemo(() => (delayArrival ? rows.filter((r) => (r.orderedPerDate?.[delayArrival] || 0) > 0).length : 0), [rows, delayArrival]);
  const isIssue = (l: { status: string; premature: boolean; reviewed: boolean }, phase: string) => l.status !== 'ok' || (l.premature && !l.reviewed && phase !== 'inchis');
  const counts = useMemo(() => ({
    issues: truckData.reduce((s, t) => s + t.lines.filter((l) => isIssue(l, t.truck.phase)).length, 0),
    all: truckData.reduce((s, t) => s + t.lines.length, 0),
  }), [truckData]);

  const save = async () => {
    try {
      const r = await argusFetch<{ settings: RadarSettings }>('radar_settings_save', {}, { settings: draft });
      setSettings(r.settings); setDraft(r.settings); setShowSettings(false);
      toast({ title: 'Setări salvate' });
    } catch (e: any) { toast({ title: 'Nu s-a salvat', description: String(e?.message || e), variant: 'destructive' }); }
  };
  const ready = rows.length > 0;

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TruckIcon className="h-6 w-6" /> Radar achiziții</h1>
          <p className="text-muted-foreground text-sm">Fiecare tir: ce s-a comandat față de ce trebuie acum, dacă s-a definitivat la termen și ce se întâmplă dacă întârzie.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setClock(bucharest()); setTick((x) => x + 1); }} disabled={loadingOrders}>
            {loadingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Reîmprospătează
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}><Settings2 className="h-4 w-4" /> Reguli</Button>
          <BackToHubButton />
        </div>
      </div>

      <Tabs value={type} onValueChange={(v) => { setType(v as InvType); setRows([]); setDelayArrival(''); }}>
        <TabsList><TabsTrigger value="materii-prime">Materii prime</TabsTrigger><TabsTrigger value="ambalaje">Ambalaje</TabsTrigger><TabsTrigger value="etichete">Etichete</TabsTrigger></TabsList>
      </Tabs>

      {showSettings && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Reguli tiruri</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div><Label>Zile avans comandă</Label><Input type="number" min={0} value={draft.advanceDays} onChange={(e) => setDraft({ ...draft, advanceDays: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground mt-1">{draft.advanceDays} = azi comanzi pentru încărcarea din {draft.advanceDays === 2 ? 'poimâine' : `+${draft.advanceDays} zile`}</p></div>
              <div><Label>Ora limită</Label><Input type="time" value={draft.cutoff} onChange={(e) => setDraft({ ...draft, cutoff: e.target.value })} /></div>
              <div><Label>Zile tranzit</Label><Input type="number" min={0} value={draft.transitDays} onChange={(e) => setDraft({ ...draft, transitDays: Number(e.target.value) })} /></div>
              <div><Label>Toleranță %</Label><Input type="number" min={0} value={draft.tolerancePct} onChange={(e) => setDraft({ ...draft, tolerancePct: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Zile cu încărcare</Label>
              <div className="flex gap-1 mt-1">{WD.map((w, i) => {
                const on = draft.loadingWeekdays.includes(i + 1);
                return <Button key={w} size="sm" variant={on ? 'default' : 'outline'} onClick={() => setDraft({ ...draft, loadingWeekdays: on ? draft.loadingWeekdays.filter((d) => d !== i + 1) : [...draft.loadingWeekdays, i + 1] })}>{w}</Button>;
              })}</div></div>
            <Button onClick={save}>Salvează regulile</Button>
          </CardContent></Card>
      )}

      <Card className={cn('border-2', overall === 'rosu' ? 'border-destructive' : overall === 'galben' ? 'border-accent' : 'border-primary')}>
        <CardContent className="py-4 flex flex-wrap items-center gap-4">
          <span className={cn('rounded-full px-4 py-2 font-bold', LIGHT[overall])}>{LIGHT_TEXT[overall]}</span>
          <span className="text-sm">{totals.rosu} tiruri cu risc · {totals.galben} de verificat · {totals.verde} în regulă</span>
          <span className="text-xs text-muted-foreground ml-auto">Acum {clock.time} · comanda de azi e pentru încărcarea din {dLabel(addDays(clock.today, settings.advanceDays))}, până la {settings.cutoff}</span>
        </CardContent>
      </Card>

      {!ready && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se calculează necesarul din forecast…</div>}

      {ready && <>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={onlyIssues ? 'default' : 'outline'} onClick={() => setOnlyIssues(true)}>Doar produsele cu probleme ({counts.issues})</Button>
          <Button size="sm" variant={!onlyIssues ? 'default' : 'outline'} onClick={() => setOnlyIssues(false)}>Toate produsele ({counts.all})</Button>
        </div>
        <div className="space-y-3">
          {truckData.map(({ truck, lines, light }) => {
            const shown = onlyIssues ? lines.filter((l) => isIssue(l, truck.phase)) : lines;
            const simOpen = delayArrival === truck.arrival;
            return (
              <Card key={truck.loading}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-3 py-1 text-xs font-bold', LIGHT[light])}>{LIGHT_TEXT[light]}</span>
                    <CardTitle className="text-base">Încărcare {dLabel(truck.loading)} → sosire {dLabel(truck.arrival)}</CardTitle>
                    <Badge variant={truck.phase === 'azi' ? 'default' : 'outline'}>{PHASE[truck.phase]}</Badge>
                    <span className="text-xs text-muted-foreground">Termen comandă: {dLabel(truck.orderDay)} {settings.cutoff}</span>
                    <Button size="sm" className="ml-auto" variant={simOpen ? 'default' : 'outline'} onClick={() => setDelayArrival(simOpen ? '' : truck.arrival)}><Timer className="h-4 w-4" /> {simOpen ? 'Ascunde simularea' : 'Simulează întârziere'}</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {simOpen && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        Dacă tirul cu sosire {dLabel(truck.arrival)} întârzie
                        <Input type="number" min={1} max={5} className="w-20 h-8" value={delayDays} onChange={(e) => setDelayDays(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} /> zile
                      </div>
                      {onTruck === 0 ? <p className="text-sm text-muted-foreground">Pe tirul acesta nu e nicio comandă înregistrată, deci întârzierea nu schimbă stocul. Dacă trebuia să vină marfă, lipsa apare mai jos la „Necesar acum”.</p>
                        : impact.length === 0 ? <p className="text-sm">{onTruck} produse vin cu tirul acesta. Stocul și tamponul acoperă producția și dacă întârzie {delayDays} {delayDays === 1 ? 'zi' : 'zile'}.</p> : (
                        <Table><TableHeader><TableRow><TableHead>Produs</TableHead><TableHead>Rămâne fără din</TableHead><TableHead className="text-right">Lipsă</TableHead></TableRow></TableHeader>
                          <TableBody>{impact.map((d) => <TableRow key={d.key}><TableCell className="font-medium">{d.name}</TableCell><TableCell>{dLabel(d.firstDay)}</TableCell>
                            <TableCell className="text-right tabular-nums text-destructive font-semibold">{fmt(d.shortage)} {d.unit}</TableCell></TableRow>)}</TableBody></Table>)}
                    </div>
                  )}
                  {shown.length === 0 ? <p className="text-sm text-muted-foreground">{lines.length ? 'Toate produsele sunt în toleranță.' : 'Nimic de comandat pentru tirul acesta.'}</p> : (
                    <Table><TableHeader><TableRow>
                      <TableHead>Produs</TableHead><TableHead className="text-right">Comandat inițial</TableHead><TableHead className="text-right">Comandat acum</TableHead>
                      <TableHead className="text-right">Necesar acum</TableHead><TableHead className="text-right">Diferență</TableHead><TableHead>Stare</TableHead>
                    </TableRow></TableHeader>
                      <TableBody>{shown.map((l) => (
                        <TableRow key={l.key}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{l.firstQty === null ? '—' : `${fmt(l.firstQty)} ${l.unit}`}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(l.ordered)} {l.unit}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(l.need)} {l.unit}</TableCell>
                          <TableCell className={cn('text-right tabular-nums font-semibold', l.status === 'lipsa' && 'text-destructive')}>{l.delta > 0 ? '+' : ''}{fmt(l.delta)} {l.unit}</TableCell>
                          <TableCell className="space-x-1">
                            {l.status === 'lipsa' && <Badge variant="destructive">Lipsă: suplimentează</Badge>}
                            {l.status === 'surplus' && <Badge variant="secondary">Surplus: risc marfă veche</Badge>}
                            {l.status === 'ok' && <Badge variant="outline">În toleranță</Badge>}
                            {l.premature && !l.reviewed && <Badge variant="outline">Comandat prea devreme, neverificat</Badge>}
                            {l.reviewed && <Badge variant="outline">Verificat la termen</Badge>}
                          </TableCell>
                        </TableRow>))}</TableBody></Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">„Comandat inițial” e prima cantitate văzută de radar; modificările se înregistrează de fiecare dată când se deschide pagina (și automat la 5 minute cât e deschisă). Necesarul folosește aceleași reguli ca forecastul din Achiziții, plus o zi de tampon.</p>
      </>}

      <div className="hidden" aria-hidden><HiddenForecast key={`${type}-${tick}`} inventoryType={type} onRows={onRows} /></div>
    </div>
  );
};

export default AchizitiiRadarPage;
