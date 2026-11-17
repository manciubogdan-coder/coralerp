import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck } from 'lucide-react';
import { composeTrucks, TRUCK_MAX, TRUCK_MIN } from '@/lib/achizitii/truckBuilder';
import { isoWeekday } from '@/lib/achizitii/truckRadar';

const WD = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
const fmt = (n: number, d = 1) => n.toLocaleString('ro-RO', { maximumFractionDigits: d });
const dLabel = (d: string) => `${WD[isoWeekday(d) - 1]} ${d.slice(8, 10)}.${d.slice(5, 7)}`;

/** Per delivery day: pallets to order, truck count, and sturdy goods to pull forward to reach the minimum. */
const TruckComposer: React.FC<{ rows: any[]; today: string }> = ({ rows, today }) => {
  const days = useMemo(() => composeTrucks(rows, today, 7, 3, TRUCK_MIN, TRUCK_MAX, (d) => isoWeekday(d) !== 7), [rows, today]);
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return null;
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Truck className="h-5 w-5" /> Compunere camion</CardTitle>
        <p className="text-xs text-muted-foreground">Camion între {TRUCK_MIN} și {TRUCK_MAX} paleți. Paleți: frunze/aromate 220 kg, căpățâni 400, radicchio 500. Pentru completare se trag din următoarele 3 zile doar produse rezistente, nu salatele de frunze.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {days.map((d) => {
          const tone = d.pallets === 0 ? 'outline' : d.missing > 0 ? 'destructive' : d.trucks > 1 ? 'secondary' : 'default';
          return (
            <div key={d.day} className="border rounded-md p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold w-20">{dLabel(d.day)}</span>
                <Badge variant={tone as any}>{fmt(d.pallets)} paleți</Badge>
                <span className="text-sm text-muted-foreground">deja comandat {fmt(d.orderedPallets)} · de comandat {fmt(d.pallets - d.orderedPallets)}</span>
                {d.trucks > 1 && <Badge variant="secondary">{d.trucks} camioane</Badge>}
                {d.missing > 0 && <span className="text-sm text-destructive">lipsesc {fmt(d.missing)} paleți până la {TRUCK_MIN}</span>}
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(open === d.day ? null : d.day)}>{open === d.day ? 'Ascunde' : 'Detalii'}</Button>
              </div>
              {open === d.day && (
                <div className="grid md:grid-cols-2 gap-3 mt-2 text-sm">
                  <div><p className="font-medium mb-1">De comandat pentru ziua aceasta</p>
                    {d.items.length ? d.items.map((i) => <div key={i.key} className="flex justify-between gap-2"><span>{i.name}{!i.sturdy && <span className="text-muted-foreground"> · perisabil</span>}</span><span className="tabular-nums">{fmt(i.kg, 0)} kg · {fmt(i.pallets)} pal</span></div>) : <p className="text-muted-foreground">Nimic în plus față de ce e comandat.</p>}
                    {d.noNorm.length > 0 && <p className="text-xs text-muted-foreground mt-1">Fără normă kg/palet (necontate): {d.noNorm.join(', ')}</p>}
                  </div>
                  <div><p className="font-medium mb-1">Completare din zilele următoare (rezistente)</p>
                    {d.missing <= 0 ? <p className="text-muted-foreground">Camionul e plin, nu e nevoie.</p>
                      : d.pullForward.length ? d.pullForward.map((i, k) => <div key={k} className="flex justify-between gap-2"><span>{i.name} <span className="text-muted-foreground">din {dLabel(i.fromDay!)}</span></span><span className="tabular-nums">{fmt(i.kg, 0)} kg · {fmt(i.pallets)} pal</span></div>)
                      : <p className="text-muted-foreground">Nu există produse rezistente de adus în avans.</p>}
                    {d.missing > 0 && d.pullForward.reduce((s, i) => s + i.pallets, 0) < d.missing - 0.01 && <p className="text-xs text-destructive mt-1">Nici cu avansul camionul nu ajunge la {TRUCK_MIN} paleți.</p>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
export default TruckComposer;
