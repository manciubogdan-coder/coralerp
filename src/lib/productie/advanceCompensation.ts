type CompensationOrder = { data_productie?: string | null; created_at: string };

const dayOf = (order: CompensationOrder) => String(order.data_productie || order.created_at).slice(0, 10);

// Un avans este un plan pentru cererea din ziua pentru care e planificat.
// - Avansul generat AUTOMAT (cron/matrice) este o estimare: se reduce cu orice
//   comandă fermă din aceeași zi, indiferent când a fost importată comanda
//   (Senior poate crea comenzile ferme înainte de generarea avansului).
// - Avansul adăugat MANUAL este o decizie deliberată de a produce în plus:
//   comenzile ferme deja existente nu trebuie să îl șteargă; îl reduc doar
//   comenzile ferme create STRICT DUPĂ el.
export function canCompensateAdvance(
  advance: CompensationOrder,
  firm: CompensationOrder,
  advanceIsAuto = false,
): boolean {
  if (dayOf(advance) !== dayOf(firm)) return false;
  if (advanceIsAuto) return true;
  const advanceTime = Date.parse(advance.created_at);
  const firmTime = Date.parse(firm.created_at);
  return Number.isFinite(advanceTime) && Number.isFinite(firmTime) && firmTime > advanceTime;
}

type QuantityOrder = CompensationOrder & {
  cantitate: number;
  status?: string;
  cantitate_reala_produsa?: number;
  cantitate_produsa_sesiuni?: number;
  cantitate_din_restock?: number;
  cantitate_din_avans?: number;
  cantitate_scazuta_din_ferme?: number;
};

// Projection only: completion applies to the displayed order, never stored data.
export function compensateAdvanceQuantities(
  advances: { order: QuantityOrder; automatic: boolean }[],
  firms: QuantityOrder[],
) {
  const balances = advances.map(({ order, automatic }) => ({
    order, automatic, capacity: Number(order.cantitate || 0), reduction: 0, transferred: 0,
    produced: Math.min(Number(order.cantitate || 0), Number(order.cantitate_reala_produsa || 0) + Number(order.cantitate_din_restock || 0)),
  }));
  for (const firm of firms) {
    let demand = Math.max(0, Number(firm.cantitate || 0) - Number(firm.cantitate_din_restock || 0));
    let unmet = Math.max(0, demand - Number(firm.cantitate_reala_produsa || 0));
    let transferred = 0;
    for (const balance of balances) {
      if (demand <= 0) break;
      if (dayOf(balance.order) !== dayOf(firm) || balance.capacity <= 0) continue;
      const reducePlan = canCompensateAdvance(balance.order, firm, balance.automatic);
      // Existing physical advance production covers this day's demand even when
      // Senior created the firm order earlier. Unproduced manual plans stay intact.
      const take = reducePlan
        ? Math.min(demand, balance.capacity)
        : Math.min(unmet, balance.produced, balance.capacity);
      const fromProduced = Math.min(unmet, balance.produced, take);
      balance.capacity -= take;
      balance.produced -= fromProduced;
      balance.reduction += take;
      balance.transferred += fromProduced;
      demand -= take;
      unmet -= fromProduced;
      transferred += fromProduced;
    }
    if (transferred > 0) {
      firm.cantitate_din_avans = transferred;
      firm.cantitate_reala_produsa = Number(firm.cantitate_reala_produsa || 0) + transferred;
    }
  }
  for (const balance of balances) {
    if (balance.reduction <= 0) continue;
    balance.order.cantitate_scazuta_din_ferme = balance.reduction;
    balance.order.cantitate = Math.max(0, Number(balance.order.cantitate || 0) - balance.reduction);
    if (balance.order.cantitate === 0) balance.order.status = 'completed';
    const restock = Number(balance.order.cantitate_din_restock || 0);
    const fromRestock = Math.max(0, balance.transferred - Number(balance.order.cantitate_reala_produsa || 0));
    balance.order.cantitate_din_restock = Math.max(0, restock - fromRestock);
    balance.order.cantitate_reala_produsa = Math.min(balance.order.cantitate,
      Math.max(0, Number(balance.order.cantitate_reala_produsa || 0) - balance.transferred));
  }
}
