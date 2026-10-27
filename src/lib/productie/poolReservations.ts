export interface ReservedPoolLot {
  id: string;
  cantitate_surplus: number;
  comanda_originala_id?: string | null;
}

export interface PoolOrigin {
  id: string;
  cantitate: number;
  cantitate_din_restock?: number | null;
  magazin?: string;
  tip_comanda?: string;
}

/** Production awaiting dispatch belongs to its originating firm order, not the next day's demand. */
export function availablePoolLots<T extends ReservedPoolLot>(lots: T[], origins: PoolOrigin[], targetOrderId?: string): T[] {
  const originMap = new Map(origins.map(order => [order.id, order]));
  const reserved = new Map<string, number>();
  return lots.map(lot => {
    const originId = lot.comanda_originala_id;
    const qty = Math.max(0, Number(lot.cantitate_surplus || 0));
    if (!originId || originId === targetOrderId) return { ...lot, cantitate_surplus: qty };
    const origin = originMap.get(originId);
    // Missing origins cannot safely be assumed to be unreserved surplus.
    if (!origin) return { ...lot, cantitate_surplus: 0 };
    if ([origin.magazin, origin.tip_comanda].some(kind => kind === 'PRODUCTIE_AVANS' || kind === 'REAMBALARE')) {
      return { ...lot, cantitate_surplus: qty };
    }
    const remainingReservation = reserved.get(originId) ?? Math.max(0, Number(origin.cantitate) - Number(origin.cantitate_din_restock || 0));
    const held = Math.min(qty, remainingReservation);
    reserved.set(originId, remainingReservation - held);
    return { ...lot, cantitate_surplus: qty - held };
  }).filter(lot => lot.cantitate_surplus > 0);
}