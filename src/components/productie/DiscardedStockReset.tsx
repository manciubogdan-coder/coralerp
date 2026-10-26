import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import DateProductiePicker, { tomorrowISO } from './DateProductiePicker';
import { applyDiscardedStock, previewDiscardedStock } from '@/lib/productie/discardedStock';
import { toast } from 'sonner';

export default function DiscardedStockReset({ day }: { day?: string }) {
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(day || tomorrowISO());
  const [clearPool, setClearPool] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const client = useQueryClient();
  const preview = useQuery({ queryKey: ['discarded-stock-preview', selectedDay], enabled: open,
    staleTime: 0, queryFn: () => previewDiscardedStock(selectedDay) });
  const affected = preview.data;
  const active = affected?.sessions.some(s => s.status === 'activa');
  const run = async () => {
    if (!affected || !confirmed || busy) return;
    setBusy(true); setFailure('');
    try {
      const result = await applyDiscardedStock(affected, clearPool);
      toast.success(`${result.cleared} loturi golite; ${result.reset} comenzi fără alocare din restoc.`);
      setOpen(false);
    } catch (e: any) { setFailure(e.message || 'Resetarea nu a reușit.'); }
    finally {
      setBusy(false);
      for (const key of ['orders', 'production-orders', 'productie-comenzi', 'work-sessions', 'restockings', 'marfa-restocata', 'marfa-restocata-istoric', 'comenzi-disponibile-picking', 'picking-produse', 'pool-redistribuire', 'pool-cautare-restocari', 'discarded-stock-preview']) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    }
  };
  return <>
    <Button variant="outline" size="sm" onClick={() => {
      setSelectedDay(day || tomorrowISO()); setConfirmed(false); setFailure(''); setOpen(true);
    }}><RotateCcw className="mr-2 h-4 w-4" />Resetare restoc / comenzi</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Marfa din restoc nu mai există</DialogTitle>
          <DialogDescription>Resetare pe toate liniile, pentru ziua aleasă. Producția efectiv înregistrată se păstrează.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5">
          <DateProductiePicker value={selectedDay} onChange={value => { if (!busy) { setSelectedDay(value); setConfirmed(false); } }} label="Ziua comenzilor de resetat" />
          {preview.isFetching ? <p className="flex gap-2 items-center"><Loader2 className="h-4 w-4 animate-spin" />Se verifică stocul și comenzile…</p> : preview.isError ? <p role="alert" className="text-destructive">Nu pot verifica datele. {preview.error.message}</p> : affected && <>
            <p><strong>{affected.orders.length} comenzi</strong> au cantități luate din restoc pentru {selectedDay.split('-').reverse().join('.')}.</p>
            <p className="text-sm text-muted-foreground">Cantitatea din restoc devine 0. Comenzile fără producție reală reapar nefăcute; cele produse parțial păstrează producția.</p>
            <div className="flex items-start gap-3">
              <Checkbox id="discard-all-pool" checked={clearPool} disabled={busy} onCheckedChange={value => { setClearPool(value === true); setConfirmed(false); }} />
              <Label htmlFor="discard-all-pool" className="leading-relaxed">Golește și toate restocările disponibile: {affected.lots.length} loturi, din toate zilele și de pe toate liniile.</Label>
            </div>
            <div className="border border-destructive rounded-md p-3 flex gap-2 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <span>Marfa eliminată nu este pusă înapoi în stoc. Nu se șterg sesiuni de lucru sau producție reală. Efectuează resetarea când colegii nu lucrează în Picking.</span>
            </div>
            {active && <p role="alert" className="text-destructive">Există sesiuni active pe comenzile afectate. Finalizează-le înainte de resetare.</p>}
            <div className="flex items-start gap-3">
              <Checkbox id="confirm-discard-stock" checked={confirmed} disabled={busy} onCheckedChange={value => setConfirmed(value === true)} />
              <Label htmlFor="confirm-discard-stock" className="leading-relaxed">Confirm că marfa alocată nu mai există fizic și vreau să elimin alocările pentru {selectedDay.split('-').reverse().join('.')}.</Label>
            </div>
          </>}
          {failure && <p role="alert" className="text-destructive">{failure}</p>}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Anulează</Button>
          <Button variant="destructive" disabled={!confirmed || busy || preview.isFetching || preview.isError || !!active || !affected || (!affected.orders.length && (!clearPool || !affected.lots.length))} onClick={run}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmă resetarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}