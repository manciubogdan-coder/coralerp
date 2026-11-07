// Deterministic price sheet (per case and per piece). Pure: shared by the calculator screen and Argus.
import type { PriceSafety } from './priceSafetyRules.ts';
import { tradedGood } from './priceSourceRules.ts';

/** mp = weighed raw material; marfa = semi-finished good bought and resold as it is (in pieces); ambalaj = packaging/labels. */
export type ComponentKind = "mp" | "marfa" | "ambalaj";

export interface SheetComponent {
  id: number;
  name: string;
  qty: number; // recipe quantity per case (Senior recipe output = one case)
  unit: string;
  kind: ComponentKind;
  price: number | null; // RON per recipe unit
  priceSource: string;
  lossPct: number;
  kgPerPallet?: number;
  /** Traded goods: pieces per supply pallet. */
  piecesPerPallet?: number;
  annualPrice?: number | null;
  weekPrice?: number | null;
  lastPrice?: number | null;
  priceSafety?: PriceSafety;
  lossSource?: string;
  /** Where kg per pallet comes from (configured Coral category or receptions average). */
  palletSource?: string;
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
  /** Target profitability % of the proposed price, on top of the break-even (minimum) price. */
  profitPct?: number;
  supplyPerPallet?: number;
  distributionPerPallet?: number;
  piecesPerPallet?: number;
  feePct?: number;
  supplyBasis?: "pallet" | "kg";
  labourDetail?: string;
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
  /** Production cost + distribution: the base of the gross margin. */
  factoryGate: number;
  logistics: number;
  /** Minimum price + target profit, before network fees. */
  delivered: number;
  clientFees: number;
  /** Proposed price with network fees included: (minimum price + profit) ÷ (1 − fee%). */
  clientPrice: number;
  /** Break-even selling price, without fees: (production cost + distribution) × (1 + gross margin %). */
  minPrice: number;
  /** Target profit = profit % of the minimum price. */
  profit: number;
  profitPct: number;
  eurEffective: number;
  clientPriceEur: number;
  /** Gross margin % of (production cost + distribution), treated as a factory cost. */
  grossMargin: number;
  feePct: number;
  clientFeePerPiece: number;
  perPiece: { minPrice: number; profit: number; productionCost: number; factoryGate: number; delivered: number; clientPrice: number; clientPriceEur: number; grossMargin: number; logistics: number; fees: number };
  missingPrices: string[];
  missingInputs: string[];
  complete: boolean;
}

const SERVICE_RE = /\b(MANOPERA|CHELTUIELI|SERVICI|TRANSPORT)\b/i;
const PACKAGING_RE = /\b(FOLIE|FILM|PUNG|BANDA|SFOARA|ETICHET|CASEROL|CUTI|CAPAC|PALET|LADIT|SAC|TAVITA|BOL)/i;

/** Senior recipe rows that are services (labour/overheads) are priced from the journal, not as components. */
export const isServiceComponent = (name: string) => SERVICE_RE.test(name);

