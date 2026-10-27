import { describe, it, expect } from "vitest";
import { forecastGroupOf, suggestedOrderFor } from "../src/lib/forecastGroups";

describe("forecast groups", () => {
  it("vegetables and fruits get their own list", () => {
    expect(forecastGroupOf("Rosii cherry")).toBe("Legume și fructe");
    expect(forecastGroupOf("Rucola")).toBe("Salate");
    expect(forecastGroupOf("Ceapa verde")).toBe("Aromate");
  });
  it("suggested order covers today, tomorrow and day after minus start stock", () => {
    expect(suggestedOrderFor(50, [20, 30, 40], 0, 25)).toBe(5);
    expect(suggestedOrderFor(10, [20, 30, 40], 0, 25)).toBe(45);
  });
});

import { palletKgFor as _pk } from "../src/lib/forecastGroups";
import { test as _t, expect as _e } from "vitest";
_t("kg pe palet", () => {
  _e(_pk("Capatani salata verde")).toBe(400);
  _e(_pk("Radicchio rosu")).toBe(500);
  _e(_pk("Baby spanac bio")).toBe(220);
  _e(_pk("Busuioc")).toBe(220);
});
