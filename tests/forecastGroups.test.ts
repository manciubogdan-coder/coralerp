import { describe, it, expect } from "vitest";
import { forecastGroupOf, suggestedOrderFor } from "../src/lib/forecastGroups";

describe("forecast groups", () => {
  it("vegetables and fruits get their own list", () => {
    expect(forecastGroupOf("Rosii cherry")).toBe("Legume și fructe");
    expect(forecastGroupOf("Rucola")).toBe("Salate");
    expect(forecastGroupOf("Ceapa verde")).toBe("Aromate");
  });
  it("suggested order covers today, tomorrow and day after minus start stock", () => {
    expect(suggestedOrderFor(50, [20, 30, 40], 0)).toBe(40);
    expect(suggestedOrderFor(200, [20, 30, 40], 0)).toBe(0);
  });
});
