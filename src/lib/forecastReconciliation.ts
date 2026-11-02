import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const businessDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? value : formatInTimeZone(new Date(value), 'Europe/Bucharest', 'yyyy-MM-dd');
export const dayBounds = (day: string) => ({
  start: fromZonedTime(`${day}T00:00:00`, 'Europe/Bucharest').toISOString(),
  end: fromZonedTime(`${day}T23:59:59.999`, 'Europe/Bucharest').toISOString(),
});
export const materialKey = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
export const materialQuantity = (quantity: unknown, unit?: string) => {
  const q = Number(quantity) || 0;
  const u = (unit || '').toLowerCase();
  return ['g', 'gr', 'grame'].includes(u) ? q / 1000 : ['t', 'tone'].includes(u) ? q * 1000 : q;
};
export async function readPages(build: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await build().range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

// Commitments remain visible after delivery; they are never treated as actual receipts.
export function historicalCommitments(orders: any[]) {
  const result: Record<string, Record<string, number>> = {};
  for (const o of orders) {
    const day = o.expected_delivery_date?.slice(0, 10);
    if (!o.product_id || !day || ['cancelled', 'canceled'].includes(o.status)) continue;
    const schedule = result[o.product_id] ||= {};
    schedule[day] = (schedule[day] || 0) + (Number(o.quantity_ordered) || 0);
  }
  return result;
}

export interface ProductionUsage {
  key: string; name: string; day: string; targetDay: string | null; orderId: string;
  product: string; client: string; quantity: number; advance: boolean; otherDay: boolean;
}
export function sessionUsage(sessions: any[], orders: any[], customs: any[]): ProductionUsage[] {
  const byId = new Map(orders.map(o => [o.id, o]));
  return sessions.flatMap(s => {
    const o = byId.get(s.comanda_id);
    if (!o || !s.ora_sfarsit || !['finalizata', 'partial'].includes(s.status)) return [];
    const day = businessDay(s.ora_sfarsit);
    const targetDay = o.data_productie?.slice(0, 10) || null;
    const own = customs.filter(i => i.comanda_id === o.id);
    const recipes = o.productie_produse?.productie_retete || [];
    const ingredients = own.length ? own : (recipes.find((r: any) => r.activa)?.productie_retete_ingrediente || []);
    return ingredients.map((i: any) => {
      const name = i.ingredient_custom_nume || i.productie_ingrediente?.nume || 'Necunoscut';
      return { key: materialKey(name), name, day, targetDay, orderId: o.id,
        product: o.productie_produse?.nume || '', client: o.magazin || '',
        quantity: materialQuantity(Number(i.cantitate_necesara) * Number(s.cantitate_produsa || 0), i.unitate_masura),
        advance: o.tip_comanda === 'PRODUCTIE_AVANS' || o.magazin === 'PRODUCTIE_AVANS',
        otherDay: !!targetDay && targetDay !== day };
    });
  });
}
export function stockVariance(opening: number | null, closing: number | null, receipts: number, outbound: number) {
  // Signed residual: returns, inventory corrections, timing and unmapped movements, NOT proven loss.
  return opening === null || closing === null ? null : closing - (opening + receipts - outbound);
}

export function reconcileProjection(input: {
  dates: string[]; today: string; anchor: number | null;
  snapshots: Record<string, number>; ordered: Record<string, number>;
  received: Record<string, number>; outbound: Record<string, number>; demand: number[];
}) {
  let running: number | null = input.anchor;
  return input.dates.map((day, i) => {
    const historical = day < input.today;
    const observed = input.snapshots[day] ?? null;
    const opening = day <= input.today ? observed : running;
    const incoming = historical ? input.received[day] || 0 : input.ordered[day] || 0;
    const consumption = historical ? input.outbound[day] || 0 : input.demand[i] || 0;
    const closing = opening === null ? null : opening + incoming - consumption;
    const nextDay = new Date(`${day}T12:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextSnapshot = input.snapshots[nextDay.toISOString().slice(0, 10)] ?? null;
    const residual = historical ? stockVariance(opening, nextSnapshot, incoming, consumption) : null;
    running = closing;
    return { opening, closing, observed, incoming, consumption, residual };
  });
}