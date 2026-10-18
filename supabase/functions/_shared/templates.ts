// Report templates: one read-only T-SQL SELECT with named placeholders ({{de_la}}, {{partener}} ...)
// that are filled server-side with validated, quoted values before the query is sent to Senior.

export type ParamType = "date" | "text" | "number";
export interface TemplateParam { name: string; label: string; type: ParamType }
export interface SqlTemplate {
  kind: "sql";
  sql: string;
  params: TemplateParam[];
  defaults: Record<string, string>;
  chart: "table" | "bar" | "line" | "pie";
  x: string | null;
  series: string[];
}

const NAME = /^[a-z][a-z0-9_]{0,29}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COL = /^[\p{L}\p{N}_ ]{1,64}$/u;
const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]{0,29})\s*\}\}/g;

/** Validates a template coming from the browser or the assistant. Returns null when invalid. */
export function validTemplate(c: any): SqlTemplate | null {
  if (!c || typeof c !== "object" || c.kind !== "sql" || typeof c.sql !== "string") return null;
  const sql = c.sql.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\s/i.test(sql) || sql.length > 8000) return null;
  const params: TemplateParam[] = [];
  for (const p of Array.isArray(c.params) ? c.params.slice(0, 8) : []) {
    if (!p || !NAME.test(String(p.name)) || !["date", "text", "number"].includes(p.type)) return null;
    if (params.some((x) => x.name === p.name)) continue;
    params.push({ name: p.name, label: String(p.label || p.name).slice(0, 60), type: p.type });
  }
  for (const m of sql.matchAll(PLACEHOLDER)) if (!params.some((p) => p.name === m[1])) return null;
  const defaults: Record<string, string> = {};
  for (const p of params) {
    const v = c.defaults?.[p.name];
    defaults[p.name] = typeof v === "string" || typeof v === "number" ? String(v).slice(0, 200) : "";
  }
  const series = (Array.isArray(c.series) ? c.series : []).filter((s: unknown) => typeof s === "string" && COL.test(s)).slice(0, 6);
  return {
    kind: "sql", sql, params, defaults,
    chart: ["table", "bar", "line", "pie"].includes(c.chart) ? c.chart : "table",
    x: typeof c.x === "string" && COL.test(c.x) ? c.x : null,
    series,
  };
}

/** Fills placeholders with SQL Server literals. Throws a readable error on invalid values. */
export function fillTemplate(t: SqlTemplate, values: Record<string, unknown> = {}): string {
  const lit = (p: TemplateParam): string => {
    const raw = values[p.name] ?? t.defaults[p.name] ?? "";
    const v = String(raw).trim();
    if (p.type === "date") {
      if (!DATE.test(v) || Number.isNaN(Date.parse(v))) throw new Error(`Completează data pentru „${p.label}”.`);
      return `'${v}'`;
    }
    if (p.type === "number") {
      if (v === "" || !Number.isFinite(Number(v))) throw new Error(`„${p.label}” trebuie să fie un număr.`);
      return String(Number(v));
    }
    if (v.length > 200) throw new Error(`„${p.label}” este prea lung.`);
    return `N'${v.replace(/'/g, "''")}'`;
  };
  return t.sql.replace(PLACEHOLDER, (_, name) => {
    const p = t.params.find((x) => x.name === name);
    if (!p) throw new Error(`Parametru necunoscut: ${name}`);
    return lit(p);
  });
}
