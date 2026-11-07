// Scenario inputs shared by the screen, chat tool and saved live price sheets.
import { computeSheet, type SheetComponent, type SheetRates } from "./priceSheet.ts";
import { MIXED_WASHED, lineRates, priceRules } from "./priceRules.ts";
export { MIXED_WASHED };

/** Production lines of the active rules (people, speed, cost per person-hour) with their per-piece tariffs. */
export function labourLines() {
  return priceRules().lines.map((l) => ({ ...l, ...lineRates(l) }));
}
/** Default factory overhead % of the active rules. */
export const labourOverheadPct = () => priceRules().labourOverheadPct;
const lineOverheadPct = (l: { overheadPct?: number }) => l.overheadPct ?? labourOverheadPct();
/** A screen value rounded to 4 decimals that was not really changed keeps the exact rule value. */
const same = (typed: number | undefined, exact: number) => (typed != null && Math.abs(typed - exact) > 0.0001 ? typed : exact);
/** Lei per person-hour of a line in the active rules. */
export function lineHourCost(name: string) {
  return priceRules().lines.find((x) => x.name === name)?.hourCost ?? null;
}
/** Editable formula inputs for a line, prefilled from the rules. */
export function labourDefaults(name?: string) {
  const l = priceRules().lines.find((x) => x.name === name);
  if (!l) return {};
  return { labourPeople: l.people, ...(l.speed ? { labourSpeed: l.speed } : {}), labourHourCost: Math.round(l.hourCost * 10000) / 10000, labourOverheadPct: Math.round(lineOverheadPct(l) * 10000) / 10000 };
}
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
/** Labour per piece: people × lei/person-hour ÷ pieces/hour, + factory overhead %; rule values unless typed for the product. */
export function lineLabour(cfg: PriceConfig): { direct: number; overhead: number; detail: string } | null {
  const l = priceRules().lines.find((x) => x.name === cfg.labourLine);
  if (!l) return null;
  const people = cfg.labourPeople ?? l.people, speed = cfg.labourSpeed ?? l.speed ?? undefined;
  // Hour cost typed as rounded 4 decimals on screen: keep the exact rule value when it was not really changed.
  const hour = same(cfg.labourHourCost, l.hourCost);
  const pct = same(cfg.labourOverheadPct, lineOverheadPct(l));
  if (!people || !speed || !hour) return null;
  const direct = (people * hour) / speed;
  return { direct, overhead: (direct * pct) / 100, detail: `${people} oameni × ${round(hour, 2)} lei/oră ÷ ${speed} buc/oră = ${round(direct, 4)} lei/buc + regie ${round(pct, 2)}% (Reguli de calcul · ${l.name})` };
}
export const ROUTES = ["România", "Bulgaria", "Moldova"] as const;
/** Cursă names seen on Senior carrier invoices (Oct 2026); the calculator lists the month's actual ones. */
export const SENIOR_ROUTES = ["BUCURESTI", "PLOIESTI", "ROMAN", "TURDA", "TURDA-IERNUT", "LUGOJ", "TIMISOARA", "CRAIOVA", "FOCSANI", "HORECA", "BULGARIA", "MOLDOVA ICS"] as const;
export type PriceConfig = {
  year?: number;
  month?: number;
  rawPriceMode?: "annual" | "week";
  labourLine?: string;
  route?: string;
  unitsPerCase?: number;
  piecesPerPallet?: number;
  supplyPerPallet?: number;
  distributionPerPallet?: number;
  supplyTotal?: number;
  supplyPallets?: number;
  distributionTotal?: number;
  distributionPallets?: number;
  distributionTrips?: number;
  distributionPalletsPerTrip?: number;
  feePct?: number;
  supplyKg?: number;
  supplyBasis?: "pallet" | "kg";
  labourPeople?: number;
  labourSpeed?: number;
  labourHourCost?: number;
  labourOverheadPct?: number;
  /** Semi-finished good resold as it is: no direct labour, only factory overhead. */
  tradedGood?: boolean;
  rates?: Partial<SheetRates>;
  components?: Record<string, { price?: number; qty?: number; lossPct?: number; kgPerPallet?: number; piecesPerPallet?: number }>;
};
export const RATE_KEYS = ["labourPerPiece", "utilitiesPerPiece", "supplyPerKg", "distributionPerPiece", "clientFeePerPiece", "eurRate", "eurBufferPct", "techLossPct", "marginPct", "profitPct"] as const;
export const CONFIG_NUMBERS = ["unitsPerCase", "piecesPerPallet", "supplyPerPallet", "distributionPerPallet", "supplyTotal", "supplyPallets", "distributionTotal", "distributionPallets", "distributionTrips", "distributionPalletsPerTrip", "feePct", "supplyKg", "labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"] as const;

