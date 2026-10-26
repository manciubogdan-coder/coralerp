export interface ResetOrder {
  id: string;
  data_productie: string | null;
  cantitate: number;
  cantitate_din_restock: number | null;
  linie_id: string | null;
  status: string;
  updated_at: string;
}

export function statusWithoutDiscardedStock(order: ResetOrder, produced: number): string {
  if (produced > 0 && produced >= Number(order.cantitate)) return 'completed';
  if (produced > 0) return 'partial';
  return order.linie_id ? 'assigned' : 'pending';
}

export function isResetOrder(order: ResetOrder, day: string): boolean {
  return order.data_productie === day && Number(order.cantitate_din_restock) > 0;
}

export const discardedPoolPatch = (quantity: number, timestamp: string, userId: string | null) => ({
  cantitate_surplus: 0,
  status: 'redistribuit',
  motiv_scoatere: 'aruncat',
  observatii_scoatere: `[${quantity}] Golire restoc: marfa nu mai există fizic.`,
  scos_la: timestamp,
  scos_de: userId,
  updated_at: timestamp,
});