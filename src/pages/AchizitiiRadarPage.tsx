import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { argusFetch } from '@/lib/argusApi';
import { useAuth } from '@/contexts/AuthContext';
import BackToHubButton from '@/components/BackToHubButton';
import ClientOrdersForecast from '@/components/forecast/ClientOrdersForecast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-custom-toast';
import { Loader2, RefreshCw, Truck as TruckIcon, Settings2, Timer, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DEFAULT_RADAR_BY_TYPE, REPLAY_DAYS, addDays, byRange, delayImpact, ordersAsOf, productLines, rowAsOf, truckLight, truckLines, trucks,
  type OrderVersion, type Phase, type RadarInvType, type RadarLine, type RadarOrder, type RadarRow, type RadarSettings, type Truck,
} from '@/lib/achizitii/truckRadar';

type InvType = RadarInvType;
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
const PHASE: Record<Phase, string> = { inchis: 'Comandă închisă', azi: 'De definitivat azi', viitor: 'Încă deschisă' };
const TYPE_LABEL: Record<InvType, string> = { 'materii-prime': 'Materii prime', ambalaje: 'Ambalaje', etichete: 'Etichete' };
// Forecastul ascuns se recalculează doar când i se schimbă tipul, nu la fiecare clic pe pagină.
const HiddenForecast = React.memo(ClientOrdersForecast);
const isIssue = (l: RadarLine) => l.status !== 'ok' || (l.premature && !l.reviewed && l.phase !== 'inchis');
const worstPhase = (lines: RadarLine[]): Phase => lines.some((l) => l.phase === 'inchis') ? 'inchis' : lines.some((l) => l.phase === 'azi') ? 'azi' : 'viitor';
const stockCell = (v: number | null, unit: string) => v === null ? '—' : v < 0 ? <span className="text-destructive">{fmt(v)} {unit}</span> : `${fmt(v)} ${unit}`;

const AchizitiiRadarPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [type, setType] = useState<InvType>('materii-prime');
  const [rows, setRows] = useState<RadarRow[]>([]);
  const [orders, setOrders] = useState<RadarOrder[]>([]);
  const [history, setHistory] = useState<OrderVersion[]>([]);
  const [byType, setByType] = useState<Record<InvType, RadarSettings>>(DEFAULT_RADAR_BY_TYPE);
  const settings = byType[type];
  const [draft, setDraft] = useState<RadarSettings>(DEFAULT_RADAR_BY_TYPE['materii-prime']);
  const [showSettings, setShowSettings] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [tick, setTick] = useState(0);
  const [delayArrival, setDelayArrival] = useState('');
  const [delayDays, setDelayDays] = useState(1);
  const [clock, setClock] = useState(bucharest());
  // Ziua radarului: azi, sau o zi din trecut ca să vezi cum arăta atunci.
  const [viewDay, setViewDay] = useState(clock.today);
  const [viewTime, setViewTime] = useState('12:00');
  const past = viewDay < clock.today;
  const nowTime = past ? viewTime : clock.time;

  useEffect(() => {
    argusFetch<{ settings: Record<InvType, RadarSettings> }>('radar_settings').then((r) => setByType({ ...DEFAULT_RADAR_BY_TYPE, ...r.settings }))
      .catch((e) => toast({ title: 'Setările radarului nu s-au încărcat', description: String(e?.message || e), variant: 'destructive' }));
  }, []);
  useEffect(() => { setDraft(settings); }, [settings]);
  // Reîmprospătare automată la 5 minute.
  useEffect(() => { const t = setInterval(() => { setClock(bucharest()); setTick((x) => x + 1); }, 5 * 60 * 1000); return () => clearInterval(t); }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const from = addDays(addDays(bucharest().today, -REPLAY_DAYS), -3);
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
  const active = useMemo(() => ordersAsOf(orders, viewDay, clock.today, history), [orders, viewDay, clock.today, history]);
  const effRows = useMemo(() => rows.map((r) => rowAsOf(r, viewDay, clock.today, active)), [rows, viewDay, clock.today, active]);
  const byProduct = settings.deadlineFrom === 'produs';

  const truckData = useMemo(() => {
    if (byProduct) {
      const maxLead = effRows.reduce((m, r) => Math.max(m, Math.round(r.leadTime ?? 0)), 0);
      const end = addDays(viewDay, Math.min(60, Math.max(14, maxLead + 7)));
      const lines = productLines(effRows, active, settings, viewDay, nowTime, end, history);
      const days = [...new Set(lines.map((l) => l.arrival))].sort();
      return days.map((d) => {
        const mine = lines.filter((l) => l.arrival === d);
        const truck: Truck = { loading: d, arrival: d, orderDay: '', deadline: '', phase: worstPhase(mine) };
        return { truck, lines: mine, light: truckLight(mine) };
      });
    }
    const list = trucks(settings, viewDay, nowTime);
    return list.map((t, i) => {
      const next = list[i + 1]?.arrival ?? addDays(t.arrival, 1);
      const lines = truckLines(effRows, active, t, next, settings, viewDay, history);
      return { truck: t, lines, light: truckLight(lines) };
    });
  }, [byProduct, effRows, active, settings, viewDay, nowTime, history]);
  const totals = useMemo(() => ({
    rosu: truckData.filter((t) => t.light === 'rosu').length,
    galben: truckData.filter((t) => t.light === 'galben').length,
    verde: truckData.filter((t) => t.light === 'verde').length,
  }), [truckData]);
  const counts = useMemo(() => ({
    issues: truckData.reduce((s, t) => s + t.lines.filter(isIssue).length, 0),
    all: truckData.reduce((s, t) => s + t.lines.length, 0),
  }), [truckData]);
  const overall = totals.rosu ? 'rosu' : totals.galben ? 'galben' : 'verde';
  const impact = useMemo(() => (delayArrival ? delayImpact(effRows, delayArrival, delayDays, viewDay) : []), [effRows, delayArrival, delayDays, viewDay]);
  const onTruck = useMemo(() => (delayArrival ? effRows.filter((r) => (r.orderedPerDate?.[delayArrival] || 0) > 0).length : 0), [effRows, delayArrival]);

  const save = async () => {
    try {
      const r = await argusFetch<{ settings: Record<InvType, RadarSettings> }>('radar_settings_save', {}, { inventory_type: type, settings: draft });
      setByType({ ...DEFAULT_RADAR_BY_TYPE, ...r.settings }); setShowSettings(false);
      toast({ title: `Reguli salvate pentru ${TYPE_LABEL[type]}` });
    } catch (e: any) { toast({ title: 'Nu s-a salvat', description: String(e?.message || e), variant: 'destructive' }); }
  };
  const changeDay = (d: string) => {
    const min = addDays(clock.today, -REPLAY_DAYS);
    setViewDay(!d ? clock.today : d < min ? min : d > clock.today ? clock.today : d);
    setDelayArrival('');
  };
  const ready = rows.length > 0;

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TruckIcon className="h-6 w-6" /> Radar achiziții</h1>
          <p className="text-muted-foreground text-sm">Pe fiecare livrare: stocul, ce s-a comandat față de ce trebuie, dacă s-a comandat la termen și ce se întâmplă dacă întârzie.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setClock(bucharest()); setTick((x) => x + 1); }} disabled={loadingOrders}>
            {loadingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Reîmprospătează
          </Button>
          {isAdmin && <Button variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}><Settings2 className="h-4 w-4" /> Reguli {TYPE_LABEL[type].toLowerCase()}</Button>}
          <BackToHubButton />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Tabs value={type} onValueChange={(v) => { setType(v as InvType); setRows([]); setDelayArrival(''); }}>
          <TabsList><TabsTrigger value="materii-prime">Materii prime</TabsTrigger><TabsTrigger value="ambalaje">Ambalaje</TabsTrigger><TabsTrigger value="etichete">Etichete</TabsTrigger></TabsList>
        </Tabs>
        <div className="flex items-end gap-2 ml-auto">
          <div><Label className="text-xs flex items-center gap-1"><History className="h-3 w-3" /> Ziua radarului</Label>
            <Input type="date" className="h-9 w-40" value={viewDay} min={addDays(clock.today, -REPLAY_DAYS)} max={clock.today} onChange={(e) => changeDay(e.target.value)} /></div>
          {past && <div><Label className="text-xs">Ora</Label><Input type="time" className="h-9 w-28" value={viewTime} onChange={(e) => setViewTime(e.target.value || '12:00')} /></div>}
          <Button size="sm" variant="outline" onClick={() => changeDay(addDays(viewDay, -1))}>‹ Ziua dinainte</Button>
          <Button size="sm" variant="outline" disabled={!past} onClick={() => changeDay(addDays(viewDay, 1))}>Ziua următoare ›</Button>
          {past && <Button size="sm" onClick={() => changeDay(clock.today)}>Înapoi la azi</Button>}
        </div>
      </div>

      {past && (
        <div className="rounded-md border border-accent bg-accent/10 p-3 text-sm">
          Vezi radarul cum arăta pe <b>{dLabel(viewDay)}</b> la ora {viewTime}: stocul de la începutul acelei zile, doar comenzile furnizor plasate până atunci
          (cu cantitatea văzută atunci, unde radarul o înregistrase) și media consumului din cele 4 săptămâni dinainte. Comenzile fără dată de plasare sunt considerate deja făcute.
        </div>
      )}

      {isAdmin && showSettings && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Reguli {TYPE_LABEL[type].toLowerCase()} (fiecare depozit are regulile lui)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Termenul de comandă se calculează</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                <Button size="sm" variant={draft.deadlineFrom === 'tir' ? 'default' : 'outline'} onClick={() => setDraft({ ...draft, deadlineFrom: 'tir' })}>După tir (zile avans + tranzit, la fel pentru toate)</Button>
                <Button size="sm" variant={draft.deadlineFrom === 'produs' ? 'default' : 'outline'} onClick={() => setDraft({ ...draft, deadlineFrom: 'produs' })}>După lead time-ul fiecărui produs</Button>
              </div>
              {draft.deadlineFrom === 'produs' && <p className="text-xs text-muted-foreground mt-1">Ziua livrării − lead time-ul produsului (ex. 21 zile la un ambalaj, 3 zile la altul). Lead time-ul se schimbă în Achiziții → Forecast → Setări produse.</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {draft.deadlineFrom === 'tir' && <>
                <div><Label>Zile avans comandă</Label><Input type="number" min={0} value={draft.advanceDays} onChange={(e) => setDraft({ ...draft, advanceDays: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground mt-1">{draft.advanceDays} = azi comanzi pentru încărcarea din {draft.advanceDays === 2 ? 'poimâine' : `+${draft.advanceDays} zile`}</p></div>
                <div><Label>Zile tranzit</Label><Input type="number" min={0} value={draft.transitDays} onChange={(e) => setDraft({ ...draft, transitDays: Number(e.target.value) })} /></div>
              </>}
              <div><Label>Ora limită</Label><Input type="time" value={draft.cutoff} onChange={(e) => setDraft({ ...draft, cutoff: e.target.value })} /></div>
              <div><Label>Toleranță %</Label><Input type="number" min={0} value={draft.tolerancePct} onChange={(e) => setDraft({ ...draft, tolerancePct: Number(e.target.value) })} /></div>
            </div>
            <div><Label>{draft.deadlineFrom === 'tir' ? 'Zile cu încărcare' : 'Zile în care se poate primi marfă'}</Label>
              <div className="flex gap-1 mt-1">{WD.map((w, i) => {
                const on = draft.loadingWeekdays.includes(i + 1);
                return <Button key={w} size="sm" variant={on ? 'default' : 'outline'} onClick={() => setDraft({ ...draft, loadingWeekdays: on ? draft.loadingWeekdays.filter((d) => d !== i + 1) : [...draft.loadingWeekdays, i + 1] })}>{w}</Button>;
              })}</div></div>
            <div className="flex items-center gap-2"><Switch id="ws" checked={draft.warnSurplus} onCheckedChange={(v) => setDraft({ ...draft, warnSurplus: v })} />
              <Label htmlFor="ws">Avertizează și când se comandă prea mult (marfă perisabilă)</Label></div>
            <Button onClick={save}>Salvează regulile pentru {TYPE_LABEL[type].toLowerCase()}</Button>
          </CardContent></Card>
      )}

      <Card className={cn('border-2', overall === 'rosu' ? 'border-destructive' : overall === 'galben' ? 'border-accent' : 'border-primary')}>
        <CardContent className="py-4 flex flex-wrap items-center gap-4">
          <span className={cn('rounded-full px-4 py-2 font-bold', LIGHT[overall])}>{LIGHT_TEXT[overall]}</span>
          <span className="text-sm">{totals.rosu} {byProduct ? 'zile' : 'tiruri'} cu risc · {totals.galben} de verificat · {totals.verde} în regulă</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {past ? `Pe ${dLabel(viewDay)} la ${viewTime}` : `Acum ${clock.time}`} · {byProduct
              ? `termenul fiecărui produs = livrare − lead time, până la ${settings.cutoff}`
              : `comanda din ziua aceasta e pentru încărcarea din ${dLabel(addDays(viewDay, settings.advanceDays))}, până la ${settings.cutoff}`}
          </span>
        </CardContent>
      </Card>

      {!ready && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se calculează necesarul din forecast…</div>}

      {ready && <>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={onlyIssues ? 'default' : 'outline'} onClick={() => setOnlyIssues(true)}>Doar produsele cu probleme ({counts.issues})</Button>
          <Button size="sm" variant={!onlyIssues ? 'default' : 'outline'} onClick={() => setOnlyIssues(false)}>Toate produsele ({counts.all})</Button>
        </div>
        {truckData.length === 0 && <p className="text-sm text-muted-foreground">Nicio livrare și nicio lipsă în perioada urmărită.</p>}
        <div className="space-y-3">
          {truckData.map(({ truck, lines, light }) => {
            const shown = onlyIssues ? lines.filter(isIssue) : lines;
            const simOpen = delayArrival === truck.arrival;
            return (
              <Card key={truck.arrival}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-3 py-1 text-xs font-bold', LIGHT[light])}>{LIGHT_TEXT[light]}</span>
                    <CardTitle className="text-base">{byProduct ? `Livrare ${dLabel(truck.arrival)}` : `Încărcare ${dLabel(truck.loading)} → sosire ${dLabel(truck.arrival)}`}</CardTitle>
                    {!byProduct && <>
                      <Badge variant={truck.phase === 'azi' ? 'default' : 'outline'}>{PHASE[truck.phase]}</Badge>
                      <span className="text-xs text-muted-foreground">Termen comandă: {dLabel(truck.orderDay)} {settings.cutoff}</span>
                    </>}
                    <Button size="sm" className="ml-auto" variant={simOpen ? 'default' : 'outline'} onClick={() => setDelayArrival(simOpen ? '' : truck.arrival)}><Timer className="h-4 w-4" /> {simOpen ? 'Ascunde simularea' : 'Simulează întârziere'}</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {simOpen && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        Dacă livrarea din {dLabel(truck.arrival)} întârzie
                        <Input type="number" min={1} max={5} className="w-20 h-8" value={delayDays} onChange={(e) => setDelayDays(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} /> zile
                      </div>
                      {onTruck === 0 ? <p className="text-sm text-muted-foreground">Pentru ziua aceasta nu e nicio comandă înregistrată, deci întârzierea nu schimbă stocul. Dacă trebuia să vină marfă, lipsa apare mai jos la „Necesar”.</p>
                        : impact.length === 0 ? <p className="text-sm">{onTruck} produse vin în ziua aceasta. Stocul și tamponul acoperă producția și dacă întârzie {delayDays} {delayDays === 1 ? 'zi' : 'zile'}.</p> : (
                        <Table><TableHeader><TableRow><TableHead>Produs</TableHead><TableHead>Rămâne fără din</TableHead><TableHead className="text-right">Lipsă</TableHead></TableRow></TableHeader>
                          <TableBody>{byRange(impact, type).map((g) => <React.Fragment key={g.group}>
                            <TableRow className="bg-muted/60 hover:bg-muted/60"><TableCell colSpan={3} className="py-1.5 font-semibold text-sm">{g.group} ({g.items.length})</TableCell></TableRow>
                            {g.items.map((d) => <TableRow key={d.key}><TableCell className="font-medium">{d.name}</TableCell><TableCell>{dLabel(d.firstDay)}</TableCell>
                            <TableCell className="text-right tabular-nums text-destructive font-semibold">{fmt(d.shortage)} {d.unit}</TableCell></TableRow>)}</React.Fragment>)}</TableBody></Table>)}
                    </div>
                  )}
                  {shown.length === 0 ? <p className="text-sm text-muted-foreground">{lines.length ? 'Toate produsele sunt în toleranță.' : 'Nimic de comandat pentru livrarea aceasta.'}</p> : (
                    <Table><TableHeader><TableRow>
                      <TableHead>Produs</TableHead>
                      <TableHead className="text-right" title="Stocul la începutul zilei radarului">Stoc {past ? dLabel(viewDay) : 'azi'}</TableHead>
                      <TableHead className="text-right" title="Stocul așteptat la începutul zilei livrării, cu livrările de dinainte și consumul până atunci">Stoc la sosire</TableHead>
                      <TableHead className="text-right">Comandat inițial</TableHead><TableHead className="text-right">Comandat {past ? 'atunci' : 'acum'}</TableHead>
                      <TableHead className="text-right" title="Consumul mediu istoric până la următoarea livrare">Necesar</TableHead><TableHead className="text-right" title="Stoc la sosire + comandat − necesar">Diferență</TableHead>
                      {byProduct && <TableHead>Termen comandă</TableHead>}
                      <TableHead>Stare</TableHead>
                    </TableRow></TableHeader>
                      <TableBody>{byRange(shown, type).map((g) => <React.Fragment key={g.group}>
                        <TableRow className="bg-muted/60 hover:bg-muted/60"><TableCell colSpan={byProduct ? 9 : 8} className="py-1.5 font-semibold text-sm">{g.group} ({g.items.length})</TableCell></TableRow>
                        {g.items.map((l) => (
                        <TableRow key={l.key}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{stockCell(l.stockToday, l.unit)}</TableCell>
                          <TableCell className="text-right tabular-nums">{stockCell(l.stockAtArrival, l.unit)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{l.firstQty === null ? '—' : `${fmt(l.firstQty)} ${l.unit}`}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(l.ordered)} {l.unit}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <Popover><PopoverTrigger asChild><button className="underline decoration-dotted underline-offset-2">{fmt(l.need)} {l.unit}</button></PopoverTrigger>
                              <PopoverContent className="w-64 text-sm"><p className="font-semibold mb-1">Consum mediu istoric pe zile</p>
                                {l.needDays.map((d) => <div key={d.day} className="flex justify-between tabular-nums"><span>{dLabel(d.day)}</span><span>{fmt(d.qty)} {l.unit}</span></div>)}
                                <div className="flex justify-between tabular-nums font-semibold border-t mt-1 pt-1"><span>= Necesar</span><span>{fmt(l.need)} {l.unit}</span></div>
                                <p className="text-xs text-muted-foreground mt-2">Media aceleiași zile din cele 4 săptămâni {past ? `dinainte de ${dLabel(viewDay)}` : 'trecute'}.</p>
                                <div className="flex justify-between tabular-nums mt-2"><span>Stoc la sosire</span><span>{fmt(l.stockAtArrival)} {l.unit}</span></div>
                                <div className="flex justify-between tabular-nums"><span>+ Comandat</span><span>{fmt(l.ordered)} {l.unit}</span></div>
                                <div className="flex justify-between tabular-nums"><span>− Necesar</span><span>{fmt(l.need)} {l.unit}</span></div>
                                <div className="flex justify-between tabular-nums font-semibold border-t mt-1 pt-1"><span>= Diferență</span><span>{l.delta > 0 ? '+' : ''}{fmt(l.delta)} {l.unit}</span></div>
                              </PopoverContent></Popover>
                          </TableCell>
                          <TableCell className={cn('text-right tabular-nums font-semibold', l.status === 'lipsa' && 'text-destructive')}>{l.delta > 0 ? '+' : ''}{fmt(l.delta)} {l.unit}</TableCell>
                          {byProduct && <TableCell className="whitespace-nowrap text-sm">{dLabel(l.orderDay)} <span className="text-muted-foreground">({l.leadTime} zile)</span></TableCell>}
                          <TableCell className="space-x-1">
                            {l.status === 'lipsa' && <Badge variant="destructive">{byProduct && l.phase === 'inchis' ? 'Lipsă: termen depășit' : byProduct && l.phase === 'viitor' ? `Lipsă: comandă până ${dLabel(l.orderDay)}` : 'Lipsă: suplimentează'}</Badge>}
                            {l.status === 'surplus' && <Badge variant="secondary">Surplus: risc marfă veche</Badge>}
                            {l.status === 'ok' && <Badge variant="outline">{l.delta > 0 && !settings.warnSurplus ? 'Acoperit' : 'În toleranță'}</Badge>}
                            {l.premature && !l.reviewed && <Badge variant="outline">Comandat prea devreme, neverificat</Badge>}
                            {l.reviewed && <Badge variant="outline">Verificat la termen</Badge>}
                          </TableCell>
                        </TableRow>))}</React.Fragment>)}</TableBody></Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">„Stoc la sosire” = stocul de la începutul zilei radarului + livrările de dinainte − consumul până în ziua livrării (negativ = lipsă). „Comandat inițial” e prima cantitate văzută de radar. „Necesar” = consumul mediu istoric (aceeași zi a săptămânii, ultimele 4 săptămâni) din ziua livrării până la următoarea livrare. „Diferență” = stoc la sosire + comandat − necesar; minus înseamnă lipsă.{byProduct ? ' Fiecare produs e verificat în zilele în care îi vine marfă și în prima zi în care scade sub tampon.' : ''}</p>
      </>}

      <div className="hidden" aria-hidden><HiddenForecast key={`${type}-${tick}`} inventoryType={type} onRows={onRows} /></div>
    </div>
  );
};

export default AchizitiiRadarPage;
