type CompensationOrder = { data_productie?: string | null; created_at: string };

const dayOf = (order: CompensationOrder) => String(order.data_productie || order.created_at).slice(0, 10);

// An advance is a plan for additional demand arriving AFTER it was created.
// Existing firm orders must not erase a newly entered production plan.
export function canCompensateAdvance(advance: CompensationOrder, firm: CompensationOrder): boolean {
  const advanceTime = Date.parse(advance.created_at);
  const firmTime = Date.parse(firm.created_at);
  return dayOf(advance) === dayOf(firm)
    && Number.isFinite(advanceTime)
    && Number.isFinite(firmTime)
    && firmTime > advanceTime;
}