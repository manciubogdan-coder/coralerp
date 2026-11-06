import { describe, expect, it } from "bun:test";
import { filtersForTemplate, templateValues } from "../../supabase/functions/argus/liveFilters";
import { fillTemplate, validTemplate } from "../../supabase/functions/_shared/templates";
import { validFilters } from "../../supabase/functions/argus/agentFilters";

const t = validTemplate({
  kind: "sql",
  sql: "SELECT * FROM x WHERE d >= {{de_la}} AND d <= {{pana_la}} AND n LIKE N'%' + {{produs}} + N'%'",
  params: [{ name: "de_la", label: "De la", type: "date" }, { name: "pana_la", label: "Până la", type: "date" }, { name: "produs", label: "Produs", type: "text" }],
  defaults: { de_la: "2026-10-01", pana_la: "2026-10-31", produs: "spanac" },
})!;

describe("live report filters", () => {
  it("date placeholders become one period filter keeping the original range", () => {
    const f = filtersForTemplate(t);
    expect(f[0]).toEqual({ name: "perioada", label: "Perioadă", type: "period", default: "2026-10-01..2026-10-31" });
    expect(f[1].name).toBe("produs");
  });
  it("a chosen period refills the SQL dates without AI", () => {
    const v = templateValues(t, { perioada: "last_month", produs: "rucola" }, "2026-11-06");
    expect(v).toEqual({ de_la: "2026-10-01", pana_la: "2026-10-31", produs: "rucola" });
    expect(fillTemplate(t, v)).toContain("N'rucola'");
  });
  it("lookup filters need a known Senior list", () => {
    expect(validFilters([{ label: "Produs", type: "lookup", source: "produs", default: "" }])[0].source).toBe("produs");
    expect(validFilters([{ label: "X", type: "lookup", source: "altceva", default: "" }])).toEqual([]);
  });
});
