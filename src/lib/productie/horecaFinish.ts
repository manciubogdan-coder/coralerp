import { distributeGroupQuantity, validateSessionQuantity, wholeUnits } from './finishSession';

/** Keep customer orders separate even when operators work their products together. */
export interface HorecaFinishOrder {
  id: string;
  produs_id: string;
  sessionId: string;
  cantitate: number;
  cantitate_reala_produsa?: number | null;
  cantitate_din_restock?: number | null;
}

export interface HorecaSessionFinish {
  id: string;
  comanda_id: string;
  cantitate_produsa: number;
  status: 'finalizata' | 'partial';
  remaining: number;
}

const alreadyCovered = (order: HorecaFinishOrder) =>
  Math.max(0, Number(order.cantitate_reala_produsa || 0)) +
  Math.max(0, Number(order.cantitate_din_restock || 0));

const remaining = (order: HorecaFinishOrder) =>
  Math.max(0, wholeUnits(order.cantitate) - alreadyCovered(order));

/** Never sum pieces of one product with kilograms or pieces of another product. */
export function horecaProductNeeds(orders: HorecaFinishOrder[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const order of orders) {
    needs.set(order.produs_id, (needs.get(order.produs_id) || 0) + remaining(order));
  }
  return needs;
}

/**
 * Quantities refer to this session only, separately for each product. An omitted
 * product means zero made, not that its requested quantity was produced. Every
 * active session gets closed, including untouched products; their demand remains.
 * Callers must supply a fresh snapshot of the group's active sessions and orders.
 */
export function planHorecaFinish(
  orders: HorecaFinishOrder[],
  quantities: ReadonlyMap<string, number>,
): HorecaSessionFinish[] {
  const byProduct = new Map<string, HorecaFinishOrder[]>();
  const orderIds = new Set<string>();
  const sessionIds = new Set<string>();
  for (const order of orders) {
    if (!order.id || !order.produs_id || !order.sessionId ||
        orderIds.has(order.id) || sessionIds.has(order.sessionId)) {
      throw new Error('Comenzile sau sesiunile HoReCa sunt incomplete ori duplicate. Reîncarcă lista.');
    }
    validateSessionQuantity(order.cantitate);
    validateSessionQuantity(Number(order.cantitate_reala_produsa || 0));
    validateSessionQuantity(Number(order.cantitate_din_restock || 0));
    orderIds.add(order.id);
    sessionIds.add(order.sessionId);
    const productOrders = byProduct.get(order.produs_id) || [];
    productOrders.push(order);
    byProduct.set(order.produs_id, productOrders);
  }
  for (const [productId, quantity] of quantities) {
    validateSessionQuantity(quantity);
    if (!byProduct.has(productId)) {
      throw new Error('Produsul nu mai are o sesiune activă în această comandă. Reîncarcă lista.');
    }
  }

  const result: HorecaSessionFinish[] = [];
  for (const [productId, productOrders] of byProduct) {
    const produced = distributeGroupQuantity(
      productOrders.map(remaining), quantities.get(productId) ?? 0,
    );
    productOrders.forEach((order, index) => {
      const quantity = produced[index];
      const left = Math.max(0, remaining(order) - quantity);
      result.push({
        id: order.sessionId,
        comanda_id: order.id,
        cantitate_produsa: quantity,
        status: left === 0 ? 'finalizata' : 'partial',
        remaining: left,
      });
    });
  }
  return result;
}