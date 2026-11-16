import { describe, expect, it } from "vitest";
import { CLIENT_AVERAGE_ROUTE, clientDefaultRoute } from "./priceList";

const all = (r: string) => ["România", "BULGARIA", "MOLDOVA ICS", "LINELLA", CLIENT_AVERAGE_ROUTE].includes(r);

describe("default cursă of a whole client", () => {
  it("Romanian client → internal curse average", () => {
    expect(clientDefaultRoute([{ country: "ROMANIA", route: "BUCURESTI", pallets: 10 }, { country: "", route: "ROMAN", pallets: 5 }], all)).toBe("România");
  });
  it("Bulgarian client → BULGARIA", () => {
    expect(clientDefaultRoute([{ country: "BULGARIA", route: "BULGARIA", pallets: 3 }], all)).toBe("BULGARIA");
  });
  it("Moldova ICS → MOLDOVA ICS", () => {
    expect(clientDefaultRoute([{ country: "MOLDOVA", judet: "CHISINAU", route: "MOLDOVA ICS", pallets: 2 }], all)).toBe("MOLDOVA ICS");
  });
  it("Moldova client on the Linella truck keeps its own cursă", () => {
    expect(clientDefaultRoute([{ country: "MOLDOVA", route: "LINELLA", pallets: 8 }], all)).toBe("LINELLA");
  });
  it("any other foreign client → client average of all stores", () => {
    expect(clientDefaultRoute([{ country: "UNGARIA", route: null, pallets: 4 }], all)).toBe(CLIENT_AVERAGE_ROUTE);
  });
});
