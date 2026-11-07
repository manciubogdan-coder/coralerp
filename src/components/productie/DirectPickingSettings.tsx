import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { argusFetch } from '@/lib/argusApi';
import { supabaseCloud } from '@/integrations/supabase/cloudClient';
import { useProducts, DIRECT_PICKING_KEY } from '@/hooks/productie/useProductionData';
import { refreshProductionQueries } from '@/lib/productie/refreshProductionQueries';

type Row = { produs_id: string; produs_nume: string };

export default function DirectPickingSettings() {
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: products = [] } = useProducts();
  const list = useQuery({
    queryKey: ['productie-direct-picking-list'],
    queryFn: async () => {
      const { data, error } = await supabaseCloud.from('productie_direct_picking').select('produs_id, produs_nume').order('produs_nume');
      if (error) throw error;
      return (data || []) as Row[];
    },
  });
  const chosen = new Set((list.data || []).map(r => r.produs_id));
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return products.filter(p => !chosen.has(p.id) && p.nume.toLowerCase().includes(q)).slice(0, 8);
  }, [search, products, list.data]);

  const save = useMutation({
    mutationFn: ({ action, row }: { action: 'direct_picking_save' | 'direct_picking_delete'; row: Row }) =>
      argusFetch(action, {}, row),
    onSuccess: async (_d, v) => {
      setSearch('');
      await cache.invalidateQueries({ queryKey: ['productie-direct-picking-list'] });
      await cache.invalidateQueries({ queryKey: DIRECT_PICKING_KEY });
      refreshProductionQueries(cache, ['orders', 'comenzi-disponibile-picking', 'picking-produse']);
      toast.success(v.action === 'direct_picking_save'
        ? `${v.row.produs_nume} merge acum direct în picking.`
        : `${v.row.produs_nume} revine pe liniile de producție.`);
    },
    onError: (e: Error) => toast.error(`Nu s-a salvat: ${e.message}`),
  });

  return <section className="space-y-3 border-b pb-5">
    <div>
      <h2 className="text-lg font-semibold">Direct în picking</h2>
      <p className="text-sm text-muted-foreground">Marfă care vine gata ambalată și doar se etichetează. Comenzile acestor produse nu mai merg pe nicio linie, ci apar direct în Picking, gata de numărat.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {list.isPending && <span className="text-sm text-muted-foreground">Se încarcă…</span>}
      {list.isError && <span className="text-sm text-destructive">Lista nu s-a putut încărca.</span>}
      {(list.data || []).map(r => <span key={r.produs_id} className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-sm">
        {r.produs_nume}
        <button type="button" aria-label={`Scoate ${r.produs_nume}`} className="text-muted-foreground hover:text-destructive" disabled={save.isPending}
          onClick={() => window.confirm(`Scoți ${r.produs_nume}? Comenzile lui vor merge din nou pe linia de producție.`) && save.mutate({ action: 'direct_picking_delete', row: r })}>
          <X className="h-3.5 w-3.5" />
        </button>
      </span>)}
      {list.data?.length === 0 && <span className="text-sm text-muted-foreground">Niciun produs.</span>}
    </div>
    <div className="max-w-md space-y-1">
      <Input placeholder="Adaugă produs: caută după denumire…" value={search} onChange={e => setSearch(e.target.value)} />
      {matches.length > 0 && <div className="rounded-md border bg-popover max-h-64 overflow-y-auto">
        {matches.map(p => <button key={p.id} type="button" disabled={save.isPending}
          className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
          onClick={() => save.mutate({ action: 'direct_picking_save', row: { produs_id: p.id, produs_nume: p.nume } })}>
          {p.nume}
        </button>)}
      </div>}
    </div>
  </section>;
}
