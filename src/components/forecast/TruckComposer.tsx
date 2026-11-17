import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Truck, Leaf, Package, ArrowRightLeft, Pencil, Download, ShoppingCart, Plus, Trash2, RotateCcw, Check } from 'lucide-react';
import {
  arrivalFor, composeWeek, isSturdy, orderDeadline, summarizeTruck, truckLines, TINY, TRUCK_MAX, TRUCK_MIN,
  type TruckDay, type TruckItem, type TruckMove,
} from '@/lib/achizitii/truckBuilder';
import { addDays, isoWeekday } from '@/lib/achizitii/truckRadar';
import { palletKgFor } from '@/lib/forecastGroups';
import { exportTrucks, type TruckSheet } from '@/lib/achizitii/truckExport';
import TruckOrderDialog, { type TruckOrderLine } from './TruckOrderDialog';
import { cn } from '@/lib/utils';

const WD = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
const p1 = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const kg = (n: number) => `${Math.round(n).toLocaleString('ro-RO')} kg`;
const wd = (d: string) => WD[isoWeekday(d) - 1];
const dLabel = (d: string) => `${wd(d)} ${d.slice(8, 10)}.${d.slice(5, 7)}`;
const norm = (s: string) => s.trim().toLowerCase();

/** Production days a truck arriving on `d` brings goods for (e.g. Saturday → Du, Lu, Ma). */
const covers = (d: string) => Array.from({ length: 7 }, (_, i) => addDays(d, i + 1)).filter((p) => arrivalFor(p) === d).map(wd).join(', ');

/** A line of a truck the buyer edited by hand (replaces the proposed "to order" goods of that truck). */
interface EditLine { id: string; name: string; kg: number; due?: string }
const STORE = 'achizitii-truck-edits-v1';
const loadEdits = (today: string): Record<string, EditLine[]> => {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) || '{}') as Record<string, EditLine[]>;
    return Object.fromEntries(Object.entries(all).filter(([d, l]) => d >= today && Array.isArray(l)));
  } catch { return {}; }
};

const TONE: Record<TruckDay['status'], string> = {
  full: 'border-crm-green bg-crm-green/10',
  under: 'border-crm-warning bg-crm-warning/10',
  over: 'border-destructive bg-destructive/10',
  merged: 'border-dashed border-muted-foreground/40 bg-muted/40',
  empty: 'border-dashed border-muted-foreground/40',
};
type View = TruckDay & { edited: boolean; extra: { key: string; productId: string; name: string; kg: number }[] };
const statusText = (d: View) =>
  d.status === 'full' ? 'camion complet'
  : d.status === 'under' && d.pallets < TINY ? 'prea puțin pentru un camion'
  : d.status === 'under' ? `lipsesc ${p1(d.missing)} pal`
  : d.status === 'over' ? `nu încap ${p1(d.over)} pal · al 2-lea camion`
  : d.status === 'merged' ? `fără camion · merge pe ${wd(d.mergedInto!)}`
  : 'nimic de adus';
const moveText = (m: TruckMove, day: string) => m.to === day
  ? (m.kind === 'merge' ? `+${p1(m.pallets)} pal de ${wd(m.from)} (comasat)` : `+${p1(m.pallets)} pal de ${wd(m.from)}${m.kind === 'level' ? ' (plin)' : ''}`)
  : (m.kind === 'merge' ? `totul pe ${wd(m.to)}` : `−${p1(m.pallets)} pal pe ${wd(m.to)}`);

const Block: React.FC<{ icon: React.ReactNode; title: string; hint: string; items: TruckItem[] }> = ({ icon, title, hint, items }) => {
  const list = truckLines(items);
  const total = list.reduce((s, l) => s + (l.ordered + l.toOrder) / l.per, 0);
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 font-medium">{icon}{title}<span className="ml-auto text-lg tabular-nums">{p1(total)} pal</span></div>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
        <div className="space-y-1 text-sm">{list.map((l) => (
          <div key={l.key} className="flex items-baseline gap-2 border-b last:border-0 py-0.5">
            <span className="flex-1 truncate">{l.name}{l.from.length > 0 && <span className="text-xs text-muted-foreground"> · din {l.from.map(wd).join(', ')}</span>}</span>
            {l.toOrder > 0 && <span className="tabular-nums font-medium">{kg(l.toOrder)}</span>}
            {l.ordered > 0 && <span className="text-xs text-muted-foreground tabular-nums">{kg(l.ordered)} comandat</span>}
            <span className="w-14 text-right tabular-nums text-muted-foreground">{p1((l.ordered + l.toOrder) / l.per)} pal</span>
          </div>))}</div>)}
    </div>
  );
};

