// Viziune offices chosen by hand: which office each person sits in and whose each Senior account is.
// Shared by the page (editing) and the argus function (validating before saving for everyone). No React, no Deno.

export const OFFICE_CHOICES = ["ceo", "vanzari", "achizitii", "contabilitate", "hr", "productie", "calitate", "mentenanta", "none", "hidden"] as const;
export type OfficeChoice = typeof OFFICE_CHOICES[number];
export interface OfficeConfig {
  /** person key (`app:<uuid>` or `senior:<id>`) → office, "none" (no office) or "hidden" (not shown). */
  offices: Record<string, OfficeChoice>;
  /** Senior account id → app user id it belongs to, or "" = a separate account, never linked by name. */
  links: Record<string, string>;
}
export const EMPTY_OFFICE_CONFIG: OfficeConfig = { offices: {}, links: {} };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERSON = /^(app:[0-9a-f-]{36}|senior:\d{1,9})$/i;
const MAX = 1000;

export function validateOfficeConfig(input: unknown): OfficeConfig {
  const o = (input ?? {}) as { offices?: unknown; links?: unknown };
  const isObj = (v: unknown) => v != null && typeof v === "object" && !Array.isArray(v);
  if (!isObj(o.offices ?? {}) || !isObj(o.links ?? {})) throw new Error("Format invalid pentru birouri.");
  const offices: Record<string, OfficeChoice> = {};
  const oe = Object.entries((o.offices ?? {}) as Record<string, unknown>);
  const le = Object.entries((o.links ?? {}) as Record<string, unknown>);
  if (oe.length > MAX || le.length > MAX) throw new Error("Prea mulți oameni de salvat.");
  for (const [k, v] of oe) {
    if (!PERSON.test(k) || (k.startsWith("app:") && !UUID.test(k.slice(4)))) throw new Error(`Persoană necunoscută: ${k}`);
    if (!OFFICE_CHOICES.includes(v as OfficeChoice)) throw new Error(`Birou necunoscut: ${String(v)}`);
    offices[k] = v as OfficeChoice;
  }
  const links: Record<string, string> = {};
  for (const [k, v] of le) {
    if (!/^\d{1,9}$/.test(k)) throw new Error(`Cont Senior necunoscut: ${k}`);
    if (typeof v !== "string" || (v !== "" && !UUID.test(v))) throw new Error(`Utilizator necunoscut pentru contul Senior ${k}.`);
    links[k] = v;
  }
  return { offices, links };
}
