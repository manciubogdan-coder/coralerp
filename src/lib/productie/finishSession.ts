export function validateSessionQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Introdu o cantitate validă, mai mare sau egală cu zero.');
  }
}

/** Only active sessions can transition; a stale form must never overwrite production. */
export async function claimSessionFinish(client: any, id: string, quantity: number, status: 'finalizata' | 'partial') {
  validateSessionQuantity(quantity);
  // The session column is whole units: a typed 8,4 would be rejected by the database.
  quantity = Math.round(quantity);
  const { data, error } = await client.from('productie_sesiuni_lucru')
    .update({ cantitate_produsa: quantity, status, ora_sfarsit: new Date().toISOString() })
    .eq('id', id).eq('status', 'activa').select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Sesiunea a fost deja încheiată. Cantitatea salvată nu a fost modificată. Reîncarcă lista comenzilor.');
  return data;
}
/**
 * Production quantities are stored as whole units (pieces or whole kg), while customer
 * orders can ask for fractions (e.g. 8,4 kg Iceberg). The amount that covers an order is
 * the order rounded to the nearest whole unit (8,4 → 8, 8,6 → 9), at least 1 for any
 * positive order (0,4 → 1), so a group of 8,4 + 1,2 + 5 kg closes with 14 kg.
 */
export const wholeUnits = (quantity: unknown) => {
  const q = Number(quantity || 0);
  return q > 1e-6 ? Math.max(1, Math.round(q)) : 0;
};

/**
 * Splits a group's produced total over its orders in whole units: each order gets what it
 * still needs (rounded up), the last one takes whatever is left.
 */
export function distributeGroupQuantity(needs: number[], total: number) {
  let remaining = Math.max(0, Math.round(Number(total) || 0));
  return needs.map((need, i) => {
    const assign = i === needs.length - 1 ? remaining : Math.min(wholeUnits(need), remaining);
    remaining -= assign;
    return assign;
  });
}