export function validPriceConfig(raw: unknown): PriceConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, any>, out: PriceConfig = {};
  const numeric = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e9;
  if (r.year != null) { if (!Number.isInteger(r.year) || r.year < 2016 || r.year > 2099) return null; out.year = r.year; }
  if (r.month != null) { if (!Number.isInteger(r.month) || r.month < 1 || r.month > 12) return null; out.month = r.month; }
  if (r.rawPriceMode != null) {
    if (!["annual", "week"].includes(r.rawPriceMode)) return null;
    out.rawPriceMode = r.rawPriceMode;
  }
  if (r.supplyBasis != null) {
    if (!["pallet", "kg"].includes(r.supplyBasis)) return null;
    out.supplyBasis = r.supplyBasis;
  }
  if (r.tradedGood != null) {
    if (typeof r.tradedGood !== "boolean") return null;
    out.tradedGood = r.tradedGood;
  }
  if (r.route != null) {
    // Country averages (legacy) or a Senior cursă key such as "BUCURESTI" / "TURDA-IERNUT".
    if (typeof r.route !== "string" || !(ROUTES as readonly string[]).includes(r.route) && !/^[A-Z0-9][A-Z0-9 .\-]{0,59}$/.test(r.route)) return null;
    out.route = r.route;
  }
  if (r.labourLine != null) {
    // Line names come from the editable rules; an unknown line is reported as missing labour, not rejected.
    if (typeof r.labourLine !== "string" || !r.labourLine.trim() || r.labourLine.length > 60) return null;
    out.labourLine = r.labourLine;
  }
  for (const k of CONFIG_NUMBERS) if (r[k] != null) {
    if (!numeric(r[k]) || (k === "feePct" && r[k] >= 100) || (["unitsPerCase", "piecesPerPallet", "labourPeople", "labourSpeed", "distributionPalletsPerTrip"].includes(k) && r[k] === 0) || (k === "labourOverheadPct" && r[k] >= 1000)) return null;
    out[k] = r[k];
  }
  if (r.rates != null) {
    if (typeof r.rates !== "object" || Array.isArray(r.rates)) return null;
    out.rates = {};
    for (const k of RATE_KEYS) if (r.rates[k] != null) {
      if (!numeric(r.rates[k]) || (["marginPct", "techLossPct", "profitPct"].includes(k) && r.rates[k] >= 100)) return null;
      out.rates[k] = r.rates[k];
    }
  }
  if (r.components != null) {
    if (typeof r.components !== "object" || Array.isArray(r.components) || Object.keys(r.components).length > 200) return null;
    out.components = {};
    for (const [id, row] of Object.entries(r.components) as Array<[string, any]>) {
      if (!/^\d+$/.test(id) || !row || typeof row !== "object") return null;
      const c: NonNullable<PriceConfig["components"]>[string] = {};
      for (const k of ["price", "qty", "lossPct", "kgPerPallet", "piecesPerPallet"] as const) if (row[k] != null) {
        if (!numeric(row[k]) || (k === "lossPct" && row[k] >= 100) || ((k === "kgPerPallet" || k === "piecesPerPallet") && row[k] === 0)) return null;
        c[k] = row[k];
      }
      out.components[id] = c;
    }
  }
  return out;
}

