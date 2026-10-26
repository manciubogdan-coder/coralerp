import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { Loader2, PackagePlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { manualRestockPayload } from '@/lib/productie/manualRestock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Product { id: string; nume: string; unitate_masura: string | null }

export default function ManualRestockDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [day, setDay] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['manual-restock-products'],
    enabled: open,
    queryFn: async () => {
      const rows: Product[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from('productie_produse')
          .select('id, nume, unitate_masura').order('nume').order('id').range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return rows;
    },
  });
  const selected = products.find(p => p.id === productId);
  const filtered = products.filter(p => p.nume.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro')));
  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!selected) throw new Error('Selectează un produs din listă.');
      const payload = manualRestockPayload(selected.id, Number(quantity.replace(',', '.')), day);
      const { data, error } = await supabase.from('productie_restocari').insert(payload).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('Restocarea nu a fost confirmată.');
      setOpen(false);
      toast.success(`Restocare adăugată: ${payload.cantitate_surplus} ${selected.unitate_masura || 'buc'} — ${selected.nume}`);
      await queryClient.invalidateQueries({ predicate: query => {
        const key = String(query.queryKey[0]);
        return key.includes('pool') || key.includes('restoc') || key === 'restockings';
      } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Restocarea nu a putut fi salvată.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <>
      <Button size="sm" onClick={() => {
        setSearch(''); setProductId(''); setQuantity('');
        setDay(formatInTimeZone(new Date(), 'Europe/Bucharest', 'yyyy-MM-dd'));
        setOpen(true);
      }}><PackagePlus className="h-4 w-4" />Adaugă restocare</Button>
      <Dialog open={open} onOpenChange={value => { if (!savingRef.current) setOpen(value); }}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Adaugă restocare manuală</DialogTitle>
            <DialogDescription>Marfă existentă fizic în Picking. Adăugarea nu finalizează nicio comandă.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-restock-search">Produs</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="manual-restock-search" placeholder="Caută produs..." className="pl-9" value={search} disabled={saving} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="h-40 overflow-y-auto border rounded-md" role="group" aria-label="Produse disponibile">
                {isLoading && <p className="p-3 text-sm text-muted-foreground">Se încarcă produsele...</p>}
                {isError && <div className="p-3 text-sm text-destructive">Produsele nu au putut fi încărcate.<Button variant="outline" size="sm" onClick={() => refetch()}>Reîncearcă</Button></div>}
                {!isLoading && !isError && filtered.length === 0 && <p className="p-3 text-sm text-muted-foreground">Niciun produs găsit.</p>}
                {filtered.map(p => <Button key={p.id} type="button" variant={productId === p.id ? 'secondary' : 'ghost'} aria-pressed={productId === p.id} disabled={saving}
                  className="w-full h-auto min-h-10 justify-start text-left whitespace-normal rounded-none" onClick={() => setProductId(p.id)}>{p.nume}</Button>)}
              </div>
              {selected && <p className="text-sm font-medium break-words">{selected.nume} · {selected.unitate_masura || 'buc'}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="manual-restock-quantity">Cantitate ({selected?.unitate_masura || 'buc'})</Label>
                <Input id="manual-restock-quantity" type="number" min="0" step="any" value={quantity} disabled={saving} onChange={e => setQuantity(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="manual-restock-day">Data producției</Label>
                <Input id="manual-restock-day" type="date" value={day} disabled={saving} onChange={e => setDay(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter className="border-t pt-3 gap-2">
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Anulează</Button>
            <Button disabled={saving || isLoading || !selected || !day || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
              {saving ? 'Se salvează...' : 'Salvează restocarea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}