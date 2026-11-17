import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck, Leaf, Package, ArrowRightLeft } from 'lucide-react';
import { composeWeek, TRUCK_MAX, TRUCK_MIN, type TruckDay, type TruckItem, type TruckMove } from '@/lib/achizitii/truckBuilder';
import { isoWeekday } from '@/lib/achizitii/truckRadar';
import { cn } from '@/lib/utils';

const WD = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
const p1 = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const kg = (n: number) => `${Math.round(n).toLocaleString('ro-RO')} kg`;
const wd = (d: string) => WD[isoWeekday(d) - 1];
const dLabel = (d: string) => `${wd(d)} ${d.slice(8, 10)}.${d.slice(5, 7)}`;

const TONE: Record<TruckDay['status'], string> = {
  full: 'border-crm-green bg-crm-green/10',
  under: 'border-crm-warning bg-crm-warning/10',
  over: 'border-destructive bg-destructive/10',
  merged: 'border-dashed border-muted-foreground/40 bg-muted/40',
  empty: 'border-dashed border-muted-foreground/40',
};
const statusText = (d: TruckDay) =>
  d.status === 'full' ? 'camion complet'
  : d.status === 'under' ? `lipsesc ${p1(d.missing)} pal`
  : d.status === 'over' ? `${d.trucks} camioane · +${p1(d.over)} pal`
  : d.status === 'merged' ? `fără camion · merge pe ${wd(d.mergedInto!)}`
  : 'nimic de adus';
const moveText = (m: TruckMove, day: string) => m.to === day
  ? (m.kind === 'merge' ? `+${p1(m.pallets)} pal de ${wd(m.from)} (comasat)` : `+${p1(m.pallets)} pal rezistente de ${wd(m.from)}`)
  : (m.kind === 'merge' ? `totul pe ${wd(m.to)}` : `−${p1(m.pallets)} pal rezistente pe ${wd(m.to)}`);

/** One row per product: already ordered + still to order, pallets. */
function byProduct(items: TruckItem[]) {
  const m = new Map<string, { name: string; ordered: number; toOrder: number; pallets: number; from: Set<string> }>();
  items.forEach((i) => {
    const e = m.get(i.key) ?? { name: i.name, ordered: 0, toOrder: 0, pallets: 0, from: new Set<string>() };
    if (i.ordered) e.ordered += i.kg; else e.toOrder += i.kg;
    e.pallets += i.kg / i.per; if (i.movedFrom) e.from.add(i.movedFrom);
    m.set(i.key, e);
  });
  return [...m.values()].sort((a, b) => b.pallets - a.pallets);
}

const Block: React.FC<{ icon: React.ReactNode; title: string; hint: string; items: TruckItem[] }> = ({ icon, title, hint, items }) => {
  const list = byProduct(items);
  const total = list.reduce((s, l) => s + l.pallets, 0);
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 font-medium">{icon}{title}<span className="ml-auto text-lg tabular-nums">{p1(total)} pal</span></div>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
        <div className="space-y-1 text-sm">{list.map((l) => (
          <div key={l.name} className="flex items-baseline gap-2 border-b last:border-0 py-0.5">
            <span className="flex-1 truncate">{l.name}{l.from.size > 0 && <span className="text-xs text-muted-foreground"> · din {[...l.from].map(wd).join(', ')}</span>}</span>
            {l.toOrder > 0 && <span className="tabular-nums font-medium">{kg(l.toOrder)}</span>}
            {l.ordered > 0 && <span className="text-xs text-muted-foreground tabular-nums">{kg(l.ordered)} comandat</span>}
            <span className="w-14 text-right tabular-nums text-muted-foreground">{p1(l.pallets)} pal</span>
          </div>))}</div>)}
    </div>
  );
};

