import { validRadarSettings, validRadarSettingsByType, changedOrders, DEFAULT_RADAR_BY_TYPE, type RadarInvType, type SeenOrder } from '../_shared/truckRadarRules.ts';

const TYPES = new Set(['materii-prime', 'ambalaje', 'etichete']);

async function readSettings(cloud: any) {
  const { data, error } = await cloud.from('achizitii_radar_setari').select('settings, updated_by, updated_at').maybeSingle();
  if (error) throw error;
  return { settings: validRadarSettingsByType(data?.settings), updated_by: data?.updated_by ?? null, updated_at: data?.updated_at ?? null };
}

/** Settings of every warehouse (each has its own rules). */
export async function radarSettings(cloud: any) {
  return await readSettings(cloud);
}

/** Saves the rules of one warehouse, keeping the others. */
export async function saveRadarSettings(cloud: any, body: any, who: string) {
  const type = String(body?.inventory_type ?? '') as RadarInvType;
  if (!TYPES.has(type)) throw new Error('Depozit necunoscut.');
  const current = (await readSettings(cloud)).settings;
  const settings = { ...current, [type]: validRadarSettings(body?.settings, DEFAULT_RADAR_BY_TYPE[type]) };
  const { error } = await cloud.from('achizitii_radar_setari').upsert({ id: true, settings, updated_by: who, updated_at: new Date().toISOString() });
  if (error) throw error;
  return { settings };
}

/** Records new versions of the given supplier orders and returns the full history of those orders. */
export async function radarSnapshot(cloud: any, body: any) {
  const type = String(body?.inventory_type ?? '');
  if (!TYPES.has(type)) throw new Error('Depozit necunoscut.');
  const raw = Array.isArray(body?.orders) ? body.orders.slice(0, 5000) : [];
  const orders: SeenOrder[] = raw.map((o: any) => ({
    order_id: String(o?.order_id ?? '').slice(0, 64),
    product_id: o?.product_id ? String(o.product_id).slice(0, 64) : null,
    delivery_date: /^\d{4}-\d{2}-\d{2}$/.test(String(o?.delivery_date ?? '')) ? String(o.delivery_date) : null,
    quantity: Number(o?.quantity),
    status: o?.status ? String(o.status).slice(0, 30) : null,
  })).filter((o: SeenOrder) => o.order_id && Number.isFinite(o.quantity));
  const ids = orders.map((o) => o.order_id);
  const history: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await cloud.from('achizitii_comenzi_istoric')
        .select('order_id, product_id, delivery_date, quantity, status, seen_at')
        .eq('inventory_type', type).in('order_id', part).order('seen_at').order('id').range(from, from + 999);
      if (error) throw error;
      history.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  const last = new Map<string, SeenOrder>();
  history.forEach((h) => last.set(h.order_id, h));
  const fresh = changedOrders(orders, last);
  if (fresh.length) {
    const now = new Date().toISOString();
    const rows = fresh.map((o) => ({ ...o, inventory_type: type, seen_at: now }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await cloud.from('achizitii_comenzi_istoric').insert(rows.slice(i, i + 500));
      if (error) throw error;
    }
    history.push(...rows);
  }
  return { history, recorded: fresh.length };
}
