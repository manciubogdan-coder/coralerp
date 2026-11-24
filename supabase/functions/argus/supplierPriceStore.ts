import { validatePricePeriods, type SupplierPricePeriod } from "../_shared/supplierPricePeriods.ts";

/** Agreed supplier price list (EUR per Senior unit) — append-only, latest row active. */
export async function supplierPriceList(cloud: any) {
  const { data, error } = await cloud.from("achizitii_preturi_furnizori").select("data, created_by, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return { list: data?.data ?? { currency: "EUR", items: [], suppliers: [] }, updated_by: data?.created_by ?? null, updated_at: data?.created_at ?? null };
}

const txt = (v: unknown, n = 120) => String(v ?? "").trim().slice(0, n);

export async function saveSupplierPriceList(cloud: any, body: any, who: string) {
  const raw = body?.list ?? {};
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 500).map((i: any) => {
    const prices: Record<string, number> = {};
    for (const [k, v] of Object.entries(i?.prices ?? {})) { const n = Number(v); if (txt(k) && Number.isFinite(n) && n > 0 && n < 10000) prices[txt(k)] = Math.round(n * 10000) / 10000; }
    return { product: txt(i?.product).toUpperCase(), category: txt(i?.category, 60), prices };
  }).filter((i: any) => i.product);
  const names = new Set(items.flatMap((i: any) => Object.keys(i.prices)));
  if (raw.periods != null && !Array.isArray(raw.periods)) throw new Error('Liste de prețuri invalide.');
  const periods: SupplierPricePeriod[] = (raw.periods ?? []).map((p: any) => ({
    id: txt(p?.id), supplier: txt(p?.supplier), validFrom: txt(p?.validFrom, 10), validTo: txt(p?.validTo, 10),
    items: (Array.isArray(p?.items) ? p.items : []).map((i: any) => ({ product: txt(i?.product).toUpperCase(), category: txt(i?.category, 60), price: Number(i?.price) })),
  }));
  validatePricePeriods(periods);
  for (const p of periods) names.add(p.supplier);
  const given = new Map((Array.isArray(raw.suppliers) ? raw.suppliers : []).map((s: any) => [txt(s?.name), (Array.isArray(s?.aliases) ? s.aliases : []).map((a: unknown) => txt(a, 200)).filter(Boolean).slice(0, 10)]));
  const suppliers = [...names].sort().map((name) => ({ name, aliases: given.get(name) ?? [] }));
  const list = { currency: "EUR", items, suppliers, periods };
  const { error } = await cloud.from("achizitii_preturi_furnizori").insert({ data: list, created_by: who });
  if (error) throw error;
  return { list };
}