/** Raw material = weighed (KG) and not a packaging material. */
export function componentKind(name: string, unit: string): ComponentKind {
  if (PACKAGING_RE.test(name)) return "ambalaj";
  if (/^kg$/i.test(unit.trim())) return "mp";
  return tradedGood(name) ? "marfa" : "ambalaj";
}
/** Net grams per piece from a name such as "BABY SPANAC BIO 100 GR". */
export function gramsPerPiece(name: string): number | null {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*(G|GR|GRAME)\b/i);
  const g = m ? Number(m[1].replace(",", ".")) : NaN;
  return g > 0 ? g : null;
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
  const missingInputs: string[] = [];
  let supplyPallets = 0;
  let rawMaterial = 0, packaging = 0, kgEffective = 0;
  const basis = R.supplyBasis ?? (R.supplyPerPallet != null ? "pallet" : "kg");
  for (const c of input.components) {
    const price = c.price ?? 0;
    if (c.price == null) missingPrices.push(c.name);
    if (c.kind === "marfa") {
      // Bought ready-packed and resold as is: supply pallets from pieces, kg from the grams in its name.
      const eff = effectiveQty(c.qty, c.lossPct);
      const ppp = c.piecesPerPallet ?? 0;
      if (ppp > 0) supplyPallets += eff / ppp;
      else if (basis === "pallet") missingInputs.push(`buc/palet: ${c.name}`);
      const g = gramsPerPiece(c.name);
      if (g) kgEffective += eff * g / 1000;
      else if (basis === "kg") missingInputs.push(`grame/buc: ${c.name}`);
      const v = eff * price;
      rawMaterial += v;
      lines.push({ group: "mp", label: c.name, value: r4(v), missing: c.price == null,
        detail: `marfă revândută ca atare: ${r4(eff)} ${c.unit} × ${r4(price)} RON (${c.priceSource})${c.lossPct ? `; pierdere ${c.lossPct}%` : ""}${ppp > 0 ? `; ${r4(eff)} buc ÷ ${ppp} buc/palet = ${r4(eff / ppp)} paleți aprovizionare` : ""}` });
    } else if (c.kind === "mp") {
      const eff = effectiveQty(c.qty, c.lossPct);
      if (/^kg$/i.test(c.unit)) kgEffective += eff;
      if (/^kg$/i.test(c.unit)) {
        if ((c.kgPerPallet ?? 0) > 0) supplyPallets += eff / (c.kgPerPallet ?? 1);
        else if (basis === "pallet") missingInputs.push(`kg/palet: ${c.name}`);
      }
      const v = eff * price;
      rawMaterial += v;
      lines.push({ group: "mp", label: c.name, value: r4(v), missing: c.price == null,
        detail: `${r4(eff)} ${c.unit} × ${r4(price)} RON (${c.priceSource}); pierdere ${c.lossPct || 0}% (rețetă ${r4(c.qty)} → efectiv ${r4(eff)})` });
    } else {
      const v = c.qty * price * (1 + Math.max(c.lossPct || 0, 0) / 100);
      packaging += v;
      lines.push({ group: "ambalaj", label: c.name, value: r4(v), missing: c.price == null,
        detail: `${r4(c.qty)} ${c.unit} × ${r4(price)} RON × (1 + ${c.lossPct || 0}% PT ambalaj) (${c.priceSource})` });
    }
  }
  const byPallet = R.supplyPerPallet != null ? supplyPallets * R.supplyPerPallet : null;
  const byKg = R.supplyPerKg > 0 ? kgEffective * R.supplyPerKg : null;
  const supplyTransport = (basis === "pallet" ? byPallet : byKg) ?? 0;
  const palletText = byPallet != null ? `pe palet: ${r4(supplyPallets)} paleți aprovizionare × ${r4(R.supplyPerPallet ?? 0)} = ${r4(byPallet)} RON` : "pe palet: tarif lipsă";
  const kgText = byKg != null ? `pe kg: ${r4(kgEffective)} kg × ${r4(R.supplyPerKg)} = ${r4(byKg)} RON` : "pe kg: tarif lipsă";
  lines.push({ group: "transport", label: "Transport aprovizionare", value: r4(supplyTransport), detail: `${palletText} · ${kgText} · în total: ${basis === "pallet" ? "pe palet" : "pe kg"}` });
  const labour = n * R.labourPerPiece;
  lines.push({ group: "manopera", label: "Manoperă directă", value: r4(labour), detail: `${r4(R.labourPerPiece)} RON/buc × ${n} buc${R.labourDetail ? ` (${R.labourDetail})` : ""}` });
  const utilities = n * R.utilitiesPerPiece;
  lines.push({ group: "utilitati", label: "Regie fabrică (manoperă)", value: r4(utilities), detail: `${r4(R.utilitiesPerPiece)} RON/buc × ${n} buc · total manoperă ${r4(R.labourPerPiece + R.utilitiesPerPiece)} RON/buc` });
  const subtotal = rawMaterial + supplyTransport + packaging + labour + utilities;
  const techLoss = subtotal * Math.max(R.techLossPct || 0, 0) / 100;
  lines.push({ group: "pierdere", label: "Pierdere suplimentară scenariu", value: r4(techLoss), detail: `${R.techLossPct || 0}% din costurile de mai sus (PT pe materii prime/ambalaje este deja inclusă pe rânduri)` });
  const productionCost = subtotal + techLoss;
  if (R.distributionPerPallet != null && !(R.piecesPerPallet && R.piecesPerPallet > 0)) missingInputs.push("Bucăți produs finit/palet");
  const logistics = R.distributionPerPallet != null ? (R.piecesPerPallet && R.piecesPerPallet > 0 ? n / R.piecesPerPallet * R.distributionPerPallet : 0) : n * R.distributionPerPiece;
  // Gross margin = margin % of (production cost + distribution); minimum price = that cost + margin (break-even, no fees).
  const costBase = productionCost + logistics;
  // Margin and profit are % of the selling price without fees: price = cost ÷ (1 − margin% − profit%).
  const feeP = Math.min(Math.max(R.feePct ?? 0, 0), 89), profitP = Math.min(Math.max(R.profitPct ?? 0, 0), 89);
  const marginP = Math.min(Math.max(R.marginPct || 0, 0), 95);
  const keep = Math.max(1 - (marginP + profitP) / 100, 0.05);
  const delivered = costBase / keep;
  const grossMargin = delivered * marginP / 100;
  const minPrice = costBase + grossMargin;
  const profit = delivered * profitP / 100;
  const clientPrice = (delivered + n * R.clientFeePerPiece) / (1 - feeP / 100);
  const clientFees = clientPrice - delivered;
  const factoryGate = costBase;
  const eurEffective = R.eurRate * (1 + (R.eurBufferPct || 0) / 100);
  const clientPriceEur = eurEffective > 0 ? clientPrice / eurEffective : 0;
  return {
    unitsPerCase: n, lines, missingPrices, missingInputs, complete: !missingPrices.length && !missingInputs.length,
    rawMaterial: r4(rawMaterial), supplyTransport: r4(supplyTransport), packaging: r4(packaging), labour: r4(labour),
    utilities: r4(utilities), techLoss: r4(techLoss), productionCost: r4(productionCost), factoryGate: r4(factoryGate),
    logistics: r4(logistics), delivered: r4(delivered), clientFees: r4(clientFees), clientPrice: r4(clientPrice),
    eurEffective: r4(eurEffective), clientPriceEur: r4(clientPriceEur), minPrice: r4(minPrice), profit: r4(profit), profitPct: profitP,
    grossMargin: r4(grossMargin), feePct: R.feePct ?? 0, clientFeePerPiece: R.clientFeePerPiece || 0,
    perPiece: {
      minPrice: r4(minPrice / n), profit: r4(profit / n),
      productionCost: r4(productionCost / n), factoryGate: r4(factoryGate / n), delivered: r4(delivered / n),
      clientPrice: r4(clientPrice / n), clientPriceEur: r4(clientPriceEur / n),
      grossMargin: r4(grossMargin / n), logistics: r4(logistics / n), fees: r4(clientFees / n),
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

/** Names compared without accents, apostrophes, "vrac" and doubled letters: "BULL'S BLOOD VRAC" = "Bulls Blod", "LATUGA ROSA" = "Latuga Rossa". */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’`]/g, "").replace(/\bvrac\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/([a-z])\1+/g, "$1").replace(/\s+/g, " ").trim();

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

