import { useEffect, useState } from 'react';
import { argusFetch } from '@/lib/argusApi';
import { ReceiptPriceAlert } from './ReceiptPriceAlert';
import type { PriceSafety } from '../../../supabase/functions/_shared/priceSafetyRules';

export function ReceptionPriceSafety({ code, name }: { code?: string; name: string }) {
  const [result, setResult] = useState<{ safety: PriceSafety | null; reason?: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stale = false;
    setResult(null); setError('');
    argusFetch<{ safety: PriceSafety | null; reason?: string }>('receipt_price_safety', {}, { code, name })
      .then(r => { if (!stale) setResult(r); })
      .catch(e => { if (!stale) setError(e.message); });
    return () => { stale = true; };
  }, [code, name]);
  if (error) return <p className="text-xs text-muted-foreground">Verificare preț Senior indisponibilă: {error}</p>;
  if (!result) return <p className="text-xs text-muted-foreground">Se verifică ultimul preț NIR…</p>;
  if (!result.safety) return <p className="text-xs text-muted-foreground">{result.reason}</p>;
  if (result.safety.suspect) return <ReceiptPriceAlert safety={result.safety} />;
  if (result.safety.averagePrice == null || result.safety.historyCount === 0) return <p className="text-xs text-muted-foreground">Istoric insuficient în ultimele 6 luni pentru verificarea ultimului preț NIR.</p>;
  return null;
}