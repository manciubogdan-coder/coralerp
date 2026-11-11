import { describe, expect, it } from "bun:test";
import { lastClosedPeriod } from "../src/lib/argus/costStructure";
const m = (period: string, sal: number, st: number) => [{ period, cont: "641", exp: sal }, { period, cont: "646", exp: st }];
describe("lastClosedPeriod", () => {
  it("skips the current month and a month without salaries booked", () => {
    const rows = [...m("202608", 800, 40), ...m("202609", 820, 41), ...m("202610", 0, 0), ...m("202611", 0, 0)];
    expect(lastClosedPeriod(rows, "202611")).toBe("202609");
  });
  it("skips a month with only part of salaries booked", () => {
    expect(lastClosedPeriod([...m("202608", 800, 40), ...m("202609", 800, 40), ...m("202610", 200, 40)], "202611")).toBe("202609");
  });
  it("accepts a complete previous month", () => {
    expect(lastClosedPeriod([...m("202609", 800, 40), ...m("202610", 790, 39)], "202611")).toBe("202610");
  });
});
