import { describe, expect, it } from "vitest";
import { caseIssues } from "./recipeCaseRules";

const row = (vq: number, units: string, lines = 5) => ({ id: 1, code: "P1", name: "Rucola 125 g", vq, units, lines, last: "2026-10-01" });

describe("recipe case audit", () => {
  it("flags a 1-piece recipe sold in cases of 6", () => {
    const [i] = caseIssues([row(1, "6")]);
    expect(i.recipeUnits).toBe(1);
    expect(i.caseUnits).toBe(6);
  });
  it("ignores a recipe that matches the case", () => {
    expect(caseIssues([row(6, "6")])).toHaveLength(0);
  });
  it("ignores products sold per piece", () => {
    expect(caseIssues([row(1, "1")])).toHaveLength(0);
  });
  it("uses the most invoiced case content and mixed cartons 6+2", () => {
    expect(caseIssues([row(1, "6", 1), row(1, "6+2", 9)])[0].caseUnits).toBe(8);
  });
});
