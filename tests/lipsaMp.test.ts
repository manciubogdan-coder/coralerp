import { describe, it, expect } from "bun:test";
import { workedHours } from "../src/lib/productie/lipsaMp";
describe("workedHours", () => {
  it("merges overlapping sessions on the same line", () => {
    expect(workedHours([
      { linie_id: "a", ora_start: "2026-11-10T08:00:00Z", ora_sfarsit: "2026-11-10T09:00:00Z" },
      { linie_id: "a", ora_start: "2026-11-10T08:30:00Z", ora_sfarsit: "2026-11-10T09:30:00Z" },
    ])).toBe(1.5);
  });
  it("ignores open sessions", () => {
    expect(workedHours([{ linie_id: "a", ora_start: "2026-11-10T08:00:00Z", ora_sfarsit: null }])).toBe(0);
  });
});
