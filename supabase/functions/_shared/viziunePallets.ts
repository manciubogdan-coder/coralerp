// Viziune warehouses: how much fits on a pallet, read-only.
// Finished goods: Senior pieces/pallet (D_Articole_UM_Relatii, selling unit 28) for every Senior article code mapped
// to an app product, plus the exact code each store orders (productie_baxare_magazine).
// Raw material: kg/pallet norms from the price rules (Reguli de calcul), matched by product name.
import { seniorSqlAll } from "./senior.ts";
import { fetchAll, type Clients } from "./appData.ts";
import { loadPriceRules } from "./priceRules.ts";
import { configuredRawPalletKg, PALLET_RELATION } from "./priceSourceRules.ts";

const lit = (s: string) => `N'${s.replace(/'/g, "''")}'`;

const list = (v: unknown, max: number, ok: (s: string) => boolean, what: string): string[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) throw new Error(`Lista de ${what} este invalidă.`);
  return [...new Set(v.map((n) => { if (typeof n !== "string" || !ok(n.trim())) throw new Error(`Valoare invalidă în lista de ${what}.`); return n.trim(); }))];
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** names: raw-material names on stock; products: app product ids ready in Picking (only their Senior codes are read). */
export function validPalletRequest(input: unknown): { names: string[]; products: string[] } {
  const b = (input ?? {}) as { names?: unknown; products?: unknown };
  return {
    names: list(b.names, 1000, (s) => s.length > 0 && s.length <= 200, "produse"),
    products: list(b.products, 500, (s) => UUID.test(s), "produse finite"),
  };
}

export async function viziunePallets(c: Clients, input: unknown) {
  const { names, products: wanted } = validPalletRequest(input);
  const want = new Set(wanted);
  await loadPriceRules(c.cloud);
  const raw: Record<string, number | null> = {};
  for (const n of names) raw[n] = configuredRawPalletKg(n) ?? null;

  const mappings = !want.size ? [] : await fetchAll(c.legacy, "erp_mapping_produse", "id, produs_id, cod_extern", (q) => q.order("id"));
  const byProduct = new Map<string, Set<string>>();
  for (const m of mappings as any[]) {
    const code = String(m.cod_extern ?? "").trim();
    if (!m.produs_id || !code || !want.has(m.produs_id)) continue;
    byProduct.set(m.produs_id, (byProduct.get(m.produs_id) ?? new Set()).add(code));
  }
  const stores: Record<string, string> = {};
  const ids = [...want];
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await c.cloud.from("productie_baxare_magazine").select("produs_id, magazin_key, senior_code").in("produs_id", part).order("produs_id").order("magazin_key").range(from, from + 999);
      if (error) throw new Error(`Baxare: ${error.message}`);
      for (const r of data ?? []) if (r.senior_code) stores[`${r.produs_id}|${r.magazin_key}`] = String(r.senior_code).trim();
      if (!data || data.length < 1000) break;
    }
  }
  const codes = [...new Set([...[...byProduct.values()].flatMap((s) => [...s]), ...Object.values(stores)])];
  const perCode: Record<string, number> = {};
  const parts: string[][] = [];
  for (let i = 0; i < codes.length; i += 300) parts.push(codes.slice(i, i + 300));
  const results = await Promise.all(parts.map((part) => seniorSqlAll(c.cloud as any, `SELECT a.Cod AS code, r.coef AS coef FROM dbo.D_Articole a WITH (NOLOCK) JOIN (${PALLET_RELATION}) r ON r.Articol_ID = a.Articol_ID WHERE a.Cod IN (${part.map(lit).join(",")})`, "a.Cod", 45000)));
  for (const rows of results) for (const r of rows) { const k = String(r.code ?? "").trim(), v = Number(r.coef); if (k && v > 0) perCode[k] = v; }
  const products: Record<string, string[]> = {};
  for (const [pid, set] of byProduct) products[pid] = [...set];
  return { raw, products, stores, perCode };
}
