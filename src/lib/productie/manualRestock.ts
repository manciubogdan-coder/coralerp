export function manualRestockPayload(productId: string, quantity: number, day: string) {
  if (!productId.trim()) throw new Error('Selectează un produs.');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Introdu o cantitate mai mare decât zero.');
  const parsed = new Date(`${day}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
    throw new Error('Alege o dată validă.');
  }
  return { produs_id: productId, cantitate_surplus: quantity, data_productie: day, status: 'disponibil', comanda_originala_id: null };
}