import { describe, expect, it } from "vitest";
import { buildRoutes } from "./priceSourceRules";

describe("Moldova cursă", () => {
  it("ICS Metro Moldova takes the Linella truck tariff when MOLDOVA ICS has no trips", () => {
    const points = [
      { pid: 1, name: "MOLDRETAIL GROUP SRL", judet: "CHISINAU", country: "MOLDOVA", pallets: 10 },
      { pid: 2, name: "ICS METRO CASH & CARRY MOLDOVA", judet: "CHISINAU", country: "MOLDOVA", pallets: 10 },
    ];
    const r = buildRoutes(points, [{ line: "TRANSPORT DIST LINELLA", trips: 4, total: 8000, qty: 4, pmin: 2000, pmax: 2000 }]);
    const lin = r.routes.find((x) => x.route === "LINELLA")!;
    expect(lin.country).toBe("Moldova");
    expect(lin.pallets).toBe(20);
    expect(lin.perPallet).toBe(400);
    expect(r.unassigned).toHaveLength(0);
  });
});