/** Week of daily trucks from Italy: one glance per day, details and move suggestions on click. */
const TruckComposer: React.FC<{ rows: any[]; today: string }> = ({ rows, today }) => {
  const [refused, setRefused] = useState<Set<string>>(new Set());
  const week = useMemo(() => composeWeek(rows, today, { refused }), [rows, today, refused]);
  const [day, setDay] = useState<string | null>(null);
  if (!rows.length || !week.length) return null;
  const sel = week.find((d) => d.day === day);
  const toggle = (id: string) => setRefused((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const refusedHere = sel ? [...refused].filter((id) => id.includes(sel.day)) : [];

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Truck className="h-5 w-5" /> Camioane săptămâna aceasta</CardTitle>
        <p className="text-xs text-muted-foreground">Un camion pe zi, {TRUCK_MIN}–{TRUCK_MAX} paleți. Salatele și aromatele vin în ziua în care trebuie. Doar căpățânile și radicchio se mută cu 1–2 zile ca să umple camionul. Apasă pe o zi ca să vezi ce comanzi.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {week.map((d) => (
            <button key={d.day} type="button" onClick={() => setDay(day === d.day ? null : d.day)}
              className={cn('rounded-md border-2 p-2 text-left transition-shadow', TONE[d.status], day === d.day && 'ring-2 ring-ring')}>
              <div className="text-xs text-muted-foreground">{dLabel(d.day)}</div>
              <div className="text-2xl font-semibold tabular-nums leading-tight">{d.status === 'merged' ? '—' : p1(d.pallets)}<span className="text-xs font-normal"> pal</span></div>
              <div className="text-xs font-medium">{statusText(d)}</div>
              {[...d.movesIn, ...d.movesOut].map((m) => <div key={m.id} className="text-[11px] text-muted-foreground">{moveText(m, d.day)}</div>)}
            </button>))}
        </div>

        {sel && sel.status !== 'merged' && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Block icon={<Leaf className="h-4 w-4" />} title="Perisabile" hint="Salate, frunze, aromate — vin doar în ziua în care trebuie." items={sel.items.filter((i) => !i.sturdy)} />
              <Block icon={<Package className="h-4 w-4" />} title="Rezistente" hint="Căpățâni și radicchio — pot veni cu 1–2 zile mai devreme." items={sel.items.filter((i) => i.sturdy)} />
            </div>
            {(sel.movesIn.length > 0 || sel.movesOut.length > 0 || refusedHere.length > 0) && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium"><ArrowRightLeft className="h-4 w-4" /> Mutări propuse</div>
                {[...sel.movesIn, ...sel.movesOut].map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1">{m.kind === 'merge' ? `Comanda de ${dLabel(m.from)} vine pe camionul de ${dLabel(m.to)}` : `${p1(m.pallets)} pal (${kg(m.kg)}) ${m.names.join(', ')} vin ${dLabel(m.to)} în loc de ${dLabel(m.from)}`}</span>
                    <Button size="sm" variant="outline" onClick={() => toggle(m.id)}>Nu muta</Button>
                  </div>))}
                {refusedHere.map((id) => (
                  <div key={id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex-1">Mutare refuzată ({id.split(':')[1].split('>').map(wd).join(' → ')})</span>
                    <Button size="sm" variant="ghost" onClick={() => toggle(id)}>Mută totuși</Button>
                  </div>))}
              </div>)}
            {sel.noNorm.length > 0 && <p className="text-xs text-muted-foreground">Fără normă de palet (nu intră în paleți): {sel.noNorm.join(', ')}</p>}
          </div>)}
        {sel?.status === 'merged' && (
          <div className="flex flex-wrap items-center gap-2 text-sm rounded-md border p-3">
            <span className="flex-1">Ziua aceasta are sub 3 paleți, așa că vine pe camionul de {dLabel(sel.mergedInto!)}.</span>
            <Button size="sm" variant="outline" onClick={() => toggle(`merge:${sel.day}>${sel.mergedInto}`)}>Nu comasa</Button>
          </div>)}
      </CardContent>
    </Card>
  );
};
export default TruckComposer;
