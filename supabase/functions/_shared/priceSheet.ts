// Deterministic price sheet (per case and per piece). Pure: shared by the calculator screen and Argus.

export type ComponentKind = "mp" | "ambalaj";

export interface SheetComponent {
  id: number;
  name: string;
  qty: number; // recipe quantity per case (Senior recipe output = one case)
  unit: string;
  kind: ComponentKind;
  price: number | null; // RON per recipe unit
  priceSource: string;
  lossPct: number; // raw materials only: technological loss, 19 = 19%
  lossSource?: string;
}

export interface SheetRates {
  labourPerPiece: number;
  utilitiesPerPiece: number;
  supplyPerKg: number;
  distributionPerPiece: number;
  clientFeePerPiece: number;
  eurRate: number;
  eurBufferPct: number;
  techLossPct: number;
  marginPct: number;
}

export interface SheetLine { label: string; detail: string; value: number; group: "mp" | "transport" | "ambalaj" | "manopera" | "utilitati" | "pierdere"; missing?: boolean }

export interface PriceSheet {
  unitsPerCase: number;
  lines: SheetLine[];
  rawMaterial: number;
  supplyTransport: number;
  packaging: number;
  labour: number;
  utilities: number;
  techLoss: number;
  productionCost: number;
  factoryGate: number;
  logistics: number;
  delivered: number;
  clientFees: number;
  clientPrice: number;
  eurEffective: number;
  clientPriceEur: number;
  perPiece: { productionCost: number; factoryGate: number; delivered: number; clientPrice: number; clientPriceEur: number };
  missingPrices: string[];
}

const SERVICE_RE = /\b(MANOPERA|CHELTUIELI|SERVICI|TRANSPORT)\b/i;
const PACKAGING_RE = /\b(FOLIE|FILM|PUNG|BANDA|SFOARA|ETICHET|CASEROL|CUTI|CAPAC|PALET|LADIT|SAC|TAVITA|BOL)/i;

/** Senior recipe rows that are services (labour/overheads) are priced from the journal, not as components. */
export const isServiceComponent = (name: string) => SERVICE_RE.test(name);

/** Raw material = weighed (KG) and not a packaging material. */
export function componentKind(name: string, unit: string): ComponentKind {
  return /^kg$/i.test(unit.trim()) && !PACKAGING_RE.test(name) ? "mp" : "ambalaj";
}

/** Recipe quantity → quantity actually consumed after technological loss. 0.6 kg at 19% → 0.7407 kg. */
export function effectiveQty(qty: number, lossPct: number) {
  const l = Math.min(Math.max(lossPct || 0, 0), 95) / 100;
  return qty / (1 - l);
}

