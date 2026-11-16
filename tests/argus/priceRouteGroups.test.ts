import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_PRICE_RULES, setPriceRules, validPriceRules } from "../../supabase/functions/_shared/priceRules";
import { buildRoutes, byRouteGroup, routeGroup } from "../../supabase/functions/_shared/priceSourceRules";
import { latestRoutes, truckRows } from "../../supabase/functions/_shared/priceList";

afterEach(() => setPriceRules(DEFAULT_PRICE_RULES));

// Bogdan, 16 nov 2026: curse of the same Ruta in Curse_distributie_Senior aaaaa(1).xlsx leave on the same truck → one shared lei/palet.
describe("distribution: curse of one route share the truck", () => {
  test("BUCURESTI and PLOIESTI share one lei/palet", () => {
    const points = [{ pid: 1, name: "METRO CASH & CARRY MILITARI", judet: "Bucuresti", pallets: 2508.1 }, { pid: 2, name: "BAMIS SOLUTIONS SRL - PLOIESTI", judet: "Prahova", pallets: 1109.5 }];
    const load = buildRoutes(points, [{ line: "TRANSPORT DIST BUCURESTI", trips: 358, total: 700000 }, { line: "TRANSPORT DIST PLOIESTI", trips: 52, total: 240000 }]).routes;
    const out = latestRoutes([{ ...load.find((r) => r.route === "BUCURESTI")!, trips: 116, total: 237060 }, { ...load.find((r) => r.route === "PLOIESTI")!, trips: 22, total: 102978 }], load);
    const b = out.find((r) => r.route === "BUCURESTI")!, p = out.find((r) => r.route === "PLOIESTI")!;
    const shared = ((237060 + 102978) / (116 + 22)) / ((2508.1 + 1109.5) / (358 + 52));
    expect(b.perPallet!).toBeCloseTo(shared, 6);
    expect(p.perPallet!).toBeCloseTo(shared, 6);
    expect(b.pool?.routes.sort()).toEqual(["BUCURESTI", "PLOIESTI"]);
  });
  test("BUCURESTI and PLOIESTI show as one truck row, not two", () => {
    const points = [{ pid: 1, name: "METRO CASH & CARRY MILITARI", judet: "Bucuresti", pallets: 2508.1 }, { pid: 2, name: "BAMIS SOLUTIONS SRL - PLOIESTI", judet: "Prahova", pallets: 1109.5 }];
    const load = buildRoutes(points, [{ line: "TRANSPORT DIST BUCURESTI", trips: 358, total: 700000 }, { line: "TRANSPORT DIST PLOIESTI", trips: 52, total: 240000 }]).routes;
    const out = latestRoutes([{ ...load.find((r) => r.route === "BUCURESTI")!, trips: 116, total: 237060 }, { ...load.find((r) => r.route === "PLOIESTI")!, trips: 22, total: 102978 }], load);
    const rows = truckRows(out, routeGroup);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Bucuresti - Ploiesti");
    expect(rows[0].trips).toBe(138);
    expect(rows[0].total).toBeCloseTo(340038, 6);
    expect(rows[0].pallets).toBeCloseTo(3617.6, 6);
    expect(rows[0].perPallet!).toBeCloseTo((340038 / 138) / (3617.6 / 410), 6);
  });
  test("TURDA + TURDA-IERNUT and LUGOJ + TIMISOARA are pooled; ROMAN + FOCSANI + MOLDOVA too", () => {
    const g = (c: string) => DEFAULT_PRICE_RULES.routeGroups.find((x) => x.routes.includes(c))!.routes;
    expect(g("TURDA")).toEqual(["TURDA", "TURDA-IERNUT"]);
    expect(g("LUGOJ")).toEqual(["LUGOJ", "TIMISOARA"]);
    expect(g("ROMAN")).toEqual(["ROMAN", "FOCSANI", "MOLDOVA"]);
  });
  test("a cursă alone on its route keeps its own tariff", () => {
    const load = buildRoutes([{ pid: 1, name: "MEGA IMAGE SRL - CRAIOVA", judet: "Dolj", pallets: 59.1 }], [{ line: "TRANSPORT DIST CRAIOVA", trips: 25, total: 22500 }]).routes;
    const c = latestRoutes([{ ...load[0], trips: 10, total: 9000 }], load)[0];
    expect(c.pool).toBeUndefined();
    expect(c.perPallet!).toBeCloseTo(900 / (59.1 / 25), 6);
  });
  test("a cursă cannot be on two routes", () => {
    const v = validPriceRules({ ...structuredClone(DEFAULT_PRICE_RULES), routeGroups: [{ name: "A", routes: ["ROMAN"] }, { name: "B", routes: ["ROMAN", "CRAIOVA"] }] });
    expect("error" in v).toBe(true);
  });
  test("curse are grouped by the table's route", () => {
    expect(routeGroup("PLOIESTI")).toBe("Bucuresti - Ploiesti");
    expect(routeGroup("TURDA-IERNUT")).toBe("Cluj-Turda-Iernut");
    expect(routeGroup("FOCSANI")).toBe("Moldova RO");
    expect(routeGroup("MOLDOVA ICS")).toBe("Rep Moldova");
    expect(routeGroup("LUGOJ")).toBe("Timisoara-Lugoj");
    const order = byRouteGroup([{ route: "TIMISOARA", total: 6783 }, { route: "PLOIESTI", total: 102978 }, { route: "LUGOJ", total: 17309 }, { route: "BUCURESTI", total: 237060 }]).map((r) => r.route);
    expect(order).toEqual(["BUCURESTI", "PLOIESTI", "LUGOJ", "TIMISOARA"]);
  });
});
