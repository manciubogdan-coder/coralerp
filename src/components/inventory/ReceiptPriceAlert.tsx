import { AlertTriangle } from 'lucide-react';
import type { PriceSafety } from '../../../supabase/functions/_shared/priceSafetyRules';

const fmt = (v: number) => v.toLocaleString('ro-RO', { maximumFractionDigits: 4 });

export function ReceiptPriceAlert({ safety, name }: { safety: PriceSafety; name?: string }) {
  if (!safety.suspect || safety.averagePrice == null || safety.ratio == null) return null;
  return <div role="alert" className="rounded-md border border-crm-warning/50 bg-crm-warning/10 p-3 text-sm text-crm-warning">
    <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0 space-y-1">
      <p className="font-semibold">Unitate NIR suspectă{ name ? ` · ${name}` : ''}</p>
      <p>Ultima intrare: {fmt(safety.latestPrice)} lei/{safety.unit} · {safety.day} · NIR ID {safety.documentId}.</p>
      <p>Media ponderată precedentelor 6 luni: {fmt(safety.averagePrice)} lei/{safety.unit} ({safety.historyCount} intrări, de la {safety.historyStart}). Prețul este de {fmt(safety.ratio)}× mai mare.</p>
      <p>Verifică rolă/bucată și cantitatea din NIR. Prețul rămâne cel din Senior; nu a fost corectat automat.</p>
    </div></div>
  </div>;
}