import { Package } from 'lucide-react';
import { useOrderPackaging } from '@/hooks/productie/useOrderPackaging';
import { packagingQuantity, type PackagingOrder } from '@/lib/productie/orderPackaging';
import { resolveStorePackaging, packagingUnits } from '../../../supabase/functions/_shared/packagingRules';

export default function OrderPackaging({ order, quantity = order.cantitate }: { order: PackagingOrder; quantity?: number }) {
  const { data, isPending, isError } = useOrderPackaging();
  const store = order.magazin || order.productie_clienti?.nume_magazin || order.productie_clienti?.nume || '';
  const units = resolveStorePackaging(order.produs_id || '', store, data || []) ?? packagingUnits(order.baxare);
  const cases = units ? packagingQuantity(quantity, units) : null;
  return (
    <div className="flex items-start gap-1.5 text-xs text-foreground my-1 min-w-0">
      <Package className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div className="min-w-0 break-words">
        {units ? <>
          <span className="font-semibold">Baxare: {units} buc/bax</span>
          {cases && <span> · {cases.fullCases} baxuri{cases.looseUnits > 0 ? ` + ${cases.looseUnits} buc` : ''}</span>}
        </> : <span className="text-muted-foreground">Baxare: {order.baxare || (isPending ? 'Se încarcă…' : isError ? 'Indisponibilă momentan' : 'Nespecificată')}</span>}
      </div>
    </div>
  );
}