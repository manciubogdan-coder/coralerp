import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useHorecaGroups, HORECA_GROUPS_KEY } from '@/hooks/productie/useHorecaGroups';
import { useClients } from '@/hooks/productie/useProductionData';
import { horecaGroup } from '../../../supabase/functions/_shared/horecaRules';
import { argusFetch } from '@/lib/argusApi';
import { refreshProductionQueries } from '@/lib/productie/refreshProductionQueries';
import { toast } from 'sonner';

export default function HorecaGroupSettings() {
  const list = useHorecaGroups();
  const clients = useClients();
  const cache = useQueryClient();
  const [edit, setEdit] = useState<{ operation: 'create' | 'rename' | 'delete'; id: string; name: string } | null>(null);
  const save = useMutation({
    mutationFn: () => argusFetch('horeca_groups_change', {}, { ...edit, version: list.data?.version }),
    onSuccess: async () => { setEdit(null); await cache.invalidateQueries({ queryKey: HORECA_GROUPS_KEY }); await refreshProductionQueries(cache, ['clients', 'orders']); toast.success('Grupele HoReCa au fost actualizate.'); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <section className="space-y-3 border-b pb-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">Grupe HoReCa</h3><Button variant="outline" size="sm" disabled={!list.data || list.isError} onClick={() => setEdit({ operation: 'create', id: crypto.randomUUID(), name: '' })}><Plus className="mr-2 h-4 w-4" />Grupă nouă</Button></div>
    {list.isError && <p role="alert" className="text-destructive">Grupele nu s-au putut încărca.</p>}
    <div className="flex flex-wrap gap-3">{(list.data?.groups || []).map(group => {
      const count = (clients.data || []).filter(c => horecaGroup(c.nickname, list.data?.groups) === group.name).length;
      return <div key={group.id} className="flex items-center gap-2 rounded-md border px-3 py-2"><span className="text-sm font-medium">{group.name}</span><span className="text-xs text-muted-foreground">{count} clienți</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Redenumește grupa ${group.name}`} title="Redenumește grupa" onClick={() => setEdit({ operation: 'rename', id: group.id, name: group.name })}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Șterge grupa ${group.name}`} title="Șterge grupa" onClick={() => setEdit({ operation: 'delete', id: group.id, name: group.name })}><Trash2 className="h-4 w-4" /></Button>
      </div>;
    })}</div>
    {list.data?.groups.length === 0 && <p className="text-sm text-muted-foreground">Nicio grupă HoReCa.</p>}
    <Dialog open={!!edit} onOpenChange={open => { if (!open && !save.isPending) setEdit(null); }}><DialogContent><DialogHeader><DialogTitle>{edit?.operation === 'create' ? 'Grupă HoReCa nouă' : edit?.operation === 'rename' ? 'Redenumește grupa HoReCa' : `Șterge grupa ${edit?.name}`}</DialogTitle></DialogHeader>
      {edit?.operation === 'delete' ? <p className="text-sm">Ștergerea nu elimină clienții sau istoricul. Grupa poate fi ștearsă numai după ce clienții ei au fost atribuiți altei grupe sau scoși din HoReCa.</p> : <div className="space-y-2"><Label htmlFor="horeca-group-name">Denumire grupă</Label><Input id="horeca-group-name" maxLength={80} value={edit?.name || ''} onChange={e => setEdit(previous => previous ? { ...previous, name: e.target.value } : null)} /></div>}
      <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={() => setEdit(null)}>Anulează</Button><Button variant={edit?.operation === 'delete' ? 'destructive' : 'default'} disabled={save.isPending || list.isError || (edit?.operation !== 'delete' && !edit?.name.trim())} onClick={() => save.mutate()}>{edit?.operation === 'delete' ? 'Șterge grupa' : 'Salvează grupa'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}