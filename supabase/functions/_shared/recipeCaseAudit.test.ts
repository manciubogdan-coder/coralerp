import { describe, expect, it } from "vitest";
import { recipeChecks, type RecipeRow } from "./recipeCaseRules";

let n = 0;
const comp = (pname: string, vq: number, name: string, q: number, um = "BUC", extra: Partial<RecipeRow> = {}): RecipeRow =>
  ({ pa: 1, pcode: "P1", pname, vid: 10, vq, impl: 1, ds: "2026-01-01", id: ++n, name, q, um, ...extra });

describe("recipe case audit", () => {
  it("flags a recipe with 4 caserole and 4 labels marked as 1 piece, suggesting 4", () => {
    const [c] = recipeChecks([comp("RUCOLA 500G LINELLA", 1, "CASEROLA GASTRO 500 gr", 4), comp("RUCOLA 500G LINELLA", 1, "ETICHETE CORAL", 4), comp("RUCOLA 500G LINELLA", 1, "RUCOLA", 2.016, "KG")]);
    expect(c.status).toBe("case_as_piece");
    expect(c.suggestedUnits).toBe(4);
  });
  it("accepts a 1-piece recipe with one caserola and one label", () => {
    const [c] = recipeChecks([comp("RUCOLA 125G", 1, "CASEROLE 900", 1), comp("RUCOLA 125G", 1, "ETICHETE TERMICE", 1), comp("RUCOLA 125G", 1, "RUCOLA", 0.13, "KG")]);
    expect(c.status).toBe("ok");
  });
  it("accepts a case recipe of 6 with 6 labels and one case label", () => {
    const [c] = recipeChecks([comp("RUCOLA 125G", 6, "ETICHETE TERMICE", 6), comp("RUCOLA 125G", 6, "ETICHETE BAX LIDL", 1), comp("RUCOLA 125G", 6, "CUTII SALATE", 1)]);
    expect(c.status).toBe("ok");
  });
  it("flags raw material for several pieces even with a single label (0.925 kg for 250 g)", () => {
    const [c] = recipeChecks([comp("SALATA BELLEZZA 250G HORECA", 1, "ETICHETE CORAL", 1), comp("SALATA BELLEZZA 250G HORECA", 1, "MIX", 0.925, "KG")]);
    expect(c.status).toBe("case_as_piece");
    expect(c.suggestedUnits).toBe(4);
  });
  it("flags 7 labels on 1 cup as a wrong component quantity, not a case", () => {
    const [c] = recipeChecks([comp("SNACK MORCOVI 250G", 1, "PAHARE SNACKS", 1), comp("SNACK MORCOVI 250G", 1, "ETICHETE TERMICE", 7), comp("SNACK MORCOVI 250G", 1, "MORCOVI", 0.25, "KG")]);
    expect(c.status).toBe("component_qty");
  });
  it("puts products sold by the kilo with 2 bags per kg in the check list", () => {
    const [c] = recipeChecks([comp("BUSUIOC KG", 1, "PUNGI MARI", 2), comp("BUSUIOC KG", 1, "BUSUIOC", 1, "KG")]);
    expect(c.status).toBe("kg_check");
  });
  it("checks the same version as the calculator (default active)", () => {
    const rows = [comp("RUCOLA 500G", 4, "CASEROLA", 4, "BUC", { vid: 1, impl: 1 }), comp("RUCOLA 500G", 1, "CASEROLA", 4, "BUC", { vid: 2, impl: 0, ds: "2026-06-01" })];
    expect(recipeChecks(rows)[0].status).toBe("ok");
  });
});
