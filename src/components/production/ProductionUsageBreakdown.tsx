import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadProductionUsage } from '@/lib/productionUsage';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ProductionUsageBreakdown({ from, to }: { from: string; to: string }) {
  const [details, setDetails] = useState(false);
  const { data = [], isLoading, error } = useQuery({ queryKey: ['production-usage-days', from, to],
    queryFn: () => loadProductionUsage(from, to), staleTime: 60000 });
  const grouped = new Map<string, { name: string; total: number; other: number; advance: number; unknown: number }>();
  data.forEach(d => {
    const g = grouped.get(d.key) || { name: d.name, total: 0, other: 0, advance: 0, unknown: 0 };
    g.total += d.quantity; if (d.otherDay) g.other += d.quantity;
    if (d.advance) g.advance += d.quantity; if (!d.targetDay) g.unknown += d.quantity;
    grouped.set(d.key, g);
  });
  const exportData = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...grouped.values()].map(g => ({ Ingredient: g.name,
      'Consum estimat sesiuni (kg)': g.total, 'Din care alte zile (kg)': g.other,
      'Din care avans (kg)': g.advance, 'Fără zi comandă (kg)': g.unknown }))), 'Sinteză');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.map(d => ({ 'Zi lucrată': d.day,
      'Zi comandă': d.targetDay || 'Necunoscută', Ingredient: d.name, Produs: d.product, Client: d.client,
      'Comandă ID': d.orderId, 'Consum estimat (kg)': d.quantity, Avans: d.advance ? 'Da' : 'Nu',
      'Altă zi': d.otherDay ? 'Da' : 'Nu' }))), 'Sesiuni');
    XLSX.writeFile(wb, `ConsumSesiuni_${from}_${to}.xlsx`);
  };
  const fmt = (q: number) => q.toLocaleString('ro-RO', { maximumFractionDigits: 2 });
  return <section className="space-y-3 border-t pt-4">
    <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">Consum după ziua lucrată</h3>
      <Button variant="outline" size="sm" onClick={() => setDetails(!details)}>{details ? 'Sinteză' : 'Detalii comenzi'}</Button>
      <Button variant="outline" size="sm" onClick={exportData} disabled={!data.length}><FileDown className="mr-2 h-4 w-4" />Excel</Button></div>
    <p className="text-xs text-muted-foreground">Cantități produse în sesiuni × rețetă; estimare de ingrediente, nu consum cântărit. „Alte zile” și „Avans” se pot suprapune. Sesiunile fără rețetă nu pot fi cuantificate.</p>
    {isLoading ? <p>Se încarcă sesiunile…</p> : error ? <p className="text-destructive">Sesiunile nu au putut fi citite.</p> : !data.length ? <p className="text-muted-foreground">Nu există sesiuni finalizate cu ingrediente în perioada aleasă.</p> :
      <div className="overflow-auto max-h-[50vh]"><table className="w-full text-sm"><thead className="bg-background">
        <tr>{(details ? ['Zi lucrată', 'Zi comandă', 'Ingredient', 'Produs / client', 'Consum estimat (kg)', 'Tip'] :
          ['Ingredient', 'Consum estimat (kg)', 'Din care alte zile (kg)', 'Din care avans (kg)', 'Fără zi comandă (kg)']).map(h => <th key={h} className="p-2 text-left whitespace-nowrap">{h}</th>)}</tr>
      </thead><tbody>{details ? data.map((d, i) => <tr key={i} className="border-b"><td className="p-2">{d.day}</td><td className="p-2">{d.targetDay || 'Necunoscută'}</td><td className="p-2">{d.name}</td><td className="p-2">{d.product} / {d.client}</td><td className="p-2">{fmt(d.quantity)}</td><td className="p-2">{[d.advance && 'Avans', d.otherDay && 'Altă zi'].filter(Boolean).join(' · ') || 'Aceeași zi'}</td></tr>) :
        [...grouped.values()].map(g => <tr key={g.name} className="border-b"><td className="p-2">{g.name}</td>{[g.total, g.other, g.advance, g.unknown].map((q, i) => <td key={i} className="p-2 tabular-nums">{fmt(q)}</td>)}</tr>)}</tbody></table></div>}
  </section>;
}