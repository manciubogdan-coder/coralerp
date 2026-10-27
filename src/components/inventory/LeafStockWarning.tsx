import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatInTimeZone } from 'date-fns-tz';
import type { AgedLeafLot } from '@/lib/leafStockAge';

export default function LeafStockWarning({ name, lots, children }: { name: string; lots: AgedLeafLot[]; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  if (!lots.length) return <>{children}</>;
  const totals = new Map<string, number>();
  lots.forEach(({ item }) => totals.set(item.unit || 'kg', (totals.get(item.unit || 'kg') || 0) + Number(item.quantity)));
  const quantity = [...totals].map(([unit, qty]) => `${qty.toLocaleString('ro-RO', { maximumFractionDigits: 3 })} ${unit}`).join(' · ');
  return <>
    <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-auto max-w-full whitespace-normal px-1 py-1 text-destructive hover:text-destructive hover:bg-destructive/10" aria-label={`Stoc vechi: ${name}`}>
      <AlertTriangle className="mr-1 h-3.5 w-3.5 shrink-0" />
      {children || <span>{quantity} mai vechi de 3 zile</span>}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5 shrink-0" /> Stoc vechi — {name}</DialogTitle>
          <DialogDescription>Ai marfă pe stoc, dar este mai veche de 3 zile și se depreciază. Verifică aceste loturi înainte de utilizare.</DialogDescription>
        </DialogHeader>
        <p className="font-semibold text-destructive shrink-0">Cantitate afectată: {quantity}</p>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="p-2">Produs / Lot</th><th className="p-2">Recepție</th><th className="p-2">Vechime</th><th className="p-2 text-right">Cantitate rămasă</th></tr></thead>
            <tbody>{lots.map(({ item, days }, i) => <tr key={item.id || i} className="border-b">
              <td className="p-2 break-words">{item.name}<strong className="block">Lot: {item.lot_number || 'Nespecificat'}</strong><span className="text-muted-foreground">{item.suppliers?.name || item.supplier || ''}{item.document_number ? ` · ${item.document_number}` : ''}</span></td>
              <td className="p-2 whitespace-nowrap">{item.receipt_date ? formatInTimeZone(new Date(item.receipt_date), 'Europe/Bucharest', 'dd.MM.yyyy') : '—'}</td>
              <td className="p-2 text-destructive font-semibold whitespace-nowrap">{days} zile</td>
              <td className="p-2 text-right whitespace-nowrap">{Number(item.quantity).toLocaleString('ro-RO', { maximumFractionDigits: 3 })} {item.unit}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}