export function configuredSheet(d: { product: { unitsPerCase: number }; components: SheetComponent[] }, defaults: SheetRates, config?: PriceConfig) {
  const cfg = config ?? {};
  const lab = lineLabour(cfg);
  // Traded goods keep only the line's factory overhead; direct labour is 0 unless typed.
  const traded = cfg.tradedGood === true;
  const rates = { ...defaults, ...(lab ? { labourPerPiece: traded ? 0 : lab.direct, utilitiesPerPiece: lab.overhead } : {}), ...cfg.rates };
  const labourDetail = cfg.rates?.labourPerPiece != null ? "tarif manual" : traded ? `marfă revândută ca atare: fără manoperă directă, doar regie${lab ? ` (${lab.detail})` : ""}` : lab?.detail;
  const components = d.components.map((c) => {
    const o = cfg.components?.[String(c.id)];
    return { ...c, ...o, priceSource: o?.price != null ? "preț manual / scenariu" : c.priceSource, ...(o?.lossPct != null ? { lossSource: "PT manual / scenariu" } : {}) };
  });
  const sheet = computeSheet({ unitsPerCase: cfg.unitsPerCase ?? d.product.unitsPerCase, components, rates: {
    ...rates, feePct: cfg.feePct ?? 0,
    ...(cfg.supplyPerPallet != null ? { supplyPerPallet: cfg.supplyPerPallet } : cfg.supplyTotal != null && (cfg.supplyPallets ?? 0) > 0 ? { supplyPerPallet: cfg.supplyTotal / (cfg.supplyPallets ?? 1) } : {}),
    ...(cfg.distributionPerPallet != null ? { distributionPerPallet: cfg.distributionPerPallet } : cfg.distributionTotal != null && (cfg.distributionPallets ?? 0) > 0 ? { distributionPerPallet: cfg.distributionTotal / (cfg.distributionPallets ?? 1) } : {}),
    ...(cfg.piecesPerPallet != null ? { piecesPerPallet: cfg.piecesPerPallet } : {}),
    supplyBasis: cfg.supplyBasis ?? (cfg.supplyPerPallet != null ? "pallet" : "kg"), labourDetail,
  } });
  const line = priceRules().lines.find((l) => l.name === cfg.labourLine);
  if (!cfg.labourLine && cfg.rates?.labourPerPiece == null) sheet.missingInputs.push("Linie / tarif manoperă");
  if (cfg.labourLine && !line && cfg.rates?.labourPerPiece == null) sheet.missingInputs.push(`Linia „${cfg.labourLine}” nu mai există în Reguli de calcul`);
  if (line && !lab && cfg.rates?.labourPerPiece == null) sheet.missingInputs.push(line.name === MIXED_WASHED ? "Viteză linie mixte spălate (buc/oră, conform mix)" : "Oameni, viteză și cost orar manoperă");
  if (cfg.rates?.labourPerPiece != null && cfg.rates?.utilitiesPerPiece == null && !lab) sheet.missingInputs.push("Regie fabrică manuală");
  const basis = cfg.supplyBasis ?? (cfg.supplyPerPallet != null ? "pallet" : "kg");
  if (basis === "pallet" && cfg.supplyPerPallet == null) sheet.missingInputs.push("Cost aprovizionare/palet (cost pe camion ÷ paleți pe camion)");
  if (basis === "kg" && !(cfg.rates?.supplyPerKg != null && cfg.rates.supplyPerKg > 0)) sheet.missingInputs.push("Cost aprovizionare/kg (cost pe camion ÷ kg pe camion)");
  if (cfg.distributionPerPallet == null && !(cfg.distributionTotal != null && (cfg.distributionPallets ?? 0) > 0)) sheet.missingInputs.push(`Cost distribuție/palet · cursa ${cfg.route ?? "nealeasă"} (completează paleți pe cursă sau tariful)`);
  for (const c of components) if (c.lossSource?.startsWith("PT nesetat") && cfg.components?.[String(c.id)]?.lossPct == null) sheet.missingInputs.push(`PT ${c.name}`);
  if (cfg.feePct == null && cfg.rates?.clientFeePerPiece == null) sheet.missingInputs.push("Taxe client % (nu există vânzări din care să le calculez)");
  sheet.complete = !sheet.missingInputs.length && !sheet.missingPrices.length;
  return { sheet, components, rates };
}