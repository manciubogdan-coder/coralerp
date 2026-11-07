// Pure rules, kept separate so they can be tested without the database client.
const SPECIAL = ['producție în avans', 'productie in avans', 'avans', 'productie_avans', 'producție_avans', 'reambalare'];

export function isDirectPickingOrder(order: any, ids: Set<string>): boolean {
  if (!order?.produs_id || !ids.has(String(order.produs_id))) return false;
  if (SPECIAL.includes(String(order.magazin || '').trim().toLowerCase())) return false;
  return !['PRODUCTIE_AVANS', 'REAMBALARE'].includes(String(order.tip_comanda || '').toUpperCase());
}

// Afișare: comanda nu are de produs nimic, deci nu aparține vreunei linii.
// O comandă deja pornită pe o linie (sesiune deschisă/produsă) rămâne neatinsă.
export function applyDirectPicking<T extends Record<string, any>>(order: T, ids: Set<string>): T {
  if (!isDirectPickingOrder(order, ids)) return order;
  if (!['pending', 'assigned'].includes(String(order.status || ''))) {
    return order.status === 'completed' ? { ...order, direct_picking: true } : order;
  }
  if (Number(order.cantitate_produsa_sesiuni || 0) > 0) return order;
  return { ...order, direct_picking: true, linie_id: null, productie_linii: null, status: 'completed' };
}
