// The operational DB rejects canceled_by_erp. Keep the row and its sessions
// using the supported terminal status, with no remaining customer demand.
export function cancellationPatch() {
  return { cantitate: 0, status: 'completed' as const };
}

export function isErpCancellationApplied(order: { cantitate: unknown; status: unknown }) {
  return order.status === 'canceled_by_erp' ||
    (order.status === 'completed' && Number(order.cantitate) === 0);
}