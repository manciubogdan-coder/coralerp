import { LABOUR_LINES, type PriceConfig } from "./priceConfig.ts";
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

export function suggestedLabour(name: string, components: SheetComponent[]) {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/spanac.*mare/.test(n)) return "Spanac Mare";
  if (/gastro|vrac/.test(n)) return "Vracuri / Gastro";
  if (/busuioc|marar|patrunjel|menta|cimbru|rozmarin|aromat/.test(n)) return "Aromate";
  if (/flow\s*pack/.test(n)) return "Flowpack";
  if (/giostra/.test(n)) return "Giostra";
  if (components.filter((c) => c.kind === "mp" && c.qty > 0).length > 1) return "Multihead — Mixte SPĂLATE";
  if (/baby|rucola|spanac/.test(n)) return "Multihead — Monoprodus";
  return null;
}

export function prefilledConfig(d: { product: { unitsPerCase: number }; components: SheetComponent[]; defaults?: PriceConfig; logistics?: { distribution?: Record<string, PriceConfig | null> } }, user: PriceConfig = {}): PriceConfig {
  const base = d.defaults ?? {};
  const merged: PriceConfig = { ...base, ...user, rates: { ...base.rates, ...user.rates }, components: { ...base.components } };
  if (user.labourLine && user.labourLine !== base.labourLine) {
    const line = LABOUR_LINES.find((l) => l.name === user.labourLine);
    delete merged.rates?.labourPerPiece; delete merged.rates?.utilitiesPerPiece;
    if (line?.direct != null) merged.rates = { ...merged.rates, labourPerPiece: line.direct, utilitiesPerPiece: line.overhead };
    merged.rates = { ...merged.rates, ...user.rates };
  }
  if (user.route && user.route !== base.route) {
    for (const k of ["distributionTotal", "distributionPallets", "distributionPerPallet"] as const) if (user[k] == null) delete merged[k];
    for (const k of ["distributionTotal", "distributionPallets", "distributionPerPallet"] as const) {
      const value = user[k] ?? d.logistics?.distribution?.[user.route]?.[k];
      if (value != null) merged[k] = value;
    }
  }
  if ((user.supplyTotal != null || user.supplyPallets != null) && user.supplyPerPallet == null) delete merged.supplyPerPallet;
  if ((user.distributionTotal != null || user.distributionPallets != null) && user.distributionPerPallet == null) delete merged.distributionPerPallet;
  for (const [id, values] of Object.entries(user.components ?? {})) merged.components = { ...merged.components, [id]: { ...merged.components?.[id], ...values } };
  return merged;
}