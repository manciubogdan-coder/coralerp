// Scenario inputs shared by the screen, chat tool and saved live price sheets.
import { computeSheet, type SheetComponent, type SheetRates } from "./priceSheet.ts";

export const LABOUR_LINES = [
  { name: "Giostra", direct: 0.151, overhead: 0.062, total: 0.213 },
  { name: "Flowpack", direct: 0.302, overhead: 0.124, total: 0.426 },
  { name: "Multihead — Monoprodus", direct: 0.212, overhead: 0.087, total: 0.299 },
  { name: "Spanac Mare", direct: 0.401, overhead: 0.165, total: 0.566 },
  { name: "Aromate", direct: 0.552, overhead: 0.226, total: 0.778 },
  { name: "Vracuri / Gastro", direct: 0.575, overhead: 0.236, total: 0.811 },
  { name: "Multihead — Mixte SPĂLATE", direct: null, overhead: null, total: null },
] as const;
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
  rates?: Partial<SheetRates>;
  components?: Record<string, { price?: number; qty?: number; lossPct?: number; kgPerPallet?: number }>;
};
export const RATE_KEYS = ["labourPerPiece", "utilitiesPerPiece", "supplyPerKg", "distributionPerPiece", "clientFeePerPiece", "eurRate", "eurBufferPct", "techLossPct", "marginPct"] as const;
export const CONFIG_NUMBERS = ["unitsPerCase", "piecesPerPallet", "supplyPerPallet", "distributionPerPallet", "supplyTotal", "supplyPallets", "distributionTotal", "distributionPallets", "feePct"] as const;

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
  if (r.route != null) {
    if (!(ROUTES as readonly string[]).includes(r.route)) return null;
    out.route = r.route;
  }
  if (r.labourLine != null) {
    if (!LABOUR_LINES.some((l) => l.name === r.labourLine)) return null;
    out.labourLine = r.labourLine;
  }
  for (const k of CONFIG_NUMBERS) if (r[k] != null) {
    if (!numeric(r[k]) || (k === "feePct" && r[k] >= 100) || (["unitsPerCase", "piecesPerPallet"].includes(k) && r[k] === 0)) return null;
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
  const line = LABOUR_LINES.find((l) => l.name === cfg.labourLine);
  const rates = { ...defaults, ...(line?.total != null ? { labourPerPiece: line.direct, utilitiesPerPiece: line.overhead } : {}), ...cfg.rates };
  const components = d.components.map((c) => {
    const o = cfg.components?.[String(c.id)];
    return { ...c, ...o, priceSource: o?.price != null ? "preț manual / scenariu" : c.priceSource, ...(o?.lossPct != null ? { lossSource: "PT manual / scenariu" } : {}) };
  });
  const sheet = computeSheet({ unitsPerCase: cfg.unitsPerCase ?? d.product.unitsPerCase, components, rates: {
    ...rates, feePct: cfg.feePct ?? 0,
    ...(cfg.supplyPerPallet != null ? { supplyPerPallet: cfg.supplyPerPallet } : cfg.supplyTotal != null && (cfg.supplyPallets ?? 0) > 0 ? { supplyPerPallet: cfg.supplyTotal / (cfg.supplyPallets ?? 1) } : {}),
    ...(cfg.distributionPerPallet != null ? { distributionPerPallet: cfg.distributionPerPallet } : cfg.distributionTotal != null && (cfg.distributionPallets ?? 0) > 0 ? { distributionPerPallet: cfg.distributionTotal / (cfg.distributionPallets ?? 1) } : {}),
    ...(cfg.piecesPerPallet != null ? { piecesPerPallet: cfg.piecesPerPallet } : {}),
  } });
  if (!cfg.labourLine && cfg.rates?.labourPerPiece == null) sheet.missingInputs.push("Linie / tarif manoperă");
  if (line && line.total == null && cfg.rates?.labourPerPiece == null) sheet.missingInputs.push("Tarif numeric pentru mixte spălate");
  if (cfg.rates?.labourPerPiece != null && cfg.rates?.utilitiesPerPiece == null && !line) sheet.missingInputs.push("Regie fabrică manuală");
  if (cfg.supplyPerPallet == null && !(cfg.supplyTotal != null && (cfg.supplyPallets ?? 0) > 0)) sheet.missingInputs.push("Cost aprovizionare/palet și paleți recepționați");
  if (cfg.distributionPerPallet == null && !(cfg.distributionTotal != null && (cfg.distributionPallets ?? 0) > 0)) sheet.missingInputs.push(`Cost distribuție/palet · ${cfg.route ?? "rută nealeasă"}`);
  for (const c of components) if (c.lossSource?.startsWith("PT nesetat") && cfg.components?.[String(c.id)]?.lossPct == null) sheet.missingInputs.push(`PT ${c.name}`);
  if (cfg.feePct == null && cfg.rates?.clientFeePerPiece == null) sheet.missingInputs.push("Taxe rețea (confirmați 0 dacă nu există)");
  sheet.complete = !sheet.missingInputs.length && !sheet.missingPrices.length;
  return { sheet, components, rates };
}