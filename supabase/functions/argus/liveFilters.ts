// Pure mapping between saved-SQL placeholders and dashboard card filters.
import type { SqlTemplate } from "../_shared/templates.ts";
import { resolvePeriod, type AgentFilter } from "./agentFilters.ts";

/** Card filters derived from SQL placeholders: de_la/pana_la → one period filter; other params → text filters. */
export function filtersForTemplate(t: SqlTemplate): AgentFilter[] {
  const out: AgentFilter[] = [];
  const hasPeriod = t.params.some((p) => p.name === "de_la") && t.params.some((p) => p.name === "pana_la");
  if (hasPeriod) {
    const a = t.defaults.de_la, b = t.defaults.pana_la;
    out.push({ name: "perioada", label: "Perioadă", type: "period", default: a && b ? `${a}..${b}` : "last_30" });
  }
  for (const p of t.params) {
    if (hasPeriod && (p.name === "de_la" || p.name === "pana_la")) continue;
    out.push({ name: p.name, label: p.label, type: "text", default: t.defaults[p.name] ?? "" });
  }
  return out.slice(0, 6);
}

/** Maps card filter values onto SQL placeholder values. */
export function templateValues(t: SqlTemplate, values: Record<string, unknown>, today: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof values.perioada === "string" && values.perioada) {
    const [a, b] = resolvePeriod(values.perioada, today);
    out.de_la = a; out.pana_la = b;
  }
  for (const p of t.params) {
    const v = values[p.name];
    if (typeof v === "string" && v.trim() && !(p.name in out)) out[p.name] = v.trim();
  }
  return out;
}

