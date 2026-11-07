// Scenario inputs shared by the screen, chat tool and saved live price sheets.
import { computeSheet, type SheetComponent, type SheetRates } from "./priceSheet.ts";

// Source: Cost_manopera_oct_2026.csv (people, hourly speed, direct, factory overhead +41%).
export const LABOUR_OVERHEAD_PCT = 41;
export const MIXED_WASHED = "Multihead — Mixte SPĂLATE";
export const LABOUR_LINES: ReadonlyArray<{ name: string; people: number; speed: number | null; direct: number | null; overhead: number | null; total: number | null; note?: string }> = [
  { name: "Giostra", people: 4, speed: 915, direct: 0.151, overhead: 0.062, total: 0.213 },
  { name: "Flowpack", people: 8, speed: 915, direct: 0.302, overhead: 0.124, total: 0.426 },
  { name: "Multihead — Monoprodus", people: 6, speed: 975, direct: 0.212, overhead: 0.087, total: 0.299 },
  { name: "Spanac Mare", people: 3, speed: 258, direct: 0.401, overhead: 0.165, total: 0.566 },
  { name: "Aromate", people: 8, speed: 500, direct: 0.552, overhead: 0.226, total: 0.778 },
  { name: "Vracuri / Gastro", people: 2, speed: 120, direct: 0.575, overhead: 0.236, total: 0.811 },
  { name: MIXED_WASHED, people: 13, speed: null, direct: null, overhead: null, total: null, note: "6 ambalare + 7 spălare; viteza conform mix" },
];
/** Lei per person-hour implied by the CSV: direct × speed ÷ people. Washed mixes run on the Multihead line. */
export function lineHourCost(name: string) {
  const l = LABOUR_LINES.find((x) => x.name === (name === MIXED_WASHED ? "Multihead — Monoprodus" : name));
  return l?.direct != null && l.speed ? (l.direct * l.speed) / l.people : null;
}
/** Editable formula inputs for a line, prefilled from the CSV. */
export function labourDefaults(name?: string) {
  const l = LABOUR_LINES.find((x) => x.name === name);
  if (!l) return {};
  const hour = lineHourCost(l.name);
  return { labourPeople: l.people, ...(l.speed ? { labourSpeed: l.speed } : {}), ...(hour != null ? { labourHourCost: Math.round(hour * 10000) / 10000 } : {}), labourOverheadPct: LABOUR_OVERHEAD_PCT };
}
const LABOUR_FORMULA = ["labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"] as const;
/** Labour per piece: CSV tariff for the line unless formula inputs were changed; washed mixes need the mix speed. */
export function lineLabour(cfg: PriceConfig): { direct: number; overhead: number; detail: string } | null {
  const l = LABOUR_LINES.find((x) => x.name === cfg.labourLine);
  if (!l) return null;
  const d = labourDefaults(l.name) as Record<string, number | undefined>;
  const changed = LABOUR_FORMULA.some((k) => cfg[k] != null && cfg[k] !== d[k]);
  if (l.direct != null && l.overhead != null && !changed) return { direct: l.direct, overhead: l.overhead, detail: `tarif CSV octombrie 2026 · ${l.name}: ${l.direct} directă + ${l.overhead} regie = ${l.total} lei/buc` };
  const people = cfg.labourPeople ?? d.labourPeople, speed = cfg.labourSpeed ?? d.labourSpeed;
  const hour = cfg.labourHourCost ?? lineHourCost(l.name) ?? undefined, pct = cfg.labourOverheadPct ?? LABOUR_OVERHEAD_PCT;
  if (!people || !speed || !hour) return null;
  const direct = (people * hour) / speed;
  return { direct, overhead: (direct * pct) / 100, detail: `${people} oameni × ${Math.round(hour * 100) / 100} lei/oră ÷ ${speed} buc/oră + regie ${pct}%` };
}
export const ROUTES = ["România", "Bulgaria", "Moldova"] as const;
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
  feePct?: number;
  supplyKg?: number;
  supplyBasis?: "pallet" | "kg";
  labourPeople?: number;
  labourSpeed?: number;
  labourHourCost?: number;
  labourOverheadPct?: number;
  rates?: Partial<SheetRates>;
  components?: Record<string, { price?: number; qty?: number; lossPct?: number; kgPerPallet?: number }>;
};
export const RATE_KEYS = ["labourPerPiece", "utilitiesPerPiece", "supplyPerKg", "distributionPerPiece", "clientFeePerPiece", "eurRate", "eurBufferPct", "techLossPct", "marginPct"] as const;
export const CONFIG_NUMBERS = ["unitsPerCase", "piecesPerPallet", "supplyPerPallet", "distributionPerPallet", "supplyTotal", "supplyPallets", "distributionTotal", "distributionPallets", "feePct", "supplyKg", "labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"] as const;

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
  if (r.route != null) {
    if (!(ROUTES as readonly string[]).includes(r.route)) return null;
    out.route = r.route;
  }
  if (r.labourLine != null) {
    if (!LABOUR_LINES.some((l) => l.name === r.labourLine)) return null;
    out.labourLine = r.labourLine;
  }
  for (const k of CONFIG_NUMBERS) if (r[k] != null) {
    if (!numeric(r[k]) || (k === "feePct" && r[k] >= 100) || (["unitsPerCase", "piecesPerPallet", "labourPeople", "labourSpeed"].includes(k) && r[k] === 0) || (k === "labourOverheadPct" && r[k] >= 1000)) return null;
    out[k] = r[k];
  }
  if (r.rates != null) {
    if (typeof r.rates !== "object" || Array.isArray(r.rates)) return null;
    out.rates = {};
    for (const k of RATE_KEYS) if (r.rates[k] != null) {
      if (!numeric(r.rates[k]) || (["marginPct", "techLossPct"].includes(k) && r.rates[k] >= 100)) return null;
      out.rates[k] = r.rates[k];
    }
  }
  if (r.components != null) {
    if (typeof r.components !== "object" || Array.isArray(r.components) || Object.keys(r.components).length > 200) return null;
    out.components = {};
    for (const [id, row] of Object.entries(r.components) as Array<[string, any]>) {
      if (!/^\d+$/.test(id) || !row || typeof row !== "object") return null;
      const c: NonNullable<PriceConfig["components"]>[string] = {};
      for (const k of ["price", "qty", "lossPct", "kgPerPallet"] as const) if (row[k] != null) {
        if (!numeric(row[k]) || (k === "lossPct" && row[k] >= 100) || (k === "kgPerPallet" && row[k] === 0)) return null;
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
  const rates = { ...defaults, ...(lab ? { labourPerPiece: lab.direct, utilitiesPerPiece: lab.overhead } : {}), ...cfg.rates };
  const labourDetail = cfg.rates?.labourPerPiece != null ? "tarif manual" : lab?.detail;
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
  const line = LABOUR_LINES.find((l) => l.name === cfg.labourLine);
  if (!cfg.labourLine && cfg.rates?.labourPerPiece == null) sheet.missingInputs.push("Linie / tarif manoperă");
  if (line && !lab && cfg.rates?.labourPerPiece == null) sheet.missingInputs.push(line.name === MIXED_WASHED ? "Viteză linie mixte spălate (buc/oră, conform mix)" : "Oameni, viteză și cost orar manoperă");
  if (cfg.rates?.labourPerPiece != null && cfg.rates?.utilitiesPerPiece == null && !lab) sheet.missingInputs.push("Regie fabrică manuală");
  const basis = cfg.supplyBasis ?? (cfg.supplyPerPallet != null ? "pallet" : "kg");
  if (basis === "pallet" && cfg.supplyPerPallet == null) sheet.missingInputs.push("Cost aprovizionare/palet (total luna închisă ÷ paleți NIR)");
  if (basis === "kg" && !(cfg.rates?.supplyPerKg != null && cfg.rates.supplyPerKg > 0)) sheet.missingInputs.push("Cost aprovizionare/kg (total luna închisă ÷ kg NIR)");
  if (cfg.distributionPerPallet == null && !(cfg.distributionTotal != null && (cfg.distributionPallets ?? 0) > 0)) sheet.missingInputs.push(`Cost distribuție/palet · ${cfg.route ?? "rută nealeasă"}`);
  for (const c of components) if (c.lossSource?.startsWith("PT nesetat") && cfg.components?.[String(c.id)]?.lossPct == null) sheet.missingInputs.push(`PT ${c.name}`);
  if (cfg.feePct == null && cfg.rates?.clientFeePerPiece == null) sheet.missingInputs.push("Taxe rețea (confirmați 0 dacă nu există)");
  sheet.complete = !sheet.missingInputs.length && !sheet.missingPrices.length;
  return { sheet, components, rates };
}