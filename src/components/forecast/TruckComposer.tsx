import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Truck } from 'lucide-react';
import { composeTrucks, dailyOrders, TRUCK_MAX, TRUCK_MIN } from '@/lib/achizitii/truckBuilder';
import { addDays, isoWeekday } from '@/lib/achizitii/truckRadar';
import { palletKgFor } from '@/lib/forecastGroups';
import { isLeafSalad } from '@/lib/leafStockAge';
import { cn } from '@/lib/utils';

const WD = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
const fmt = (n: number, d = 1) => n.toLocaleString('ro-RO', { maximumFractionDigits: d });
const dLabel = (d: string) => `${WD[isoWeekday(d) - 1]} ${d.slice(8, 10)}.${d.slice(5, 7)}`;
const LOOK = 6;

interface Line { key: string; name: string; per: number; sturdy: boolean; due: string; need: number; urgent: boolean }

/** On demand: pick a delivery day; the truck starts with that day's need, then you add future needs (suggested) up to 22–26 pallets. */
const TruckComposer: React.FC<{ rows: any[]; today: string }> = ({ rows, today }) => {
  const summary = useMemo(() => composeTrucks(rows, today, 7, 3, TRUCK_MIN, TRUCK_MAX, (d) => isoWeekday(d) !== 7), [rows, today]);
  const [day, setDay] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});

  const lines = useMemo<Line[]>(() => {
    if (!day) return [];
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
    const k = days.indexOf(day);
    const out: Line[] = [];
    rows.filter((r) => r.productId && (r.unit || 'kg').toLowerCase() === 'kg').forEach((r) => {
      const per = palletKgFor(r.name); if (!per) return;
      const plan = dailyOrders(r, days, today);
      for (let j = k; j <= k + LOOK && j < days.length; j++) {
        if (plan[j] > 0) out.push({ key: `${r.key}|${days[j]}`, name: r.name, per, sturdy: !isLeafSalad(r.name), due: days[j], need: plan[j], urgent: j === k });
      }
    });
    return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || Number(b.sturdy) - Number(a.sturdy) || a.due.localeCompare(b.due));
  }, [rows, today, day]);

  // Suggestion: everything needed that day, then sturdy future needs (earliest first) until the minimum.
  useEffect(() => {
    const q: Record<string, number> = {}; let pal = 0;
    lines.filter((l) => l.urgent).forEach((l) => { q[l.key] = l.need; pal += l.need / l.per; });
    lines.filter((l) => !l.urgent && l.sturdy).forEach((l) => {
      if (pal >= TRUCK_MIN - 1e-9) return;
      const take = Math.min(l.need, (TRUCK_MIN - pal) * l.per); q[l.key] = Math.round(take); pal += take / l.per;
    });
    setQty(q);
  }, [lines]);

  if (!rows.length) return null;
  const ordered = summary.find((s) => s.day === day)?.orderedPallets || 0;
  const pallets = ordered + lines.reduce((s, l) => s + (qty[l.key] || 0) / l.per, 0);
  const ok = pallets >= TRUCK_MIN - 1e-9 && pallets <= TRUCK_MAX + 1e-9;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Truck className="h-5 w-5" /> Compunere camion</CardTitle>
        <p className="text-xs text-muted-foreground">Alege ziua în care vine camionul. Pornește cu ce îți trebuie în ziua aceea, apoi adaugi din ce îți va trebui în următoarele {LOOK} zile până ajungi la {TRUCK_MIN}–{TRUCK_MAX} paleți. Sugestia ia întâi marfa rezistentă; frunzele le adaugi doar dacă vrei.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">{summary.map((s) => (
          <Button key={s.day} size="sm" variant={day === s.day ? 'default' : 'outline'} onClick={() => setDay(day === s.day ? null : s.day)}>
            {dLabel(s.day)} · {fmt(s.pallets)} pal</Button>))}</div>
        {day && <>
          <div className={cn('rounded-md border p-2 flex flex-wrap items-center gap-2', ok ? 'border-primary' : 'border-destructive')}>
            <Badge variant={ok ? 'default' : 'destructive'}>{fmt(pallets)} paleți</Badge>
            <span className="text-sm">deja comandat {fmt(ordered)} pal · {pallets < TRUCK_MIN ? `lipsesc ${fmt(TRUCK_MIN - pallets)} până la ${TRUCK_MIN}` : pallets > TRUCK_MAX ? `${fmt(pallets - TRUCK_MAX)} peste ${TRUCK_MAX} (al doilea camion)` : 'camion complet'}</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setQty(Object.fromEntries(lines.filter((l) => l.urgent).map((l) => [l.key, l.need])))}>Doar necesarul zilei</Button>
          </div>
          {lines.length === 0 ? <p className="text-sm text-muted-foreground">Nu ai necesar nici în ziua aceasta, nici în următoarele {LOOK} zile.</p> : (
            <div className="space-y-1 text-sm">{lines.map((l) => (
              <div key={l.key} className={cn('flex flex-wrap items-center gap-2 border-b py-1', l.urgent && 'font-medium')}>
                <span className="flex-1 min-w-[160px]">{l.name} <span className="text-xs text-muted-foreground">
                  {l.urgent ? 'necesar ziua aleasă' : `necesar ${dLabel(l.due)}`}{!l.sturdy && ' · perisabil'}</span></span>
                <span className="text-xs text-muted-foreground tabular-nums">trebuie {fmt(l.need, 0)} kg</span>
                <Input type="number" min={0} className="w-24 h-8" value={qty[l.key] ?? 0}
                  onChange={(e) => setQty({ ...qty, [l.key]: Math.max(0, Number(e.target.value) || 0) })} />
                <span className="w-16 text-right tabular-nums">{fmt((qty[l.key] || 0) / l.per)} pal</span>
              </div>))}</div>)}
        </>}
      </CardContent>
    </Card>
  );
};
export default TruckComposer;
