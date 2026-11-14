import { describe, expect, it } from "vitest";
import { buildOffices, bucharestLocalToMs, officeFromRoles, officeFromSeniorGroup, samePerson, statusOf, type RawOffices } from "@/lib/viziune/officeState";

const NOW = Date.parse("2026-11-14T12:50:00Z"); // 14:50 in Bucharest
const raw = (over: Partial<RawOffices> = {}): RawOffices => ({
  day: "2026-11-14", generatedAt: "2026-11-14T12:50:00Z",
  app: {
    users: [
      { id: "u1", name: "Mariana Matiu", email: "mariana@coral.ro", roles: ["picking_vanzari"] },
      { id: "u2", name: "Bogdan Manciu", email: "bogdan@coral.ro", roles: ["admin", "achizitii", "productie", "calitate", "mentenanta"] },
      { id: "u3", name: "Ion Depozit", email: "ion@coral.ro", roles: ["depozit_mp"] },
    ],
    activity: [{ userId: "u2", name: "Bogdan Manciu", email: "bogdan@coral.ro", seconds: 3600, lastAt: "2026-11-14T12:49:00Z", path: "/administrativ", tab: null, pages: [] }],
  },
  senior: {
    ok: true,
    users: [
      { id: 23, username: "mariana", name: "MATIU MARIANA", group: "Contabilitate", active: true },
      { id: 38, username: "senioradmin", name: "ad", group: "Administrator", active: true },
    ],
    docs: [
      { uid: 23, cod: "FC", descr: "Factură client", n: 4, val: 1000, last: "2026-11-14 14:45:00" },
      { uid: 38, cod: "OPCCB", descr: "Extras", n: 100, val: 0, last: "2026-11-14 12:00:00" },
    ],
    edits: [], recent: [],
  },
  ...over,
});

describe("Viziune birouri: cine stă în ce birou", () => {
  it("the Senior user group decides the office before the app rights", () => {
    const v = buildOffices(raw(), NOW);
    const m = v.people.find((p) => p.name === "Mariana Matiu")!;
    expect(m.office).toBe("contabilitate");
    expect(m.seniorAccounts).toEqual(["mariana"]);
  });
  it("an administrator with many departments sits in the CEO office", () => {
    expect(officeFromRoles(["admin", "achizitii", "productie", "calitate", "mentenanta"])).toBe("ceo");
    expect(officeFromRoles(["admin"])).toBe("ceo");
  });
  it("a single department right gives that office", () => {
    expect(officeFromRoles(["calitate"])).toBe("calitate");
    expect(officeFromRoles(["picking_vanzari"])).toBe("vanzari");
  });
  it("warehouse-only and line-operator accounts have no office", () => {
    expect(officeFromRoles(["depozit_mp"])).toBeNull();
    expect(officeFromRoles(["operator"])).toBeNull();
  });
  it("Senior groups map to offices; administrator/system groups do not", () => {
    expect(officeFromSeniorGroup("Vanzari")).toBe("vanzari");
    expect(officeFromSeniorGroup("Achizitii")).toBe("achizitii");
    expect(officeFromSeniorGroup("Administrator")).toBeNull();
    expect(officeFromSeniorGroup("ErpSystem")).toBeNull();
  });
  it("names match in any order (Senior writes the surname first), generic accounts never match by name", () => {
    expect(samePerson({ name: "Mariana Matiu", email: null }, { username: "x", name: "MATIU MARIANA" })).toBe(true);
    expect(samePerson({ name: "Ana Pop", email: null }, { username: "x", name: "MATIU MARIANA" })).toBe(false);
    expect(samePerson({ name: "Administrator", email: null }, { username: "ad", name: "Administrator" })).toBe(false);
  });
  it("shared Senior accounts without an office are listed apart, not put in an office", () => {
    const v = buildOffices(raw(), NOW);
    const shared = v.unassigned.find((p) => p.seniorAccounts.includes("senioradmin"))!;
    expect(shared.office).toBeNull();
    expect(shared.docs).toBe(100);
  });
  it("app users without an office and without activity today are not shown", () => {
    expect(buildOffices(raw(), NOW).people.some((p) => p.name === "Ion Depozit")).toBe(false);
  });
});

describe("Viziune birouri: ce face acum", () => {
  it("online in the app while the last minute ping is at most 3 minutes old", () => {
    expect(statusOf({ lastAppAt: NOW - 3 * 60_000, lastSeniorMs: null, appSeconds: 60, docs: 0, edits: 0 }, NOW)).toBe("aplicatie");
    expect(statusOf({ lastAppAt: NOW - 4 * 60_000, lastSeniorMs: null, appSeconds: 60, docs: 0, edits: 0 }, NOW)).toBe("azi");
  });
  it("working in Senior when a document was saved in the last 15 minutes", () => {
    const v = buildOffices(raw(), NOW);
    expect(v.people.find((p) => p.name === "Mariana Matiu")!.status).toBe("senior"); // FC at 14:45 Bucharest
    expect(statusOf({ lastAppAt: null, lastSeniorMs: NOW - 16 * 60_000, appSeconds: 0, docs: 1, edits: 0 }, NOW)).toBe("azi");
  });
  it("Senior local times are read as Bucharest time", () => {
    expect(bucharestLocalToMs("2026-11-14 14:50:00")).toBe(NOW);
    expect(bucharestLocalToMs("2026-07-01 15:00:00")).toBe(Date.parse("2026-07-01T12:00:00Z"));
  });
  it("company totals per document type add up every account", () => {
    expect(buildOffices(raw(), NOW).docTotals.get("FC")).toMatchObject({ n: 4, value: 1000 });
  });
  it("when Senior cannot be read the app activity is still shown", () => {
    const v = buildOffices(raw({ senior: { ok: false, error: "timeout" } }), NOW);
    expect(v.seniorError).toBe("timeout");
    expect(v.people.find((p) => p.name === "Bogdan Manciu")!.status).toBe("aplicatie");
  });
});
