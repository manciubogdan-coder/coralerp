import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { ClipboardCheck, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGrupareAmbalare } from '@/hooks/productie/useGrupareAmbalare';
import { buildCount, countUnits, type CountRow } from '@/lib/productie/manualStocktake';
import { readCurrentStock, replaceManualStock } from '@/lib/productie/replaceManualStock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const blank = (productId: string): CountRow => ({ id: crypto.randomUUID(), productId, units: '', cases: '' });
export default function ManualStocktakeDialog() {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<CountRow[]>([]);
  const [search, setSearch] = useState(''), [day, setDay] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<{ stock: Awaited<ReturnType<typeof readCurrentStock>>; payload: ReturnType<typeof buildCount> } | null>(null);
  const initialized = useRef(false), locked = useRef(false);
  const client = useQueryClient();
  const groups = useGrupareAmbalare();
  const products = useQuery({ queryKey: ['stocktake-products'], enabled: open, queryFn: async () => {
    const result: { id: string; nume: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('productie_produse').select('id, nume').order('id').range(from, from + 999);
      if (error) throw error;
      result.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return result;
  } });
  const catalog = new Map<string, { id: string; name: string }>();
  for (const product of products.data || []) {
    const name = groups.data?.[product.id] || product.nume;
    const key = groups.data?.[product.id] ? `group:${name}` : `product:${product.id}`;
    if (!catalog.has(key)) catalog.set(key, { id: product.id, name });
  }
  const options = Array.from(catalog.values()).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  if (open && !initialized.current && products.isSuccess && groups.isSuccess) {
    initialized.current = true;
    setRows(options.map(option => blank(option.id)));
  }
  const names = new Map(options.map(option => [option.id, option.name]));
  const total = rows.reduce((sum, row) => { try { return sum + countUnits(row); } catch { return sum; } }, 0);
  const update = (id: string, patch: Partial<CountRow>) => setRows(previous => previous.map(row => row.id === id ? { ...row, ...patch } : row));
  const prepare = async () => {
    if (locked.current) return; locked.current = true; setSaving(true);
    try { setConfirmation({ payload: buildCount(rows, new Set(names.keys()), day), stock: await readCurrentStock() }); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Verificarea a eșuat.'); }
    finally { locked.current = false; setSaving(false); }
  };
  const save = async () => {
    if (!confirmation || locked.current) return; locked.current = true; setSaving(true);
    try {
      await replaceManualStock(confirmation.stock, confirmation.payload);
      toast.success(`Restoc înlocuit: ${total} bucăți.`); setConfirmation(null); setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Salvarea a eșuat.'); setConfirmation(null); }
    finally {
      await client.invalidateQueries({ predicate: query => /pool|restoc|restock|picking/.test(String(query.queryKey[0])) });
      locked.current = false; setSaving(false);
    }
  };
  return <>
    <Button size="sm" variant="outline" onClick={() => { initialized.current = false; setRows([]); setSearch(''); setConfirmation(null); setDay(formatInTimeZone(new Date(), 'Europe/Bucharest', 'yyyy-MM-dd')); setOpen(true); }}><ClipboardCheck className="h-4 w-4" />Reglează restocul</Button>
    <Dialog open={open} onOpenChange={value => { if (!locked.current) setOpen(value); }}>
      <DialogContent className="max-w-5xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0"><DialogTitle>Inventar manual restoc</DialogTitle><DialogDescription>Stocul disponibil va fi înlocuit integral cu cantitățile confirmate. Grupele necompletate vor avea stoc zero. Istoricul și comenzile rămân păstrate.</DialogDescription></DialogHeader>
        {confirmation ? <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          <div className="border border-destructive rounded-md p-4"><strong>Înlocuiești tot restocul disponibil?</strong><p>{confirmation.stock.length} loturi existente · {confirmation.stock.reduce((sum, lot) => sum + Number(lot.cantitate_surplus), 0)} buc vor fi scoase din stoc.</p><p>Noul stoc: {total} buc · {confirmation.payload.length} grupe · {day}.</p></div>
          {confirmation.payload.map(row => <div key={row.produs_id} className="flex justify-between border-b py-2 gap-3"><span>{names.get(row.produs_id)}</span><strong>{row.cantitate_surplus} buc</strong></div>)}
        </div> : <>
          <div className="flex flex-wrap gap-3 shrink-0"><Input aria-label="Caută grupă" placeholder="Caută grupă..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-40" /><div><Label htmlFor="stocktake-day">Data producției</Label><Input id="stocktake-day" type="date" value={day} onChange={e => setDay(e.target.value)} /></div><Button variant="outline" disabled={saving || !options.length} onClick={() => { setSearch(''); setRows(previous => [...previous, blank('')]); }}><Plus className="h-4 w-4" />Adaugă rând</Button></div>
          <div className="flex-1 min-h-0 overflow-y-auto divide-y">
            {(products.isLoading || groups.isLoading) && <p className="py-4">Se încarcă grupele...</p>}
            {(products.isError || groups.isError) && <Button variant="outline" onClick={() => { products.refetch(); groups.refetch(); }}>Reîncearcă încărcarea</Button>}
            {rows.filter(row => !search || (names.get(row.productId) || '').toLocaleLowerCase('ro').includes(search.toLocaleLowerCase('ro'))).map(row => {
              let quantity = 0; try { quantity = countUnits(row); } catch { /* Incomplete row. */ }
              return <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_100px_100px_80px_80px] gap-2 py-3 items-end">
                <div><Label>Grupă / produs</Label><Select value={row.productId} disabled={saving} onValueChange={id => update(row.id, { productId: id })}><SelectTrigger aria-label="Grupă / produs"><SelectValue placeholder="Alege grupa" /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Buc/bax</Label><Input aria-label={`Buc/bax ${names.get(row.productId) || 'rând nou'}`} type="number" min="1" step="1" disabled={saving} value={row.units} onChange={e => update(row.id, { units: e.target.value })} /></div>
                <div><Label>Baxuri</Label><Input aria-label={`Baxuri ${names.get(row.productId) || 'rând nou'}`} type="number" min="0" step="1" disabled={saving} value={row.cases} onChange={e => update(row.id, { cases: e.target.value })} /></div>
                <strong className="pb-2">{quantity} buc</strong><div className="flex gap-1"><Button title="Altă baxare, aceeași grupă" aria-label="Altă baxare" size="icon" variant="ghost" disabled={saving} onClick={() => setRows(previous => { const next = [...previous]; next.splice(next.findIndex(item => item.id === row.id) + 1, 0, blank(row.productId)); return next; })}><Plus className="h-4 w-4" /></Button><Button title="Elimină rând" aria-label="Elimină rând" size="icon" variant="ghost" disabled={saving} onClick={() => setRows(previous => previous.filter(item => item.id !== row.id))}><Trash2 className="h-4 w-4" /></Button></div>
              </div>;
            })}
          </div>
        </>}
        <DialogFooter className="shrink-0 border-t pt-3 flex-wrap gap-2"><strong className="mr-auto">Total: {total} buc</strong><Button variant="outline" disabled={saving} onClick={() => confirmation ? setConfirmation(null) : setOpen(false)}>{confirmation ? 'Înapoi' : 'Anulează'}</Button><Button variant={confirmation ? 'destructive' : 'default'} disabled={saving || !initialized.current || products.isError || groups.isError} onClick={confirmation ? save : prepare}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{confirmation ? 'Confirmă înlocuirea restocului' : 'Verifică și înlocuiește'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}