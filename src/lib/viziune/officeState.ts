// Offices of the company in Viziune: who sits where and what each person is doing today.
// Pure rules (no React or three): people come from app accounts and Senior accounts, offices are guessed
// from the Senior user group first, then from the app access rights.

export type OfficeId = "ceo" | "vanzari" | "contabilitate" | "achizitii" | "hr" | "productie" | "calitate" | "mentenanta";

export const OFFICES: Record<OfficeId, { label: string; building: "birouri" | "hala" }> = {
  ceo: { label: "Birou CEO", building: "birouri" },
  vanzari: { label: "Vânzări", building: "birouri" },
  achizitii: { label: "Achiziții", building: "birouri" },
  contabilitate: { label: "Contabilitate", building: "birouri" },
  hr: { label: "HR · Administrativ", building: "birouri" },
  productie: { label: "Birou producție", building: "hala" },
  calitate: { label: "Birou calitate", building: "hala" },
  mentenanta: { label: "Birou mentenanță", building: "hala" },
};
export const OFFICE_IDS = Object.keys(OFFICES) as OfficeId[];

/** App activity counts as "online now" while the last minute ping is this recent (pings are sent every minute). */
export const ONLINE_MS = 3 * 60_000;
/** A Senior document saved this recently means the person is working in Senior right now. */
export const SENIOR_NOW_MS = 15 * 60_000;

import { BUILDING_PLACES, roomOrderOf, type OfficeChoice, type OfficeConfig } from "../../../supabase/functions/_shared/officeConfigRules";
export { BUILDING_PLACES, OFFICE_CHOICES, ROOM_ORDER_DEFAULT, roomOrderOf, validateOfficeConfig, type OfficeChoice, type OfficeConfig } from "../../../supabase/functions/_shared/officeConfigRules";

/** Building of an office for a room order: the first places are in the offices building, the rest in the hall. */
export const buildingOf = (id: OfficeId, order: readonly OfficeId[]): "birouri" | "hala" => (order.indexOf(id) < BUILDING_PLACES ? "birouri" : "hala");

// ---------- raw data (as returned by the server action viziune_offices) ----------
export interface RawAppUser { id: string; name: string | null; email: string | null; roles: string[] }
export interface RawActivity { userId: string; name: string | null; email: string | null; seconds: number; lastAt: string; path: string; tab: string | null; pages: { path: string; tab: string | null; seconds: number }[] }
export interface RawSeniorUser { id: number; username: string; name: string | null; group: string | null; active: boolean }
export interface RawSeniorDocs { uid: number; cod: string; descr: string | null; n: number; val: number; last: string }
export interface RawSeniorRecent { uid: number; at: string; cod: string; descr: string | null; serie: string | null; nr: string | number | null; val: number | null; partner: string | null }
export interface RawOffices {
  day: string;
  generatedAt: string;
  app: { users: RawAppUser[]; activity: RawActivity[] };
  /** Choices made by hand in Viziune (who sits where, whose Senior account is); missing on old responses. */
  config?: OfficeConfig & { updatedBy?: string | null; updatedAt?: string | null };
  senior: { ok: true; users: RawSeniorUser[]; docs: RawSeniorDocs[]; edits: { uid: number; n: number; last: string }[]; recent: RawSeniorRecent[] } | { ok: false; error: string };
}

// ---------- office guesses ----------
const SENIOR_GROUPS: [RegExp, OfficeId][] = [
  [/contab|financ|econom/i, "contabilitate"],
  [/v[aâ]nz|comercial|sales|vanzari/i, "vanzari"],
  [/achiz|aprovizion/i, "achizitii"],
  [/calit/i, "calitate"],
  [/mentenan|tehnic/i, "mentenanta"],
  [/produc/i, "productie"],
  [/\bhr\b|resurse|personal|salariz/i, "hr"],
  [/director|manag|ceo|general/i, "ceo"],
];
/** Office of a Senior user group (e.g. "Contabilitate"); system and administrator groups have none. */
export function officeFromSeniorGroup(group: string | null | undefined): OfficeId | null {
  if (!group) return null;
  for (const [re, id] of SENIOR_GROUPS) if (re.test(group)) return id;
  return null;
}

