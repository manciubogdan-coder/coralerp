import { Package } from 'lucide-react';
import { useOrderPackaging } from '@/hooks/productie/useOrderPackaging';
import { findOrderPackaging, packagingQuantity, type PackagingOrder } from '@/lib/productie/orderPackaging';

export default function OrderPackaging({ order, quantity = order.cantitate }: { order: PackagingOrder; quantity?: number }) {
  const { data, isPending, isError } = useOrderPackaging();
  const method = findOrderPackaging(order, data || []);
  const cases = method ? packagingQuantity(quantity, method.units_per_case) : null;
  return (
    <div className="flex items-start gap-1.5 text-xs text-foreground my-1 min-w-0">
      <Package className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div className="min-w-0 break-words">
        {method ? <>
          <span className="font-semibold">Baxare: {method.units_per_case} buc/bax</span>
          {cases && <span> · {cases.fullCases} baxuri{cases.looseUnits > 0 ? ` + ${cases.looseUnits} buc` : ''}</span>}
          {method.tertiary_packaging && <div className="text-muted-foreground">{method.tertiary_packaging}</div>}
          {order.baxare && <div className="text-muted-foreground">{order.baxare}</div>}
        </> : <span className="text-muted-foreground">Baxare: {order.baxare || (isPending ? 'Se încarcă…' : isError ? 'Indisponibilă momentan' : 'Nespecificată')}</span>}
      </div>
    </div>
  );
}