export type SupplierPricePeriod = {
  id: string;
  supplier: string;
  validFrom: string;
  validTo: string;
  items: { product: string; category: string; price: number }[];
};

export function validPriceDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Both endpoints are inclusive; reject ambiguity instead of guessing which contract wins. */
export function validatePricePeriods(periods: SupplierPricePeriod[]): void {
  const ids = new Set<string>();
  for (const p of periods) {
    if (!p.id || ids.has(p.id)) throw new Error('Identificator de listă lipsă sau duplicat.');
    ids.add(p.id);
    if (!p.supplier.trim() || !validPriceDay(p.validFrom) || !validPriceDay(p.validTo) || p.validFrom > p.validTo)
      throw new Error('Completează furnizorul și perioada de valabilitate corectă pentru fiecare listă.');
    const products = new Set<string>();
    if (!p.items.length) throw new Error(`Lista ${p.supplier} nu conține prețuri.`);
    for (const item of p.items) {
      const key = item.product.trim().toUpperCase();
      if (!key || products.has(key) || !Number.isFinite(item.price) || item.price <= 0 || item.price >= 10000)
        throw new Error(`Produs duplicat sau preț invalid în lista ${p.supplier}.`);
      products.add(key);
    }
  }
  for (let i = 0; i < periods.length; i++) for (let j = i + 1; j < periods.length; j++) {
    const a = periods[i], b = periods[j];
    if (a.supplier.trim().toUpperCase() === b.supplier.trim().toUpperCase() && a.validFrom <= b.validTo && b.validFrom <= a.validTo)
      throw new Error(`Perioadele furnizorului ${a.supplier} se suprapun. Închide lista veche înainte de începutul celei noi.`);
  }
}