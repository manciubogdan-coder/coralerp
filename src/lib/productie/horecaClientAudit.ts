import { horecaGroup, normalizeHoreca, type HorecaGroup } from '../../../supabase/functions/_shared/horecaRules';

type Client = { id: string; nume_magazin: string; punct_livrare?: string; nickname?: string };
type Order = { magazin: string; punct_livrare?: string; data_productie?: string; tip_comanda?: string };
export type ClientAuditRow = { id: string; name: string; point: string; nickname: string; group: HorecaGroup | null; orders: number; issue: 'missing' | 'conflict' | null; client?: Client };
const key = (name: string, point?: string) => `${normalizeHoreca(name)}||${normalizeHoreca(point || 'Standard')}`;

export function auditHorecaClients(clients: Client[], orders: Order[], day: string): ClientAuditRow[] {
  const rows: ClientAuditRow[] = clients.map(client => ({ id: client.id, name: client.nume_magazin,
    point: client.punct_livrare || 'Standard', nickname: client.nickname || '', group: horecaGroup(client.nickname), orders: 0, issue: null, client }));
  const exact = new Map<string, ClientAuditRow[]>();
  const stores = new Map<string, ClientAuditRow[]>();
  for (const row of rows) {
    const k = key(row.name, row.point); exact.set(k, [...(exact.get(k) || []), row]);
    const n = normalizeHoreca(row.name); stores.set(n, [...(stores.get(n) || []), row]);
  }
  for (const matches of exact.values()) if (new Set(matches.map(r => r.group)).size > 1) matches.forEach(r => { r.issue = 'conflict'; });
  const missing = new Map<string, ClientAuditRow>();
  for (const order of orders) {
    if (order.data_productie !== day || ['PRODUCTIE_AVANS', 'REAMBALARE'].includes(String(order.tip_comanda || order.magazin).toUpperCase())) continue;
    const k = key(order.magazin, order.punct_livrare);
    const matches = exact.get(k);
    if (matches) { matches.forEach(r => { r.orders++; }); continue; }
    const fallback = stores.get(normalizeHoreca(order.magazin));
    if (fallback && new Set(fallback.map(r => r.group)).size === 1) { fallback.forEach(r => { r.orders++; }); continue; }
    const row = missing.get(k) || { id: `missing:${k}`, name: order.magazin, point: order.punct_livrare || 'Standard', nickname: '', group: null, orders: 0, issue: fallback ? 'conflict' as const : 'missing' as const };
    row.orders++; missing.set(k, row);
  }
  return [...rows, ...missing.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro') || a.point.localeCompare(b.point, 'ro'));
}