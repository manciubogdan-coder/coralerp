export function validateSessionQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Introdu o cantitate validă, mai mare sau egală cu zero.');
  }
}

/** Only active sessions can transition; a stale form must never overwrite production. */
export async function claimSessionFinish(client: any, id: string, quantity: number, status: 'finalizata' | 'partial') {
  validateSessionQuantity(quantity);
  const { data, error } = await client.from('productie_sesiuni_lucru')
    .update({ cantitate_produsa: quantity, status, ora_sfarsit: new Date().toISOString() })
    .eq('id', id).eq('status', 'activa').select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Sesiunea a fost deja încheiată. Cantitatea salvată nu a fost modificată. Reîncarcă lista comenzilor.');
  return data;
}