const ROLE_OFFICE: [string, OfficeId][] = [
  ["calitate", "calitate"], ["mentenanta", "mentenanta"], ["evidenta_documente", "contabilitate"],
  ["picking_vanzari", "vanzari"], ["achizitii", "achizitii"], ["administrativ", "hr"], ["productie", "productie"],
];
/**
 * Office from the app access rights: the most specific department wins; an administrator with many
 * departments (or only the admin right) sits in the CEO office. Warehouse-only and line-operator accounts
 * work in the hall, not in an office.
 */
export function officeFromRoles(roles: string[]): OfficeId | null {
  const depts = roles.filter((r) => r !== "admin");
  if (roles.includes("admin") && (depts.length === 0 || depts.length >= 4)) return "ceo";
  for (const [role, id] of ROLE_OFFICE) if (roles.includes(role)) return id;
  return roles.includes("admin") ? "ceo" : null;
}

// ---------- linking app users and Senior accounts ----------
const GENERIC = new Set(["administrator", "admin", "ad", "productie", "test", "user"]);
export const normName = (s: string | null | undefined) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string | null | undefined) => normName(s).split(" ").filter((t) => t.length > 1);
/** Senior accounts shared by several people or without a real employee name ("Administrator", "ad"). */
export const isGenericSeniorName = (name: string | null | undefined) => { const n = normName(name); return !n || GENERIC.has(n); };

/**
 * Same person when every word of the shorter full name (at least two words, any order: Senior writes the
 * surname first) is in the other one, or when the Senior username is the app e-mail's local part.
 */
export function samePerson(app: { name: string | null; email: string | null }, senior: { username: string; name: string | null }) {
  if (!isGenericSeniorName(senior.name)) {
    const a = tokens(app.name), b = tokens(senior.name);
    const [short, long] = a.length <= b.length ? [a, new Set(b)] : [b, new Set(a)];
    if (short.length >= 2 && short.every((t) => long.has(t))) return true;
  }
  const local = normName((app.email ?? "").split("@")[0]).replace(/ /g, "");
  const user = normName(senior.username).replace(/ /g, "");
  return user.length >= 4 && !GENERIC.has(user) && local === user;
}

// ---------- views ----------
export type PersonStatus = "aplicatie" | "senior" | "azi" | "absent";
export interface DocType { cod: string; descr: string; n: number; value: number }
export interface PersonView {
  key: string;
  name: string;
  office: OfficeId | null;
  /** Why this office: shown so a wrong guess is easy to spot. */
  reason: string;
  status: PersonStatus;
  /** Last sign of work today (app ping or Senior document), ms. */
  lastAt: number | null;
  page: string | null;
  tab: string | null;
  appSeconds: number;
  pages: { path: string; tab: string | null; seconds: number }[];
  seniorAccounts: string[];
  docs: number;
  edits: number;
  docTypes: DocType[];
  recent: RawSeniorRecent[];
  lastSeniorAt: string | null;
  /** Office chosen by hand in Viziune (wins over the guess), if any. */
  manual: OfficeChoice | null;
  /** The guessed office, shown in the editor next to the choice. */
  guess: OfficeId | null;
  hidden: boolean;
  /** Ids behind the person, for the editor. */
  appUserId: string | null;
  email: string | null;
  seniorIds: number[];
}
export interface OfficeView { id: OfficeId; label: string; building: "birouri" | "hala"; people: PersonView[]; onlineNow: number; activeToday: number; docs: number; appSeconds: number }

