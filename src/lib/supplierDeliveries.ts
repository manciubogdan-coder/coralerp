export interface SupplierDeliveryOrder {
  product_id: string | null;
  quantity_ordered: number | string | null;
  expected_delivery_date: string | null;
  status: string;
}

export interface SupplierDeliverySchedule {
  qty: number;
  perDate: Record<string, number>;
}

// Date-only business dates must not shift with the browser's timezone.
export function supplierDeliverySchedules(orders: SupplierDeliveryOrder[], today: string) {
  const result = new Map<string, SupplierDeliverySchedule>();
  for (const order of orders) {
    const date = order.expected_delivery_date?.slice(0, 10);
    const qty = Number(order.quantity_ordered);
    if (!order.product_id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today ||
        !["pending", "ordered"].includes(order.status) || !Number.isFinite(qty) || qty <= 0) continue;
    const schedule = result.get(order.product_id) || { qty: 0, perDate: {} };
    schedule.qty += qty;
    schedule.perDate[date] = (schedule.perDate[date] || 0) + qty;
    result.set(order.product_id, schedule);
  }
  return result;
}

export function supplierStockProjection(
  stock: number,
  dates: string[],
  deliveries: Record<string, number> | null | undefined,
  consumption: number[],
) {
  let running = stock;
  const start: number[] = [];
  const incoming: number[] = [];
  const remaining: number[] = [];
  let outDate: string | null = null;
  dates.forEach((date, i) => {
    start.push(running);
    const qty = deliveries?.[date] || 0;
    incoming.push(qty);
    running += qty - (consumption[i] || 0);
    if (running < 0 && !outDate) outDate = date;
    running = Math.max(running, 0);
    remaining.push(running);
  });
  return { start, incoming, remaining, consum: consumption, outDate };
}