export const HORECA_LINE_ID = '7899a60d-62de-49b7-8d7f-7277e5b8bc4a';
export type HorecaGroup = string;
export type HorecaGroupDefinition = { id: string; name: string; aliases: string[] };
export const DEFAULT_HORECA_GROUPS: HorecaGroupDefinition[] = [
  { id: 'caterin', name: 'Caterin', aliases: ['Caterin'] },
  { id: 'mircea', name: 'Mircea', aliases: ['Mircea', 'Mircea HoReCa'] },
];
export const normalizeHoreca = (value: unknown) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Classification is based only on the configured client nickname. */
export function horecaGroup(nickname: unknown, groups = DEFAULT_HORECA_GROUPS): HorecaGroup | null {
  const name = normalizeHoreca(nickname);
  if (!name) return null;
  return groups.find(g => [g.name, ...g.aliases].some(a => normalizeHoreca(a) === name))?.name ?? null;
}

export const isHorecaLine = (line: { id?: string; nume?: string } | undefined) =>
  line?.id === HORECA_LINE_ID || normalizeHoreca(line?.nume) === 'horeca';

export function horecaOrderGroup(order: any): HorecaGroup | null {
  if (!order) return null;
  if (['PRODUCTIE_AVANS', 'REAMBALARE'].includes(String(order.tip_comanda || order.magazin).toUpperCase())) return null;
  if ('horeca_group' in order) return typeof order.horeca_group === 'string' && order.horeca_group.trim() ? order.horeca_group : null;
  return horecaGroup(order.productie_clienti?.nickname);
}

/** No name guessing: ambiguous delivery points cannot borrow another client's nickname. */
export function createHorecaClientLookup(clients: any[], definitions = DEFAULT_HORECA_GROUPS) {
  const exact = new Map<string, HorecaGroup | null>();
  const store = new Map<string, Set<HorecaGroup | null>>();
  const key = (name: unknown, point: unknown) => `${normalizeHoreca(name)}||${normalizeHoreca(point || 'Standard')}`;
  for (const client of clients) {
    const group = horecaGroup(client.nickname, definitions);
    const k = key(client.nume_magazin, client.punct_livrare);
    exact.set(k, exact.has(k) && exact.get(k) !== group ? null : group);
    const n = normalizeHoreca(client.nume_magazin);
    const groups = store.get(n) || new Set<HorecaGroup | null>();
    groups.add(group);
    store.set(n, groups);
  }
  return (order: any): HorecaGroup | null => {
    if (['PRODUCTIE_AVANS', 'REAMBALARE'].includes(String(order.tip_comanda || order.magazin).toUpperCase())) return null;
    const k = key(order.magazin, order.punct_livrare);
    if (exact.has(k)) return exact.get(k) ?? null;
    const groups = store.get(normalizeHoreca(order.magazin));
    return groups?.size === 1 ? [...groups][0] : null;
  };
}