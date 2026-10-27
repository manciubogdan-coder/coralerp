export type PackagingMethod = {
  client_name: string; product_name: string; weight: string;
  units_per_case: string; tertiary_packaging: string;
};
export type PackagingOrder = {
  magazin?: string; baxare?: string; cantitate: number;
  productie_clienti?: { nume?: string; nickname?: string };
  productie_produse?: { nume?: string };
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9+]/g, ' ').replace(/\s+/g, ' ').trim();

function retailer(value: string) {
  const text = normalize(value);
  if (/\bMETRO\b|\bMC\b/.test(text)) return /BULGARIA|\bBG\b/.test(text) ? 'METRO BG' : 'METRO RO';
  if (/MEGA IMAGE|\bMI\b/.test(text)) return 'MEGA IMAGE';
  return ['LIDL', 'KAUFLAND', 'CARREFOUR', 'AUCHAN', 'FRESHFUL', 'LINELLA', 'SELGROS', 'PENNY']
    .find(name => text.includes(name)) || text;
}

function product(value: string) {
  const text = normalize(value);
  const match = text.match(/\b(\d+)\s*(KG|GR|G)?\b/);
  if (!match) return null;
  const grams = Number(match[1]) * (match[2] === 'KG' ? 1000 : 1);
  let family = text.replace(match[0], ' ').replace(/\b(?:SALATA|SALATE|MIX|MC|MI|PG|LIDL|KAUFLAND|CARREFOUR|AUCHAN|NOU)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (family === 'SPANAC BABY') family = 'BABY SPANAC';
  if (family === 'FETICA VALERIANA') family = 'VALERIANA';
  return { family, grams };
}

export function findOrderPackaging(order: PackagingOrder, methods: PackagingMethod[]) {
  const identity = product(order.productie_produse?.nume || '');
  if (!identity) return undefined;
  // Store is authoritative; the client relation is only a fallback, never a product suffix.
  const store = retailer(order.magazin || '');
  const client = retailer(order.productie_clienti?.nume || '');
  const candidates = methods.filter(method => {
    const source = product(`${method.product_name} ${method.weight}`);
    return source?.family === identity.family && source.grams === identity.grams;
  });
  const storeMatches = candidates.filter(method => retailer(method.client_name) === store);
  const knownStore = methods.some(method => retailer(method.client_name) === store);
  const matches = knownStore ? storeMatches : candidates.filter(method => retailer(method.client_name) === client);
  // Duplicate regional rows are fine only when their packaging agrees.
  if (!matches.length || new Set(matches.map(m => `${m.units_per_case}|${m.tertiary_packaging}`)).size > 1) return undefined;
  return matches[0];
}

export function packagingQuantity(quantity: number, units: string) {
  // Assortments such as 6+2 are shared cartons; don't invent a per-product carton total.
  if (!/^\d+$/.test(units.trim())) return null;
  const perCase = Number(units);
  if (perCase <= 0 || !Number.isFinite(quantity) || quantity < 0) return null;
  return { fullCases: Math.floor(quantity / perCase), looseUnits: quantity % perCase };
}