/** Two weeks of daily trucks from Italy: one glance per day; on click details, manual edits, Excel and supplier orders. */
const TruckComposer: React.FC<{ rows: any[]; today: string; onOrdered?: () => void }> = ({ rows, today, onOrdered }) => {
  const [refused, setRefused] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, EditLine[]>>(() => loadEdits(today));
  const [editing, setEditing] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(edits)); } catch { /* storage full or blocked */ } }, [edits]);

  const week = useMemo(() => composeWeek(rows, today, { refused }), [rows, today, refused]);
  const kgRows = useMemo(() => rows.filter((r) => r.productId && (r.unit || 'kg').toLowerCase() === 'kg'), [rows]);
  const rowByName = useMemo(() => new Map(kgRows.map((r) => [norm(r.name), r])), [kgRows]);
  const rowByKey = useMemo(() => new Map(kgRows.map((r) => [r.key, r])), [kgRows]);

  // What each truck really carries: the proposal, or the buyer's own list for the goods still to order.
  const views: View[] = useMemo(() => week.map((d) => {
    const lines = edits[d.day];
    if (!lines) {
      const extra: View['extra'] = [];
      return { ...d, edited: false, extra };
    }
    const items: TruckItem[] = d.items.filter((i) => i.ordered);
    const extra: View['extra'] = []; const noNorm: string[] = [];
    lines.forEach((l) => {
      const r = rowByName.get(norm(l.name)); if (!r || !(l.kg > 0)) return;
      const per = palletKgFor(r.name);
      if (!per) { extra.push({ key: r.key, productId: r.productId, name: r.name, kg: l.kg }); noNorm.push(r.name); return; }
      items.push({ key: r.key, name: r.name, kg: l.kg, per, sturdy: isSturdy(r.name), ordered: false, due: l.due || addDays(d.day, 1) });
    });
    return { ...d, items, ...summarizeTruck(items), mergedInto: undefined, edited: true, extra, noNorm, movesIn: [], movesOut: [] };
  }), [week, edits, rowByName]);

  if (!rows.length || !views.length) return null;
  const sel = views.find((d) => d.day === day);
  const weeks = views.reduce<View[][]>((acc, d) => {
    const last = acc[acc.length - 1];
    if (last && isoWeekday(d.day) > isoWeekday(last[last.length - 1].day)) last.push(d); else acc.push([d]);
    return acc;
  }, []);
  const toggle = (id: string) => setRefused((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const refusedHere = sel ? [...refused].filter((id) => id.includes(sel.day)) : [];

  const setLines = (d: string, f: (l: EditLine[]) => EditLine[]) => setEdits((e) => ({ ...e, [d]: f(e[d] || []) }));
  const startEdit = (v: View) => {
    if (!edits[v.day]) {
      const lines = truckLines(v.items.filter((i) => !i.ordered)).map((l, i) => ({ id: `${l.key}-${i}`, name: l.name, kg: Math.round(l.toOrder), due: l.dues[0] }));
      setEdits((e) => ({ ...e, [v.day]: lines }));
    }
    setEditing(true);
  };
  const resetEdit = (d: string) => { setEdits((e) => { const n = { ...e }; delete n[d]; return n; }); setEditing(false); };
  const sheetOf = (v: View): TruckSheet => ({ day: v.day, covers: covers(v.day), deadline: orderDeadline(v.day), lines: truckLines(v.items),
    noNorm: [...v.noNorm, ...v.extra.map((x) => `${x.name} ${kg(x.kg)}`)], edited: v.edited });
  const orderLines = (v: View): TruckOrderLine[] => [
    ...truckLines(v.items).filter((l) => l.toOrder > 0 && rowByKey.get(l.key)).map((l) => ({ key: l.key, productId: rowByKey.get(l.key).productId, name: l.name, kg: l.toOrder })),
    ...v.extra,
  ];

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Truck className="h-5 w-5" /> Camioane — următoarele 2 săptămâni</CardTitle>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => exportTrucks(views.filter((v) => v.status !== 'merged' && v.pallets > 0).map(sheetOf), `Camioane_${today.replace(/-/g, '')}.xlsx`)}>
            <Download className="h-4 w-4 mr-1" /> Export toate camioanele
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Fiecare căsuță = ziua în care sosește camionul (marți–sâmbătă); marfa se folosește a doua zi, sâmbăta aduce pentru duminică, luni și marți. Un camion pe zi, {TRUCK_MIN}–{TRUCK_MAX} paleți. Ce nu încape se mută pe camioanele de dinainte care au loc: întâi căpățânile și radicchio, apoi salatele/aromatele pentru prima zi (doar cu o zi mai devreme). Apasă pe o zi ca să vezi, să modifici sau să comanzi.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {weeks.map((w, wi) => {
          const live = w.filter((d) => d.status !== 'merged');
          const sum = live.reduce((s, d) => s + d.pallets, 0); const cap = live.filter((d) => d.pallets > 0).length * TRUCK_MAX;
          return (
          <div key={w[0].day} className="space-y-1">
            <div className="flex flex-wrap gap-x-3 text-xs">
              <span className="font-medium text-muted-foreground">{wi === 0 ? 'Săptămâna aceasta' : wi === 1 ? 'Săptămâna viitoare' : 'Mai departe'}</span>
              <span className={cn('tabular-nums', sum > cap + 0.05 ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                {p1(sum)} pal în total · {live.filter((d) => d.pallets > 0).length} camioane duc cel mult {cap} pal{sum > cap + 0.05 ? ` · ${p1(sum - cap)} pal nu încap în câte un camion pe zi` : ''}
              </span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {w.map((d) => (
                <button key={d.day} type="button" onClick={() => { setDay(day === d.day ? null : d.day); setEditing(false); }}
                  className={cn('rounded-md border-2 p-2 text-left transition-shadow', TONE[d.status], day === d.day && 'ring-2 ring-ring')}>
                  <div className="text-xs text-muted-foreground">{dLabel(d.day)} <span className="text-[10px]">· pt. {covers(d.day)}</span></div>
                  <div className="text-2xl font-semibold tabular-nums leading-tight">{d.status === 'merged' ? '—' : p1(d.pallets)}<span className="text-xs font-normal"> pal</span></div>
                  <div className="text-xs font-medium">{statusText(d)}</div>
                  {d.edited && <div className="text-[11px] font-medium text-primary">modificat de tine</div>}
                  {[...d.movesIn, ...d.movesOut].map((m) => <div key={m.id} className="text-[11px] text-muted-foreground">{moveText(m, d.day)}</div>)}
                </button>))}
            </div>
          </div>);
        })}

        {sel && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2">
              <div className="text-sm"><b>Camion {dLabel(sel.day)}</b> · pentru {covers(sel.day)} · comanda se poate schimba până pe <b>{dLabel(orderDeadline(sel.day))}</b></div>
              <div className="ml-auto flex flex-wrap gap-2">
                {!editing && <Button size="sm" variant="outline" onClick={() => startEdit(sel)}><Pencil className="h-4 w-4 mr-1" /> Modifică</Button>}
                <Button size="sm" variant="outline" onClick={() => exportTrucks([sheetOf(sel)], `Camion_${sel.day.replace(/-/g, '')}.xlsx`)}><Download className="h-4 w-4 mr-1" /> Export Excel</Button>
                <Button size="sm" onClick={() => setOrdering(true)} disabled={orderLines(sel).length === 0}><ShoppingCart className="h-4 w-4 mr-1" /> Generează comanda</Button>
              </div>
            </div>

            {editing && edits[sel.day] ? (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Ce comanzi pentru camionul acesta</span>
                  <span className="ml-auto text-sm tabular-nums">{p1(sel.pallets)} pal · {statusText(sel)}</span>
                </div>
                {sel.items.some((i) => i.ordered) && (
                  <p className="text-xs text-muted-foreground">Deja comandat (rămâne): {truckLines(sel.items.filter((i) => i.ordered)).map((l) => `${l.name} ${kg(l.ordered)}`).join(' · ')}</p>)}
                <datalist id="truck-products">{kgRows.map((r) => <option key={r.key} value={r.name} />)}</datalist>
                <div className="divide-y">
                  {edits[sel.day].map((l) => {
                    const r = rowByName.get(norm(l.name)); const per = r ? palletKgFor(r.name) : null;
                    return (
                      <div key={l.id} className="flex flex-wrap items-center gap-2 py-1.5">
                        <div className="flex-1 min-w-[160px]">
                          <Input list="truck-products" value={l.name} placeholder="Alege produsul…" aria-label="Produs"
                            onChange={(e) => setLines(sel.day, (ls) => ls.map((x) => x.id === l.id ? { ...x, name: e.target.value } : x))} />
                          {l.name && !r && <span className="text-[11px] text-destructive">produs necunoscut în forecast</span>}
                        </div>
                        <Input type="number" min={0} className="w-24 text-right" value={l.kg || ''} aria-label={`Kg ${l.name}`}
                          onChange={(e) => setLines(sel.day, (ls) => ls.map((x) => x.id === l.id ? { ...x, kg: Number(e.target.value) || 0 } : x))} />
                        <span className="text-sm text-muted-foreground">kg</span>
                        <span className="w-20 text-right text-sm tabular-nums text-muted-foreground">{per ? `${p1(l.kg / per)} pal` : r ? 'fără normă' : '—'}</span>
                        <Button size="icon" variant="ghost" aria-label={`Scoate ${l.name}`} onClick={() => setLines(sel.day, (ls) => ls.filter((x) => x.id !== l.id))}><Trash2 className="h-4 w-4" /></Button>
                      </div>);
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setLines(sel.day, (ls) => [...ls, { id: `new-${Date.now()}`, name: '', kg: 0 }])}><Plus className="h-4 w-4 mr-1" /> Adaugă produs</Button>
                  <Button size="sm" variant="ghost" onClick={() => resetEdit(sel.day)}><RotateCcw className="h-4 w-4 mr-1" /> Revino la propunere</Button>
                  <Button size="sm" className="ml-auto" onClick={() => setEditing(false)}><Check className="h-4 w-4 mr-1" /> Gata</Button>
                </div>
                <p className="text-xs text-muted-foreground">Ca să înlocuiești un produs, scrie alt nume pe rândul lui. Modificările rămân salvate pe acest calculator până generezi comanda; tabelul de jos arată în continuare calculul, iar după ce comanda e salvată o vede și el.</p>
              </div>
            ) : sel.status !== 'merged' && (
              <div className="grid gap-3 md:grid-cols-2">
                <Block icon={<Leaf className="h-4 w-4" />} title="Perisabile" hint="Salate, frunze, aromate — vin cu camionul dinaintea zilei de producție (cel mult cu o zi mai devreme când camionul ei e plin)." items={sel.items.filter((i) => !i.sturdy)} />
                <Block icon={<Package className="h-4 w-4" />} title="Rezistente" hint="Căpățâni și radicchio — pot veni cu câteva zile mai devreme ca să umple camioanele." items={sel.items.filter((i) => i.sturdy)} />
              </div>)}

            {!sel.edited && (sel.movesIn.length > 0 || sel.movesOut.length > 0 || refusedHere.length > 0) && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium"><ArrowRightLeft className="h-4 w-4" /> Mutări propuse</div>
                {[...sel.movesIn, ...sel.movesOut].map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1">{m.kind === 'merge' ? `Comanda de ${dLabel(m.from)} vine pe camionul de ${dLabel(m.to)}` : `${p1(m.pallets)} pal (${kg(m.kg)}) ${m.names.join(', ')} vin ${dLabel(m.to)} în loc de ${dLabel(m.from)}${m.kind === 'level' ? ` (camionul de ${wd(m.from)} era plin)` : ''}`}</span>
                    <Button size="sm" variant="outline" onClick={() => toggle(m.id)}>Nu muta</Button>
                  </div>))}
                {refusedHere.map((id) => (
                  <div key={id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex-1">Mutare refuzată ({id.split(':')[1].split('>').map(wd).join(' → ')})</span>
                    <Button size="sm" variant="ghost" onClick={() => toggle(id)}>Mută totuși</Button>
                  </div>))}
              </div>)}
            {!editing && sel.status === 'over' && (
              <p className="text-sm rounded-md border border-destructive bg-destructive/10 p-2">Nici după mutarea pe camioanele de dinainte nu încap {p1(sel.over)} paleți. Apasă „Modifică” ca să tai sau să înlocuiești din marfă, altfel trebuie al doilea camion.</p>)}
            {!editing && sel.status === 'under' && sel.pallets < TINY && (
              <p className="text-sm rounded-md border border-crm-warning bg-crm-warning/10 p-2">Ziua aceasta are doar {p1(sel.pallets)} paleți și nu încape pe camionul din ziua dinainte (acela e deja plin cu marfă comandată). Adaug-o la comanda din ziua dinainte dacă furnizorul mai poate încărca, altfel pleacă un camion aproape gol.</p>)}
            {sel.status === 'merged' && !editing && (
              <div className="flex flex-wrap items-center gap-2 text-sm rounded-md border p-3">
                <span className="flex-1">Ziua aceasta are sub 3 paleți, așa că vine pe camionul de {dLabel(sel.mergedInto!)}.</span>
                <Button size="sm" variant="outline" onClick={() => toggle(`merge:${sel.day}>${sel.mergedInto}`)}>Nu comasa</Button>
              </div>)}
            {sel.noNorm.length > 0 && <p className="text-xs text-muted-foreground">Fără normă de palet (nu intră în paleți): {sel.noNorm.join(', ')}</p>}
            <TruckOrderDialog open={ordering} onOpenChange={setOrdering} day={sel.day} dayLabel={dLabel(sel.day)} lines={ordering ? orderLines(sel) : []}
              onCreated={() => { resetEdit(sel.day); onOrdered?.(); }} />
          </div>)}
      </CardContent>
    </Card>
  );
};
export default TruckComposer;
