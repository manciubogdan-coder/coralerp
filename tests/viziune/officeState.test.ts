import { describe, expect, it } from "vitest";
import { buildingOf, roomOrderOf, buildOffices, bucharestLocalToMs, officeFromRoles, officeFromSeniorGroup, samePerson, statusOf, validateOfficeConfig, type RawOffices } from "@/lib/viziune/officeState";

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
  it("raw-material warehouse accounts sit in the warehouse office, line operators have no office", () => {
    expect(officeFromRoles(["depozit_mp"])).toBe("depozit");
    expect(officeFromSeniorGroup("Gestiune depozit")).toBe("depozit");
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
    const base = raw();
    const v = buildOffices(raw({ app: { ...base.app, users: [...base.app.users, { id: "u4", name: "Vasile Operator", email: null, roles: ["operator"] }] } }), NOW);
    expect(v.people.some((p) => p.name === "Vasile Operator")).toBe(false);
    expect(v.offices.find((o) => o.id === "depozit")!.people.map((p) => p.name)).toEqual(["Ion Depozit"]);
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

describe("Viziune birouri: alegerile făcute de mână", () => {
  const withCfg = (offices: Record<string, any>, links: Record<string, string> = {}) => buildOffices({ ...raw(), config: { offices, links } }, NOW);
  it("an office chosen by hand wins over the Senior group guess", () => {
    const v = withCfg({ "app:u1": "vanzari" });
    const m = v.people.find((p) => p.name === "Mariana Matiu")!;
    expect(m.office).toBe("vanzari");
    expect(m.guess).toBe("contabilitate");
  });
  it("a hidden person is not shown anywhere but stays in the editor list", () => {
    const v = withCfg({ "app:u2": "hidden" });
    expect(v.people.some((p) => p.name === "Bogdan Manciu")).toBe(false);
    expect(v.roster.some((p) => p.name === "Bogdan Manciu")).toBe(true);
  });
  it("'no office' moves an active person to the list without office", () => {
    expect(withCfg({ "app:u2": "none" }).unassigned.some((p) => p.name === "Bogdan Manciu")).toBe(true);
  });
  it("a Senior account marked separate is never linked by name", () => {
    const v = withCfg({}, { "23": "" });
    expect(v.people.find((p) => p.name === "Mariana Matiu")!.seniorAccounts).toEqual([]);
    expect(v.roster.some((p) => p.key === "senior:23")).toBe(true);
  });
  it("a Senior account given to a person brings its documents to that person", () => {
    const v = withCfg({}, { "38": "u2" });
    expect(v.people.find((p) => p.name === "Bogdan Manciu")!.docs).toBe(100);
  });
  it("unknown offices and malformed people are refused before saving", () => {
    expect(() => validateOfficeConfig({ offices: { "app:u1": "vanzari" } })).toThrow(/Persoană/);
    expect(() => validateOfficeConfig({ offices: { "senior:23": "cantina" } })).toThrow(/Birou/);
    expect(validateOfficeConfig({ offices: { "senior:23": "hr" }, links: { "23": "" } })).toEqual({ offices: { "senior:23": "hr" }, links: { "23": "" }, order: [] });
  });
});

describe("Viziune birouri: ordinea camerelor", () => {
  const swapped = ["productie", "vanzari", "achizitii", "contabilitate", "hr", "ceo", "calitate", "mentenanta", "depozit"] as const;
  it("an order names each office at most once and only known offices", () => {
    expect(() => validateOfficeConfig({ order: ["ceo", "ceo"] })).toThrow(/Ordinea/);
    expect(() => validateOfficeConfig({ order: ["cantina"] })).toThrow(/Ordinea/);
    expect(validateOfficeConfig({ order: [...swapped] }).order).toEqual([...swapped]);
  });
  it("without a saved order: five offices in the building, three in the hall, the warehouse office in the raw-material warehouse", () => {
    const o = roomOrderOf([]);
    expect(o).toEqual(["ceo", "vanzari", "achizitii", "contabilitate", "hr", "productie", "calitate", "mentenanta", "depozit"]);
    expect(buildingOf("hr", o as any)).toBe("birouri");
    expect(buildingOf("productie", o as any)).toBe("hala");
    expect(buildingOf("depozit", o as any)).toBe("depozit");
  });
  it("an order saved before the warehouse office existed keeps its places and gets the warehouse office last", () => {
    const old = swapped.slice(0, 8);
    expect(roomOrderOf(old)).toEqual([...swapped]);
    expect(validateOfficeConfig({ order: old }).order).toEqual([...swapped]);
  });
  it("swapping CEO with Producție moves CEO into the hall and Producție into the building", () => {
    const v = buildOffices(raw({ config: { offices: {}, links: {}, order: [...swapped] } }), NOW);
    expect(v.offices.find((o) => o.id === "ceo")!.building).toBe("hala");
    expect(v.offices.find((o) => o.id === "productie")!.building).toBe("birouri");
  });
});
