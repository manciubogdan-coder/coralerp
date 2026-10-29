import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGrupareAmbalare } from '@/hooks/productie/useGrupareAmbalare';
import { countedQuantity, stocktakeId, stocktakePayloads, stocktakeRows } from '@/lib/productie/stocktakeOctober28';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function StocktakeOctober28Dialog() {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const client = useQueryClient();
  const groups = useGrupareAmbalare();
  const products = useQuery({
    queryKey: ['manual-restock-products'], enabled: open,
    queryFn: async () => {
      const rows: { id: string; nume: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('productie_produse').select('id, nume').order('id').range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return rows;
    },
  });
  const candidates = stocktakeRows.map(row => {
    const allowed = new Set<string>(row[2]);
    const byGroup = new Map<string, { id: string; name: string }>();
    for (const product of products.data || []) {
      const group = groups.data?.[product.id];
      if (group && allowed.has(group) && !byGroup.has(group)) byGroup.set(group, { id: product.id, name: group });
    }
    return Array.from(byGroup.values());
  });
  const selected = candidates.map((options, index) => choices[index] || (options.length === 1 ? options[0]?.id : '') || '');
  const ready = selected.every((id, index) => candidates[index].some(option => option.id === id));
  const save = async () => {
    if (locked.current || !ready) return;
    locked.current = true; setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Autentifică-te înainte de import.');
      const payload = stocktakePayloads(selected);
      const ids = stocktakeRows.map((_, index) => stocktakeId(index));
      const previous = await supabase.from('productie_restocari').select('id').in('id', ids);
      if (previous.error) throw previous.error;
      if (previous.data?.length) throw new Error('Foaia a fost deja introdusă. Nu o importăm din nou.');
      const result = await supabase.from('productie_restocari').insert(payload).select('id');
      if (result.error) throw result.error;
      const readback = await supabase.from('productie_restocari').select('id, produs_id, cantitate_surplus, data_productie').in('id', ids);
      if (readback.error) throw readback.error;
      if (readback.data?.length !== payload.length || payload.some(row => !readback.data?.some(saved => saved.id === row.id && saved.produs_id === row.produs_id && Number(saved.cantitate_surplus) === row.cantitate_surplus && saved.data_productie === row.data_productie))) {
        throw new Error('Importul a fost trimis, dar verificarea cantităților a eșuat. Nu reimporta; verifică Restocări.');
      }
      await client.invalidateQueries({ predicate: query => /pool|restoc|restock|picking/.test(String(query.queryKey[0])) });
      toast.success('Foaia a fost introdusă: 3.782 bucăți, 27 de produse, data 28.10.2026.');
      setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Importul nu s-a terminat.'); }
    finally { locked.current = false; setSaving(false); }
  };
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><ClipboardCheck className="h-4 w-4" />Introdu foaia 28.10</Button>
    <Dialog open={open} onOpenChange={value => { if (!locked.current) setOpen(value); }}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader><DialogTitle>Restoc fizic · 28.10.2026</DialogTitle><DialogDescription>3.782 bucăți · 27 de produse. Importul adaugă doar foaia, nu șterge alte restocări și nu modifică comenzile.</DialogDescription></DialogHeader>
        <div className="overflow-y-auto min-h-0 divide-y">
          {(products.isLoading || groups.isLoading) && <p className="py-3">Se încarcă produsele...</p>}
          {(products.isError || groups.isError) && <div className="py-3 text-destructive">Produsele nu au putut fi încărcate.<Button variant="outline" onClick={() => { products.refetch(); groups.refetch(); }}>Reîncearcă</Button></div>}
          {stocktakeRows.map((row, index) => <div key={row[0]} className="py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><div className="font-medium">{row[0]} · {countedQuantity(index)} buc</div><div className="text-sm text-muted-foreground">{row[1].map(([units, cases]) => `${cases} bax × ${units}`).join(' + ')}</div></div>
            <Select value={selected[index]} disabled={saving} onValueChange={id => setChoices(prev => ({ ...prev, [index]: id }))}>
              <SelectTrigger aria-label={`Grupa ${row[0]}`}><SelectValue placeholder={candidates[index].length ? 'Alege grupa' : 'Grupa nu a fost găsită'} /></SelectTrigger>
              <SelectContent>{candidates[index].map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>)}
        </div>
        <DialogFooter className="border-t pt-3"><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Anulează</Button><Button disabled={saving || !ready} onClick={save}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}Confirmă introducerea · 3.782 buc</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}