/** Senior times are local Bucharest wall-clock strings ("2026-11-14 14:01:00"). */
export function bucharestLocalToMs(s: string): number {
  const asUtc = Date.parse(s.replace(" ", "T").slice(0, 19) + "Z");
  if (!Number.isFinite(asUtc)) return NaN;
  const d = new Date(asUtc);
  const local = Date.parse(d.toLocaleString("en-US", { timeZone: "Europe/Bucharest" }) + " UTC");
  const utc = Date.parse(d.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC");
  return asUtc - (local - utc);
}

export function statusOf(p: { lastAppAt: number | null; lastSeniorMs: number | null; appSeconds: number; docs: number; edits: number }, now: number): PersonStatus {
  if (p.lastAppAt != null && now - p.lastAppAt <= ONLINE_MS) return "aplicatie";
  if (p.lastSeniorMs != null && now - p.lastSeniorMs <= SENIOR_NOW_MS) return "senior";
  if (p.appSeconds > 0 || p.docs > 0 || p.edits > 0) return "azi";
  return "absent";
}

const STATUS_RANK: Record<PersonStatus, number> = { aplicatie: 0, senior: 1, azi: 2, absent: 3 };

/** Builds every person (app user and/or Senior account) and groups them into offices. */
export function buildOffices(raw: RawOffices | null | undefined, now: number) {
  const order = roomOrderOf(raw?.config?.order) as OfficeId[];
  const empty = { order, offices: OFFICE_IDS.map((id) => ({ id, ...OFFICES[id], building: buildingOf(id, order), people: [], onlineNow: 0, activeToday: 0, docs: 0, appSeconds: 0 })) as OfficeView[], unassigned: [] as PersonView[], people: [] as PersonView[], roster: [] as PersonView[], seniorUsers: [] as RawSeniorUser[], config: { offices: {}, links: {}, order: [] } as OfficeConfig, seniorError: null as string | null, docTotals: new Map<string, DocType>() };
  if (!raw) return empty;
  const senior = raw.senior.ok ? raw.senior : null;
  const activity = new Map(raw.app.activity.map((a) => [a.userId, a]));
  const appUsers = [...raw.app.users];
  // Someone active today without a profile row still appears.
  for (const a of raw.app.activity) if (!appUsers.some((u) => u.id === a.userId)) appUsers.push({ id: a.userId, name: a.name, email: a.email, roles: [] });

  const seniorUsers = (senior?.users ?? []).filter((u) => u.id > 0);
  const docsBy = new Map<number, RawSeniorDocs[]>();
  for (const d of senior?.docs ?? []) docsBy.set(d.uid, [...(docsBy.get(d.uid) ?? []), d]);
  const editsBy = new Map((senior?.edits ?? []).map((e) => [e.uid, e]));
  const recentBy = new Map<number, RawSeniorRecent[]>();
  for (const r of senior?.recent ?? []) recentBy.set(r.uid, [...(recentBy.get(r.uid) ?? []), r]);
  const docTotals = new Map<string, DocType>();
  for (const d of senior?.docs ?? []) {
    const t = docTotals.get(d.cod) ?? { cod: d.cod, descr: d.descr ?? d.cod, n: 0, value: 0 };
    t.n += Number(d.n) || 0; t.value += Number(d.val) || 0; docTotals.set(d.cod, t);
  }

  const config: OfficeConfig = { offices: raw.config?.offices ?? {}, links: raw.config?.links ?? {}, order: raw.config?.order ?? [] };
  const linked = new Map<string, RawSeniorUser[]>();
  const usedSenior = new Set<number>();
  for (const su of seniorUsers) {
    // A link chosen by hand wins; "" means a separate account that is never matched by name.
    const chosen = config.links[String(su.id)];
    if (chosen !== undefined) {
      if (chosen && appUsers.some((u) => u.id === chosen)) { linked.set(chosen, [...(linked.get(chosen) ?? []), su]); usedSenior.add(su.id); }
      continue;
    }
    const matches = appUsers.filter((u) => samePerson(u, su));
    if (matches.length === 1) { linked.set(matches[0].id, [...(linked.get(matches[0].id) ?? []), su]); usedSenior.add(su.id); }
  }

  const make = (key: string, name: string, accounts: RawSeniorUser[], app: RawAppUser | null): PersonView => {
    const act = app ? activity.get(app.id) : undefined;
    const types = accounts.flatMap((a) => docsBy.get(a.id) ?? []);
    const byCod = new Map<string, DocType>();
    for (const d of types) { const t = byCod.get(d.cod) ?? { cod: d.cod, descr: d.descr ?? d.cod, n: 0, value: 0 }; t.n += Number(d.n) || 0; t.value += Number(d.val) || 0; byCod.set(d.cod, t); }
    const docs = types.reduce((s, d) => s + (Number(d.n) || 0), 0);
    const edits = accounts.reduce((s, a) => s + (Number(editsBy.get(a.id)?.n) || 0), 0);
    const lastSenior = [...types.map((d) => d.last), ...accounts.map((a) => editsBy.get(a.id)?.last ?? "")].filter(Boolean).sort().pop() ?? null;
    const lastSeniorMs = lastSenior ? bucharestLocalToMs(lastSenior) : null;
    const lastAppAt = act ? Date.parse(act.lastAt) : null;
    const appSeconds = act?.seconds ?? 0;
    // Inactive Senior accounts and app accounts nobody used today are left out unless they belong to an office.
    const group = accounts.map((a) => officeFromSeniorGroup(a.group)).find(Boolean) ?? null;
    const byRole = app ? officeFromRoles(app.roles) : null;
    const guess = group ?? byRole;
    const manual = config.offices[key] ?? null;
    const office = manual ? (manual === "none" || manual === "hidden" ? null : manual) : guess;
    const reason = manual ? "alegerea ta din „Pune oamenii pe birouri”" : group ? `grupa Senior „${accounts.find((a) => officeFromSeniorGroup(a.group))!.group}"` : byRole ? (byRole === "ceo" ? "administrator în aplicație" : "drepturile din aplicație") : "fără departament de birou";
    const recent = accounts.flatMap((a) => recentBy.get(a.id) ?? []).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
    return {
      key, name, office, reason,
      status: statusOf({ lastAppAt, lastSeniorMs, appSeconds, docs, edits }, now),
      lastAt: Math.max(lastAppAt ?? 0, Number.isFinite(lastSeniorMs) ? lastSeniorMs ?? 0 : 0) || null,
      page: act?.path ?? null, tab: act?.tab ?? null, appSeconds,
      pages: act?.pages ?? [],
      seniorAccounts: accounts.map((a) => a.username),
      docs, edits, docTypes: [...byCod.values()].sort((a, b) => b.n - a.n), recent,
      lastSeniorAt: lastSenior,
      manual, guess, hidden: manual === "hidden",
      appUserId: app?.id ?? null, email: app?.email ?? null, seniorIds: accounts.map((a) => a.id),
    };
  };

  const roster: PersonView[] = [];
  for (const u of appUsers) roster.push(make(`app:${u.id}`, u.name || u.email || "Utilizator", linked.get(u.id) ?? [], u));
  for (const su of seniorUsers) {
    if (usedSenior.has(su.id)) continue;
    roster.push(make(`senior:${su.id}`, seniorLabel(su), [su], null));
  }
  // Shown in the scene: people placed in an office (by hand or guess) or active today, never hidden ones.
  // Inactive Senior accounts not placed by hand appear only if they did something today.
  const people = roster.filter((p) => {
    if (p.hidden) return false;
    const active = p.appSeconds > 0 || p.docs > 0 || p.edits > 0;
    if (active) return true;
    if (!p.office) return false;
    if (!p.manual && !p.appUserId && p.seniorIds.every((id) => !seniorUsers.find((u) => u.id === id)?.active)) return false;
    return true;
  });
  const sortPeople = (a: PersonView, b: PersonView) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (b.lastAt ?? 0) - (a.lastAt ?? 0) || a.name.localeCompare(b.name, "ro");
  people.sort(sortPeople);

  const offices: OfficeView[] = OFFICE_IDS.map((id) => {
    const ps = people.filter((p) => p.office === id);
    return {
      id, ...OFFICES[id], building: buildingOf(id, order), people: ps,
      onlineNow: ps.filter((p) => p.status === "aplicatie" || p.status === "senior").length,
      activeToday: ps.filter((p) => p.status !== "absent").length,
      docs: ps.reduce((s, p) => s + p.docs, 0),
      appSeconds: ps.reduce((s, p) => s + p.appSeconds, 0),
    };
  });
  roster.sort((a, b) => a.name.localeCompare(b.name, "ro"));
  return { order, offices, unassigned: people.filter((p) => !p.office), people, roster, seniorUsers, config, seniorError: "error" in raw.senior ? raw.senior.error : null, docTotals };
}
export type OfficesView = ReturnType<typeof buildOffices>;

export const seniorLabel = (su: RawSeniorUser) => (isGenericSeniorName(su.name) ? `${su.username} (cont comun Senior)` : `${titleCase(su.name!)} · ${su.username}`);

function titleCase(s: string) { return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()); }
