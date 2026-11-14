// Viziune offices chosen by hand: which office each person sits in and whose each Senior account is.
// Shared by the page (editing) and the argus function (validating before saving for everyone). No React, no Deno.

/** Default order of the offices over the room places: the first BUILDING_PLACES are in the offices building, the rest in the hall. */
export const ROOM_ORDER_DEFAULT = ["ceo", "vanzari", "achizitii", "contabilitate", "hr", "productie", "calitate", "mentenanta"] as const;
export type RoomOfficeId = typeof ROOM_ORDER_DEFAULT[number];
export const BUILDING_PLACES = 5;

export const OFFICE_CHOICES = ["ceo", "vanzari", "achizitii", "contabilitate", "hr", "productie", "calitate", "mentenanta", "none", "hidden"] as const;
export type OfficeChoice = typeof OFFICE_CHOICES[number];
export interface OfficeConfig {
  /** person key (`app:<uuid>` or `senior:<id>`) → office, "none" (no office) or "hidden" (not shown). */
  offices: Record<string, OfficeChoice>;
  /** Senior account id → app user id it belongs to, or "" = a separate account, never linked by name. */
  links: Record<string, string>;
  /** Which office stands in each room place (all offices, each once) or [] = default order. */
  order: RoomOfficeId[];
}
export const EMPTY_OFFICE_CONFIG: OfficeConfig = { offices: {}, links: {}, order: [] };

/** The saved order when it names every office exactly once, otherwise the default order. */
export function roomOrderOf(order: readonly string[] | null | undefined): RoomOfficeId[] {
  const ok = Array.isArray(order) && order.length === ROOM_ORDER_DEFAULT.length && ROOM_ORDER_DEFAULT.every((id) => order.includes(id));
  return ok ? [...order] as RoomOfficeId[] : [...ROOM_ORDER_DEFAULT];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERSON = /^(app:[0-9a-f-]{36}|senior:\d{1,9})$/i;
const MAX = 1000;

export function validateOfficeConfig(input: unknown): OfficeConfig {
  const o = (input ?? {}) as { offices?: unknown; links?: unknown; order?: unknown; room_order?: unknown };
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
  const rawOrder = o.order ?? o.room_order ?? [];
  if (!Array.isArray(rawOrder)) throw new Error("Ordinea birourilor nu e o listă.");
  if (rawOrder.length && (rawOrder.length !== ROOM_ORDER_DEFAULT.length || new Set(rawOrder).size !== rawOrder.length || !rawOrder.every((x) => ROOM_ORDER_DEFAULT.includes(x as RoomOfficeId)))) {
    throw new Error("Ordinea birourilor trebuie să conțină fiecare birou o singură dată.");
  }
  return { offices, links, order: rawOrder as RoomOfficeId[] };
}
