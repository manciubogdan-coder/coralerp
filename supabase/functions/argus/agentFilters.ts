// Agent filters: user-editable parameters (period, product, client...) stored on a report template
// and injected into the agent prompt at run time. Pure helpers shared by the server and tests.

export type FilterType = "period" | "text" | "choice" | "lookup";
export type LookupSource = "produs" | "client" | "furnizor";
const SOURCES: LookupSource[] = ["produs", "client", "furnizor"];
export type PeriodPreset = "today" | "yesterday" | "last_7" | "last_30" | "this_month" | "last_month" | "custom";
export interface AgentFilter {
  name: string;
  label: string;
  type: FilterType;
  options?: string[];
  source?: LookupSource; // lookup: searchable list loaded live from Senior
  default: string; // period: preset or "YYYY-MM-DD..YYYY-MM-DD"; text/choice: value ("" = toate)
}

const NAME = /^[a-z][a-z0-9_]{0,29}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const PRESETS: PeriodPreset[] = ["today", "yesterday", "last_7", "last_30", "this_month", "last_month", "custom"];

export function slug(label: string): string {
  const s = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (/^[a-z]/.test(s) ? s : `f_${s}`).slice(0, 30) || "filtru";
}

/** Keeps at most 6 well-formed filters with unique names; drops anything malformed. */
export function validFilters(raw: unknown): AgentFilter[] {
  const out: AgentFilter[] = [];
  for (const f of Array.isArray(raw) ? raw.slice(0, 6) : []) {
    if (!f || typeof f !== "object") continue;
    const label = String((f as any).label ?? "").trim().slice(0, 60);
    const type = (f as any).type as FilterType;
    if (!label || !["period", "text", "choice", "lookup"].includes(type)) continue;
    const source = type === "lookup" ? (SOURCES.includes((f as any).source) ? (f as any).source as LookupSource : null) : undefined;
    if (source === null) continue;
    let name = String((f as any).name ?? "");
    if (!NAME.test(name)) name = slug(label);
    if (out.some((x) => x.name === name)) continue;
    const options = type === "choice"
      ? [...new Set((Array.isArray((f as any).options) ? (f as any).options : []).map((o: unknown) => String(o).trim().slice(0, 80)).filter(Boolean))].slice(0, 30) as string[]
      : undefined;
    if (type === "choice" && !options!.length) continue;
    let def = String((f as any).default ?? "").trim().slice(0, 200);
    if (type === "period" && !PRESETS.includes(def as PeriodPreset) && !rangeOf(def)) def = "last_30";
    if (type === "choice" && def && !options!.includes(def)) def = "";
    out.push({ name, label, type, ...(options ? { options } : {}), ...(source ? { source } : {}), default: def });
  }
  return out;
}

function rangeOf(v: string): [string, string] | null {
  const [a, b] = v.split("..");
  return DAY.test(a ?? "") && DAY.test(b ?? "") && a <= b ? [a, b] : null;
}

function shift(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

/** Resolves a period value to concrete Bucharest days relative to `today`. */
export function resolvePeriod(v: string, today: string): [string, string] {
  const r = rangeOf(v);
  if (r) return r;
  const month = today.slice(0, 7);
  switch (v) {
    case "today": return [today, today];
    case "yesterday": return [shift(today, -1), shift(today, -1)];
    case "last_7": return [shift(today, -7), shift(today, -1)];
    case "this_month": return [`${month}-01`, today];
    case "last_month": {
      const end = shift(`${month}-01`, -1);
      return [`${end.slice(0, 7)}-01`, end];
    }
    default: return [shift(today, -30), shift(today, -1)];
  }
}

/** Text block for the agent prompt: the exact filter values to apply on this run. */
export function describeFilters(filters: AgentFilter[], values: Record<string, unknown>, today: string): { text: string; used: Record<string, string> } {
  if (!filters.length) return { text: "", used: {} };
  const used: Record<string, string> = {};
  const lines = filters.map((f) => {
    const raw = values[f.name];
    let v = typeof raw === "string" ? raw.trim().slice(0, 200) : f.default;
    if (f.type === "choice" && v && !f.options?.includes(v)) v = f.default;
    if (f.type === "period") {
      const [a, b] = resolvePeriod(v, today);
      used[f.name] = `${a}..${b}`;
      return `- ${f.label}: de la ${a} până la ${b} inclusiv`;
    }
    used[f.name] = v;
    return `- ${f.label}: ${v || "toate (fără restricție)"}`;
  });
  return {
    text: `\nFILTRE OBLIGATORII pentru această rulare (au prioritate față de orice perioadă/produs/client din instrucțiuni):\n${lines.join("\n")}\nMenționează filtrele aplicate în summary.`,
    used,
  };
}
