// Viziune offices: who used the app today (minute pings) and what each Senior account saved today.
// Read-only: app profiles/rights from the operational DB, pings from Cloud, documents live from Senior.
import { seniorLive, seniorSqlAll } from "./senior.ts";
import { bucharestDay, endIso, fetchAll, startIso, type Clients } from "./appData.ts";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => any };
const TODAY = "h.Created_On >= CAST(GETDATE() AS date)";
const H = "dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID = h.Tip_Document_ID";

async function seniorToday(sb: Rpc) {
  const users = await seniorLive(sb, "sql", { sql: "SELECT u.User_ID AS id, u.UserName AS username, u.Nume_Angajat AS name, CAST(ISNULL(u.IsActiv,0) AS int) AS active, g.Denumire AS grp FROM dbo.A_Useri u WITH (NOLOCK) LEFT JOIN dbo.A_GrupeUseri g WITH (NOLOCK) ON g.PK_Grupa = u.Grupa_ID WHERE u.User_ID > 0" }, 40000);
  const docs = await seniorSqlAll(sb, `SELECT h.Created_By_ID AS uid, t.Cod AS cod, MAX(t.Descriere) AS descr, COUNT(*) AS n, SUM(CAST(ISNULL(h.Valoare_Rol,0) AS float)) AS val, CONVERT(varchar(19), MAX(h.Created_On), 120) AS last_on FROM ${H} WHERE ${TODAY} AND ISNULL(h.Anulat,0) = 0 GROUP BY h.Created_By_ID, t.Cod`, "h.Created_By_ID, t.Cod", 40000);
  const edits = await seniorLive(sb, "sql", { sql: `SELECT TOP 400 h.Last_Modifyed_By_ID AS uid, COUNT(*) AS n, CONVERT(varchar(19), MAX(h.Last_Modifyed_On), 120) AS last_on FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) WHERE h.Last_Modifyed_On >= CAST(GETDATE() AS date) AND h.Last_Modifyed_By_ID IS NOT NULL AND NOT (${TODAY} AND h.Created_By_ID = h.Last_Modifyed_By_ID) GROUP BY h.Last_Modifyed_By_ID` }, 40000);
  const recent = await seniorLive(sb, "sql", { sql: `SELECT x.uid, CONVERT(varchar(19), x.Created_On, 120) AS at_, x.cod, x.descr, x.serie, x.nr, x.val, p.Partener_Denumire AS partner FROM (SELECT h.H_ID, h.Created_By_ID AS uid, h.Created_On, t.Cod AS cod, t.Descriere AS descr, h.Serie_Document_Primar AS serie, h.Numar_Document_Primar AS nr, CAST(h.Valoare_Rol AS float) AS val, ROW_NUMBER() OVER (PARTITION BY h.Created_By_ID ORDER BY h.Created_On DESC, h.H_ID DESC) AS rn FROM ${H} WHERE ${TODAY} AND ISNULL(h.Anulat,0) = 0) x OUTER APPLY (SELECT TOP 1 pp.Partener_Denumire FROM dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) WHERE pp.H_ID = x.H_ID ORDER BY pp.TipPartener) p WHERE x.rn <= 8` }, 40000);
  const arr = (r: unknown) => (Array.isArray(r) ? r : []) as any[];
  return {
    users: arr(users).map((u) => ({ id: Number(u.id), username: String(u.username ?? ""), name: u.name ?? null, group: u.grp ?? null, active: Number(u.active) === 1 })),
    docs: arr(docs).map((d) => ({ uid: Number(d.uid), cod: String(d.cod ?? ""), descr: d.descr ?? null, n: Number(d.n) || 0, val: Number(d.val) || 0, last: String(d.last_on ?? "") })),
    edits: arr(edits).map((e) => ({ uid: Number(e.uid), n: Number(e.n) || 0, last: String(e.last_on ?? "") })),
    recent: arr(recent).map((r) => ({ uid: Number(r.uid), at: String(r.at_ ?? ""), cod: String(r.cod ?? ""), descr: r.descr ?? null, serie: r.serie ?? null, nr: r.nr ?? null, val: r.val == null ? null : Number(r.val), partner: r.partner ?? null })),
  };
}

export async function officeActivity(c: Clients) {
  const day = bucharestDay();
  const [profiles, roles, pings, senior] = await Promise.all([
    fetchAll(c.legacyUser, "app_profiles", "user_id,email,name,approved"),
    fetchAll(c.legacyUser, "app_user_roles", "user_id,role"),
    fetchAll(c.cloud, "app_activity_pings", "id,user_id,email,display_name,path,tab,seconds,occurred_at",
      (q) => q.gte("occurred_at", startIso(day)).lte("occurred_at", endIso(day)).order("occurred_at").order("id"), 100000),
    seniorToday(c.cloud).then((v) => ({ ok: true as const, ...v }), (e) => ({ ok: false as const, error: (e as Error).message })),
  ]);
  const rolesBy = new Map<string, string[]>();
  for (const r of roles) rolesBy.set(r.user_id, [...(rolesBy.get(r.user_id) ?? []), String(r.role)]);
  const users = profiles.filter((p) => p.approved !== false).map((p) => ({ id: String(p.user_id), name: p.name ?? null, email: p.email ?? null, roles: rolesBy.get(p.user_id) ?? [] }));

  // Pings arrive in time order: the last one per user says where they are now.
  const act = new Map<string, { userId: string; name: string | null; email: string | null; seconds: number; lastAt: string; path: string; tab: string | null; pages: Map<string, { path: string; tab: string | null; seconds: number }> }>();
  for (const p of pings) {
    const a = act.get(p.user_id) ?? { userId: p.user_id, name: p.display_name ?? null, email: p.email ?? null, seconds: 0, lastAt: p.occurred_at, path: p.path, tab: p.tab ?? null, pages: new Map() };
    const secs = Number(p.seconds) || 0;
    a.seconds += secs;
    if (p.occurred_at >= a.lastAt) { a.lastAt = p.occurred_at; a.path = p.path; a.tab = p.tab ?? null; }
    const k = `${p.path}\u0000${p.tab ?? ""}`;
    const pg = a.pages.get(k) ?? { path: p.path, tab: p.tab ?? null, seconds: 0 };
    pg.seconds += secs; a.pages.set(k, pg);
    act.set(p.user_id, a);
  }
  const activity = [...act.values()].map((a) => ({ ...a, pages: [...a.pages.values()].sort((x, y) => y.seconds - x.seconds).slice(0, 5) }));
  return { day, generatedAt: new Date().toISOString(), app: { users, activity }, senior };
}