/** Selling price from cost with a gross margin on the selling price: cost / (1 − m). */
export function withMargin(cost: number, marginPct: number) {
  const m = Math.min(Math.max(marginPct || 0, 0), 95) / 100;
  return cost / (1 - m);
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

export function computeSheet(input: { unitsPerCase: number; components: SheetComponent[]; rates: SheetRates }): PriceSheet {
  const n = input.unitsPerCase > 0 ? input.unitsPerCase : 1;
  const R = input.rates;
  const lines: SheetLine[] = [];
  const missingPrices: string[] = [];
  let rawMaterial = 0, packaging = 0, kgEffective = 0;
  for (const c of input.components) {
    const price = c.price ?? 0;
    if (c.price == null) missingPrices.push(c.name);
    if (c.kind === "mp") {
      const eff = effectiveQty(c.qty, c.lossPct);
      if (/^kg$/i.test(c.unit)) kgEffective += eff;
      const v = eff * price;
      rawMaterial += v;
      lines.push({ group: "mp", label: c.name, value: r4(v), missing: c.price == null,
        detail: `${r4(eff)} ${c.unit} × ${r4(price)} RON (${c.priceSource}); pierdere ${c.lossPct || 0}% (rețetă ${r4(c.qty)} → efectiv ${r4(eff)})` });
    } else {
      const v = c.qty * price;
      packaging += v;
      lines.push({ group: "ambalaj", label: c.name, value: r4(v), missing: c.price == null,
        detail: `${r4(c.qty)} ${c.unit} × ${r4(price)} RON (${c.priceSource})` });
    }
  }
  const supplyTransport = kgEffective * R.supplyPerKg;
  lines.push({ group: "transport", label: "Transport aprovizionare", value: r4(supplyTransport), detail: `${r4(kgEffective)} kg × ${r4(R.supplyPerKg)} RON/kg` });
  const labour = n * R.labourPerPiece;
  lines.push({ group: "manopera", label: "Manoperă", value: r4(labour), detail: `${r4(R.labourPerPiece)} RON/buc × ${n} buc` });
  const utilities = n * R.utilitiesPerPiece;
  lines.push({ group: "utilitati", label: "Cheltuieli utilități și hală", value: r4(utilities), detail: `${r4(R.utilitiesPerPiece)} RON/buc × ${n} buc` });
  const subtotal = rawMaterial + supplyTransport + packaging + labour + utilities;
  const techLoss = subtotal * Math.max(R.techLossPct || 0, 0) / 100;
  lines.push({ group: "pierdere", label: "Pierdere tehnologică", value: r4(techLoss), detail: `${R.techLossPct || 0}% din costurile de mai sus` });
  const productionCost = subtotal + techLoss;
  const factoryGate = withMargin(productionCost, R.marginPct);
  const logistics = n * R.distributionPerPiece;
  const delivered = factoryGate + logistics;
  const clientFees = n * R.clientFeePerPiece;
  const clientPrice = delivered + clientFees;
  const eurEffective = R.eurRate * (1 + (R.eurBufferPct || 0) / 100);
  const clientPriceEur = eurEffective > 0 ? clientPrice / eurEffective : 0;
  return {
    unitsPerCase: n, lines, missingPrices,
    rawMaterial: r4(rawMaterial), supplyTransport: r4(supplyTransport), packaging: r4(packaging), labour: r4(labour),
    utilities: r4(utilities), techLoss: r4(techLoss), productionCost: r4(productionCost), factoryGate: r4(factoryGate),
    logistics: r4(logistics), delivered: r4(delivered), clientFees: r4(clientFees), clientPrice: r4(clientPrice),
    eurEffective: r4(eurEffective), clientPriceEur: r4(clientPriceEur),
    perPiece: {
      productionCost: r4(productionCost / n), factoryGate: r4(factoryGate / n), delivered: r4(delivered / n),
      clientPrice: r4(clientPrice / n), clientPriceEur: r4(clientPriceEur / n),
    },
  };
}

/** Rate per unit from a Senior total and its volume; null when there is no volume. */
export const ratePer = (total: number, volume: number) => (volume > 0 ? total / volume : null);

/** Twelve whole months ending the month before the chosen one, as YYYYMM ints and ISO day bounds. */
export function ratePeriod(year: number, month: number) {
  const end = new Date(Date.UTC(year, month - 1, 1)); // exclusive
  const start = new Date(Date.UTC(year, month - 13, 1));
  const ym = (d: Date) => d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;
  const last = new Date(Date.UTC(year, month - 2, 1));
  return { from: ym(start), to: ym(last), startDay: start.toISOString().slice(0, 10), endDay: end.toISOString().slice(0, 10) };
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\bvrac\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Technological loss from Coral ERP raw-material settings: exact name, else the longest app name contained in the Senior name. */
export function matchLoss(seniorName: string, products: Array<{ name: string; pt_percent: number | null }>) {
  const s = norm(seniorName);
  let best: { name: string; pt: number } | null = null;
  for (const p of products) {
    if (p.pt_percent == null) continue;
    const a = norm(p.name);
    if (!a) continue;
    if (a === s) return { name: p.name, pt: Number(p.pt_percent) };
    if ((s.includes(a) || a.includes(s)) && (!best || a.length > norm(best.name).length)) best = { name: p.name, pt: Number(p.pt_percent) };
  }
  return best;
}

