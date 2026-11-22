import { labourDefaults, type PriceConfig } from "./priceConfig.ts";
import type { SheetComponent } from "./priceSheet.ts";

/** Price dates are independent of the closed accounting month used for transport. */
export function priceDates(year: number, month: number, today: string) {
  const requested = `${year}-${String(month).padStart(2, "0")}`;
  const current = today.slice(0, 7);
  const end = requested >= current ? new Date(`${today}T00:00:00Z`) : new Date(Date.UTC(year, month, 1));
  if (requested >= current) end.setUTCDate(end.getUTCDate() + 1);
  const annual = new Date(end); annual.setUTCFullYear(annual.getUTCFullYear() - 1);
  const week = new Date(end); week.setUTCDate(week.getUTCDate() - 7);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return { startDay: day(annual), weekStart: day(week), endDay: day(end) };
}

/** Last whole calendar month before today (Bucharest day "YYYY-MM-DD"): the default cost month, so costs and invoices cover a full month. */
export function lastClosedMonth(today: string) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

/** Selling price window: the chosen calendar month only (current month: 1st up to today; a future month falls back to the current one). */
export function saleWindow(year: number, month: number, today: string) {
  const requested = `${year}-${String(month).padStart(2, "0")}`;
  const current = today.slice(0, 7);
  return { from: `${requested <= current ? requested : current}-01`, to: priceDates(year, month, today).endDay };
}

/** "10/2026" for a whole month, "01–21.11.2026" for the running month. */
export function salePeriodLabel(p: { from: string; to: string }) {
  const [y, m] = p.from.split("-");
  const end = new Date(`${p.to}T00:00:00Z`); end.setUTCDate(end.getUTCDate() - 1);
  const next = new Date(Date.UTC(Number(y), Number(m), 1)).toISOString().slice(0, 10);
  if (p.to === next) return `${m}/${y}`;
  return `01–${String(end.getUTCDate()).padStart(2, "0")}.${m}.${y}`;
}

export function suggestedLabour(name: string, components: SheetComponent[]) {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/spanac.*mare/.test(n)) return "Spanac Mare";
  if (/gastro|vrac/.test(n)) return "Vracuri / Gastro";
  if (/busuioc|marar|patrunjel|menta|cimbru|rozmarin|aromat/.test(n)) return "Aromate";
  // Packaging in the Senior recipe identifies the machine: flow-pack film → Flowpack, Giostra film/bags → Giostra.
  const pack = components.filter((c) => c.kind === "ambalaj").map((c) => c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()).join(" | ");
  if (/flow\s*-?\s*pack/.test(n) || /flow\s*-?\s*pack/.test(pack)) return "Flowpack";
  if (/giostra/.test(n) || /giostra/.test(pack)) return "Giostra";
  if (components.filter((c) => c.kind === "mp" && c.qty > 0).length > 1) return "Multihead — Mixte SPĂLATE";
  if (/baby|rucola|spanac/.test(n)) return "Multihead — Monoprodus";
  return null;
}

const DIST_KEYS = ["distributionTotal", "distributionPallets", "distributionPerPallet", "distributionTrips", "distributionPalletsPerTrip"] as const;
const LABOUR_KEYS = ["labourPeople", "labourSpeed", "labourHourCost", "labourOverheadPct"] as const;

export function prefilledConfig(d: { product: { unitsPerCase: number }; components: SheetComponent[]; defaults?: PriceConfig; logistics?: { distribution?: Record<string, PriceConfig | null> } }, user: PriceConfig = {}): PriceConfig {
  const base = d.defaults ?? {};
  const merged: PriceConfig = { ...base, ...user, rates: { ...base.rates, ...user.rates }, components: { ...base.components } };
  const line = user.labourLine ?? base.labourLine;
  if (user.labourLine && user.labourLine !== base.labourLine) {
    // A different line replaces the proposed tariff; only values typed by the user survive.
    if (user.rates?.labourPerPiece == null) delete merged.rates!.labourPerPiece;
    if (user.rates?.utilitiesPerPiece == null) delete merged.rates!.utilitiesPerPiece;
    for (const k of LABOUR_KEYS) if (user[k] == null) delete merged[k];
  }
  const lineInputs = labourDefaults(line) as Partial<Record<(typeof LABOUR_KEYS)[number], number>>;
  for (const k of LABOUR_KEYS) if (merged[k] == null && lineInputs[k] != null) merged[k] = lineInputs[k];
  if (user.route && user.route !== base.route) {
    for (const k of DIST_KEYS) if (user[k] == null) delete merged[k];
    for (const k of DIST_KEYS) {
      const value = user[k] ?? d.logistics?.distribution?.[user.route]?.[k];
      if (value != null) merged[k] = value;
    }
  }
  // Derived tariffs follow their total and volume unless the user typed the tariff itself.
  if (user.supplyPerPallet == null && merged.supplyTotal != null && (merged.supplyPallets ?? 0) > 0) merged.supplyPerPallet = merged.supplyTotal / merged.supplyPallets!;
  if (user.rates?.supplyPerKg == null && merged.supplyTotal != null && (merged.supplyKg ?? 0) > 0) merged.rates = { ...merged.rates, supplyPerKg: merged.supplyTotal / merged.supplyKg! };
  if (user.distributionPerPallet == null) {
    // Typed pallets per trip: average trip cost of the cursă ÷ pallets loaded per trip.
    if (user.distributionPalletsPerTrip != null && merged.distributionTotal != null && (merged.distributionTrips ?? 0) > 0) merged.distributionPerPallet = merged.distributionTotal / merged.distributionTrips! / user.distributionPalletsPerTrip;
    else if (merged.distributionTotal != null && (merged.distributionPallets ?? 0) > 0) {
      merged.distributionPerPallet = merged.distributionTotal / merged.distributionPallets!;
      if ((merged.distributionTrips ?? 0) > 0 && user.distributionPallets != null) merged.distributionPalletsPerTrip = merged.distributionPallets! / merged.distributionTrips!;
    }
  }
  for (const [id, values] of Object.entries(user.components ?? {})) merged.components = { ...merged.components, [id]: { ...merged.components?.[id], ...values } };
  return merged;
}
