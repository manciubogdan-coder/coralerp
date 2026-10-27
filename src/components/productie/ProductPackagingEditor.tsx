import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { argusFetch } from '@/lib/argusApi';
import { useOrderPackaging } from '@/hooks/productie/useOrderPackaging';
import { packagingUnits, type StorePackaging } from '../../../supabase/functions/_shared/packagingRules';

export default function ProductPackagingEditor({ productId }: { productId: string }) {
  const { data, isPending, isError } = useOrderPackaging();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [store, setStore] = useState('');
  const [units, setUnits] = useState('');
  const { data: stores = [] } = useQuery({ queryKey: ['packaging-store-options'], queryFn: async () => {
    const all: string[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.from('productie_clienti').select('nume_magazin').order('id').range(offset, offset + 999);
      if (error) throw error;
      all.push(...(data ?? []).map(r => String(r.nume_magazin)));
      if (!data || data.length < 1000) break;
      offset += 1000;
    }
    return [...new Set(all)].sort();
  } });
  const refresh = () => cache.invalidateQueries({ queryKey: ['senior-store-packaging'] });
  const sync = async () => {
    setBusy(true);
    try {
      const result = await argusFetch<{ count: number }>('packaging_senior_sync', {}, { produs_id: productId });
      await refresh();
      toast.success(result.count ? `Baxarea Senior a fost actualizată pentru ${result.count} magazine.` : 'Senior nu are o baxare explicită pentru acest produs în documentele verificate.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Senior nu a răspuns.'); }
    finally { setBusy(false); }
  };
  const save = async (magazin: string, value: string | null) => {
    if (value !== null && !packagingUnits(value)) { toast.error('Introdu bucăți/bax, de exemplu 4, 6, 12 sau 6+2.'); return; }
    setBusy(true);
    try {
      await argusFetch('packaging_store_save', {}, { produs_id: productId, magazin, units: value });
      await refresh(); setUnits('');
      toast.success('Baxarea a fost salvată.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Baxarea nu a putut fi salvată.'); }
    finally { setBusy(false); }
  };
  const rows = (data ?? []).filter(r => r.produs_id === productId);
  return <section className="space-y-3 border-t pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">Baxare pe magazin</h3><Button type="button" variant="outline" size="sm" onClick={sync} disabled={busy}><RefreshCw className={busy ? 'animate-spin' : ''} />Actualizează din Senior</Button></div>
    {isPending ? <p className="text-sm text-muted-foreground">Se încarcă…</p> : isError ? <p className="text-sm text-destructive">Baxarea nu s-a putut încărca.</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nicio baxare disponibilă.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-left text-muted-foreground"><tr><th className="py-2">Magazin</th><th>Senior (buc/bax)</th><th>Baxare folosită</th><th /></tr></thead><tbody>{rows.map(row => <PackagingRow key={row.magazin_key} row={row} busy={busy} save={save} />)}</tbody></table></div>}
    <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <div className="space-y-2"><Label>Magazin</Label><Select value={store} onValueChange={setStore}><SelectTrigger><SelectValue placeholder="Alege magazinul" /></SelectTrigger><SelectContent className="max-h-72 overflow-y-auto">{[...new Set([...stores, ...rows.map(r => r.magazin)])].map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="new-case-units">Bucăți / bax</Label><Input id="new-case-units" value={units} onChange={e => setUnits(e.target.value)} inputMode="numeric" /></div>
      <Button type="button" variant="outline" disabled={busy || !store || !units} onClick={() => save(store, units)}><Save />Salvează baxarea</Button>
    </div>
  </section>;
}

function PackagingRow({ row, busy, save }: { row: StorePackaging; busy: boolean; save: (store: string, value: string | null) => Promise<void> }) {
  const current = row.manual_units ?? row.senior_units ?? '';
  const [draft, setDraft] = useState(current);
  return <tr className="border-t"><td className="py-2 pr-3">{row.magazin}</td><td className="pr-3">{row.senior_units ?? 'Nespecificată'}{row.senior_date && <div className="text-xs text-muted-foreground">{row.senior_date}</div>}</td><td className="py-2"><Input aria-label={`Bucăți pe bax ${row.magazin}`} className="w-28" value={draft} onChange={e => setDraft(e.target.value)} />{row.manual_units && <span className="text-xs text-muted-foreground">Corecție manuală</span>}</td><td className="whitespace-nowrap text-right"><Button type="button" variant="ghost" size="icon" title="Salvează baxarea" disabled={busy || draft === current} onClick={() => save(row.magazin, draft)}><Save /></Button>{row.manual_units && <Button type="button" variant="ghost" size="icon" title="Revino la baxarea Senior" disabled={busy} onClick={async () => { await save(row.magazin, null); setDraft(row.senior_units ?? ''); }}><Undo2 /></Button>}</td></tr>;
}