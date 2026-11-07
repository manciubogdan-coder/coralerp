import { expect, it } from "bun:test";
import { partnerScope } from "../../supabase/functions/_shared/priceScope";

it("central partner scope uses the fiscal code as a literal, never a per-row subquery", () => {
  const s = partnerScope(1222, null, { cf: "28164550", central: "BAMIS SOLUTIONS SRL" })!;
  expect(s).toBe("(pp.Partener_ID=1222 OR NULLIF(REPLACE(UPPER(LTRIM(RTRIM(pp.Partener_Cod_Fiscal))),'RO',''),'')=N'28164550')");
});

it("a selected store limits the scope to that store only", () => {
  expect(partnerScope(1222, 1223, { cf: "28164550", central: null })).toBe("pp.Partener_ID=1223");
});

it("partner without fiscal code falls back to its escaped central name", () => {
  expect(partnerScope(5, null, { cf: null, central: "O'NEIL SRL" })).toBe("(pp.Partener_ID=5 OR pp.Partener_Central=N'O''NEIL SRL')");
});
