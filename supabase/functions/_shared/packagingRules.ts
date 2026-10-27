export const packagingStoreKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\b(?:SRL|SA|DISCOUNT)\b/g, '').replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

export function packagingUnits(value: unknown): string | null {
  const text = String(value ?? '').trim().toUpperCase();
  const match = text.match(/^([1-9]\d*(?:\s*\+\s*[1-9]\d*)*)\s*(?:BUC(?:ATI)?\.?\s*\/?\s*BAX)?$/);
  return match ? match[1].replace(/\s/g, '') : null;
}

export type StorePackaging = {
  produs_id: string; magazin_key: string; magazin: string;
  senior_units: string | null; manual_units: string | null;
  senior_code?: string | null; senior_date?: string | null;
};

export function resolveStorePackaging(productId: string, store: string, rows: StorePackaging[]) {
  const key = packagingStoreKey(store);
  const candidates = rows.filter(r => r.produs_id === productId);
  const exact = candidates.find(r => r.magazin_key === key);
  if (exact) return packagingUnits(exact.manual_units ?? exact.senior_units);
  // No cross-store borrowing. Advance production can use a product value only if all stores agree.
  if (key !== 'PRODUCTIE AVANS') return null;
  const values = candidates.map(r => packagingUnits(r.manual_units ?? r.senior_units));
  return values.length && values.every(v => v && v === values[0]) ? values[0] : null;
}