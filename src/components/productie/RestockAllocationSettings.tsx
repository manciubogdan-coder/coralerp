import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { argusFetch } from '@/lib/argusApi';
import { loadAutomaticRestock } from '@/lib/productie/restockAllocationMode';

export default function RestockAllocationSettings() {
  const cache = useQueryClient();
  const setting = useQuery({ queryKey: ['production-restock-mode'], queryFn: loadAutomaticRestock, refetchInterval: 15000 });
  const save = useMutation({
    mutationFn: (auto_enabled: boolean) => argusFetch<{ auto_enabled: boolean }>('restock_mode_save', {}, { auto_enabled }),
    onSuccess: async (data) => {
      cache.setQueryData(['production-restock-mode'], data.auto_enabled);
      await cache.invalidateQueries({ queryKey: ['production-restock-mode'] });
      toast.success(data.auto_enabled ? 'Alocarea automată din restoc este pornită.' : 'Alocarea automată din restoc este oprită.');
    },
    onError: (e: Error) => toast.error(`Setarea nu a fost salvată: ${e.message}`),
  });
  return <section className="space-y-4 border-b pb-5">
    <h2 className="text-lg font-semibold">Restocări</h2>
    <div className="flex items-center gap-3">
      <Switch id="automatic-restock" checked={setting.data === true} disabled={setting.isPending || setting.isError || save.isPending} onCheckedChange={enabled => {
        if (enabled && !window.confirm('Activezi preluarea din restoc la pornirea comenzilor pentru toți operatorii? Confirmă numai dacă stocul din aplicație corespunde mărfii fizice.')) return;
        save.mutate(enabled);
      }} />
      <Label htmlFor="automatic-restock">Alocare automată din restoc</Label>
      <span className="text-sm text-muted-foreground">{setting.isPending ? 'Se încarcă…' : save.isPending ? 'Se salvează…' : setting.isError ? 'Indisponibilă' : setting.data ? 'Pornită' : 'Oprită'}</span>
    </div>
    {setting.isError && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive">Setarea nu s-a putut încărca. Preluarea automată rămâne blocată.</p><Button variant="outline" size="sm" onClick={() => setting.refetch()}>Reîncearcă</Button></div>}
  </section>;
}