// Live reports: saved results that refresh WITHOUT the AI model.
// - "sql": a parameterized Senior SELECT captured from a chat answer, rerun with new filter values.
// - "price": a Calculator preț sheet (product/client/margin) recomputed by code from live Senior data.
import { generateText } from "npm:ai@7.0.123";
import { fillTemplate, validTemplate, type SqlTemplate } from "../_shared/templates.ts";
import { seniorLive } from "../_shared/senior.ts";
import { defaultRates, priceCalcData } from "../_shared/priceCalcSenior.ts";
import { templateValues } from "./liveFilters.ts";
import { configuredSheet, validPriceConfig, type PriceConfig } from "../_shared/priceConfig.ts";
import { prefilledConfig } from "../_shared/priceDefaults.ts";
import { validRouteOverrides } from "../_shared/priceSourceRules.ts";
export { filtersForTemplate } from "./liveFilters.ts";

export type LiveSpec =
  | { kind: "sql"; template: SqlTemplate }
  | { kind: "price"; articolId: number; partnerId: number | null; storeId?: number | null; scope?: "central"; routeOverrides?: Record<string, string>; marginPct: number; product: string; client: string; config?: PriceConfig; year?: number; month?: number };

const posInt = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

export function validLiveSpec(raw: any): LiveSpec | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.kind === "sql") {
    const template = validTemplate(raw.template);
    return template ? { kind: "sql", template } : null;
  }
  if (raw.kind === "price") {
    const articolId = posInt(raw.articolId);
    const m = Number(raw.marginPct ?? 0);
    if (!articolId || !Number.isFinite(m) || m < 0 || m >= 90) return null;
    const config = raw.config == null ? undefined : validPriceConfig(raw.config);
    if (config === null) return null;
    if (raw.year != null && (!Number.isInteger(raw.year) || raw.year < 2016 || raw.year > 2099)) return null;
    if (raw.month != null && (!Number.isInteger(raw.month) || raw.month < 1 || raw.month > 12)) return null;
    return { kind: "price", articolId, partnerId: posInt(raw.partnerId), ...(raw.scope === "central" ? { scope: "central" as const, storeId: posInt(raw.storeId) } : {}), ...(raw.routeOverrides ? { routeOverrides: validRouteOverrides(raw.routeOverrides) } : {}), marginPct: m, product: String(raw.product ?? "").slice(0, 150), client: String(raw.client ?? "").slice(0, 150), ...(config ? { config } : {}), ...(raw.year ? { year: raw.year } : {}), ...(raw.month ? { month: raw.month } : {}) };
  }
  return null;
}

const cell = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : typeof v === "number" ? String(Math.round(v * 1000) / 1000) : String(v));

export async function runLive(c: { cloud: any; legacy: any; legacyUser?: any }, spec: LiveSpec, values: Record<string, unknown>, today: string, title: string) {
  if (spec.kind === "sql") {
    const vals = templateValues(spec.template, values, today);
    const rows = await seniorLive(c.cloud, "sql", { sql: fillTemplate(spec.template, vals) }, 45000);
    const list = Array.isArray(rows) ? rows : [];
    const headers = list.length ? Object.keys(list[0]) : [];
    return {
      widget_type: "table", title,
      summary: `${list.length} rânduri live din Senior${vals.de_la ? ` · ${vals.de_la} – ${vals.pana_la}` : ""} · fără credite AI`,
      table_data: { headers, rows: list.slice(0, 300).map((r: any) => headers.map((h) => cell(r[h]))) },
      filtre: vals,
    };
  }
  const [y, m] = today.split("-").map(Number);
  let config = spec.config ?? {};
  if (values.price_config != null) {
    const parsed = validPriceConfig(JSON.parse(String(values.price_config)));
    if (!parsed) throw new Error("Parametri ai fișei invalizi.");
    config = parsed;
  }
  const d = await priceCalcData(c.cloud, c.legacyUser ?? c.legacy, { articolId: spec.articolId, partnerId: spec.partnerId, storeId: spec.scope === "central" ? spec.storeId ?? null : spec.partnerId, year: config.year ?? spec.year ?? y, month: config.month ?? spec.month ?? m, rawPriceMode: config.rawPriceMode, routeOverrides: spec.routeOverrides });
  // Saved margin stays the sheet's margin unless the config carries an explicit one.
  const { sheet: s } = configuredSheet(d, defaultRates(d, spec.marginPct), prefilledConfig(d, { ...config, rates: { marginPct: spec.marginPct, ...config.rates } }));
  const r2 = (n: number | null | undefined) => (n == null ? "—" : (Math.round(n * 100) / 100).toFixed(2));
  const rows = [
    ...s.lines.map((l) => [l.label, l.detail, r2(l.value)]),
    ["Cost producție", "", r2(s.productionCost)],
    [`Marjă brută ${config.rates?.marginPct ?? spec.marginPct}%`, "", r2(s.grossMargin)],
    ["Preț poartă fabrică", "", r2(s.factoryGate)],
    ["Cost logistic", "", r2(s.logistics)],
    ["Preț livrat", "", r2(s.delivered)],
    ["Taxe client", "", r2(s.clientFees)],
    ["Preț client RON / bax", "", r2(s.clientPrice)],
    ["Preț client EUR / bax", `curs ${r2(s.eurEffective)}`, r2(s.clientPriceEur)],
  ];
  return {
    widget_type: "table", title,
    summary: `${d.product.name} · ${spec.client || "toți clienții"} · ${s.unitsPerCase} buc/bax · ${s.complete ? "fișă calculată" : `FIȘĂ INCOMPLETĂ — ${[...s.missingInputs, ...s.missingPrices].join("; ")}`} · fără credite AI`,
    table_data: { headers: ["Rând", "Detaliu", "RON / bax"], rows },
    filtre: { produs: spec.product, client: spec.client || "toți", marja: `${spec.marginPct}%`, price_config: JSON.stringify(config) },
  };
}

/** One short model call at SAVE time only: turns literal dates/names into {{placeholders}}. Falls back to the literal SQL. */
export async function parameterizeSql(model: any, sql: string, question: string, today: string): Promise<SqlTemplate> {
  const literal = validTemplate({ kind: "sql", sql, params: [], defaults: {} });
  if (!literal) throw new Error("Interogarea nu este un SELECT valid.");
  try {
    const res = await generateText({
      model,
      providerOptions: { openai: { store: false, reasoningEffort: "low" } },
      prompt: `Azi: ${today}. Transformă interogarea T-SQL de mai jos într-un șablon reutilizabil.
Reguli: înlocuiește literalele de dată de început/sfârșit ale perioadei cu {{de_la}} și {{pana_la}} (fără ghilimele în jurul placeholderului; tipul "date"). Dacă există un filtru pe un produs/articol, client/partener sau furnizor dat prin text (LIKE sau =), înlocuiește DOAR textul cu {{produs}} / {{client}} / {{furnizor}} (tip "text"; pentru LIKE scrie LIKE N'%' + {{produs}} + N'%'). NU schimba nimic altceva. Pune valorile originale în defaults.
Întrebarea utilizatorului: ${question.slice(0, 500)}
SQL:
${sql}
Răspunde DOAR cu JSON: {"kind":"sql","sql":str,"params":[{"name":str,"label":str,"type":"date"|"text"}],"defaults":{}}`,
    });
    const raw = res.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    const t = validTemplate(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
    if (t && t.params.length) fillTemplate(t); // defaults must fill cleanly
    return t ?? literal;
  } catch {
    return literal;
  }
}
