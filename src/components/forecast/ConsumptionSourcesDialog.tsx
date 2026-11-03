import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ConsumptionSource {
  id: string;
  day: string;
  source: string;
  detail: string;
  quantity: number;
}

export default function ConsumptionSourcesDialog({ selection, onClose }: {
  selection: { name: string; day: string; unit: string; sources: ConsumptionSource[]; total: number; actual: boolean } | null;
  onClose: () => void;
}) {
  const fmt = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 2 });
  return <Dialog open={!!selection} onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Consum — {selection?.name}</DialogTitle>
        <DialogDescription>{selection?.day} · {selection?.actual ? 'Transferuri nete către producție, ca în Raport Consum. Retururile sunt intrări separate în stoc.' : 'Necesar estimat din comenzi și rețete, cu pierdere tehnologică; nu reprezintă consum înregistrat.'}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background"><tr className="border-b"><th className="p-2 text-left">Sursă</th><th className="p-2 text-left">Detalii</th><th className="p-2 text-right">Cantitate ({selection?.unit})</th></tr></thead>
          <tbody>{selection?.sources.map(s => <tr key={s.id} className="border-b"><td className="p-2 align-top">{s.source}</td><td className="p-2 whitespace-pre-wrap">{s.detail}</td><td className="p-2 text-right tabular-nums">{fmt(s.quantity)}</td></tr>)}</tbody>
        </table>
        {!selection?.sources.length && <p className="p-4 text-muted-foreground">Nu există transferuri către producție în această zi.</p>}
      </div>
      <div className="flex justify-between border-t pt-4 font-semibold"><span>Total</span><span className="tabular-nums">{fmt(selection?.total || 0)} {selection?.unit}</span></div>
    </DialogContent>
  </Dialog>;
}