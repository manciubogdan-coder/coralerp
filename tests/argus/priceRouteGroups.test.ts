import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_PRICE_RULES, setPriceRules } from "../../supabase/functions/_shared/priceRules";
import { buildRoutes, byRouteGroup, routeGroup } from "../../supabase/functions/_shared/priceSourceRules";
import { latestRoutes } from "../../supabase/functions/_shared/priceList";

afterEach(() => setPriceRules(DEFAULT_PRICE_RULES));

// Curse_distributie_Senior aaaaa(1).xlsx (Bogdan, 16 nov 2026): lei/palet per cursă, no shared tariff.
describe("distribution as in the user's table", () => {
  test("no cursă pairs by default", () => {
    expect(DEFAULT_PRICE_RULES.routePairs).toEqual([]);
  });
  test("TURDA and TURDA-IERNUT keep their own lei/palet", () => {
    const points = [{ pid: 1, name: "BAMIS SOLUTIONS SRL - TURDA", judet: "Cluj", pallets: 628.1 }, { pid: 2, name: "LIDL DISCOUNT SRL - IERNUT", judet: "Mures", pallets: 167.7 }];
    const load = buildRoutes(points, [{ line: "TRANSPORT DIST TURDA", trips: 69, total: 120000 }, { line: "TRANSPORT DIST TURDA-IERNUT", trips: 52, total: 100000 }]).routes;
    const out = latestRoutes([{ ...load[0], route: "TURDA", trips: 25, total: 43612 }, { ...load[1], route: "TURDA-IERNUT", trips: 19, total: 38608 }], load);
    const t = out.find((r) => r.route === "TURDA")!, i = out.find((r) => r.route === "TURDA-IERNUT")!;
    expect(t.pool).toBeUndefined();
    expect(t.perPallet!).toBeCloseTo((43612 / 25) / (628.1 / 69), 6);
    expect(i.perPallet!).toBeCloseTo((38608 / 19) / (167.7 / 52), 6);
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
