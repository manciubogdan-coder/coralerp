import { describe, expect, it } from "bun:test";
import { describeFilters, resolvePeriod, validFilters } from "../../supabase/functions/argus/agentFilters";

describe("agent filters", () => {
  it("last month resolves to the whole previous calendar month", () => {
    expect(resolvePeriod("last_month", "2026-11-05")).toEqual(["2026-10-01", "2026-10-31"]);
  });
  it("last 7 days excludes today", () => {
    expect(resolvePeriod("last_7", "2026-11-05")).toEqual(["2026-10-29", "2026-11-04"]);
  });
  it("chosen values override defaults and an unknown choice falls back to the default", () => {
    const f = validFilters([
      { label: "Perioadă", type: "period", default: "last_30" },
      { label: "Magazin", type: "choice", options: ["Lidl", "Kaufland"], default: "Lidl" },
    ]);
    const r = describeFilters(f, { perioada: "2026-10-01..2026-10-15", magazin: "Carrefour" }, "2026-11-05");
    expect(r.used).toEqual({ perioada: "2026-10-01..2026-10-15", magazin: "Lidl" });
  });
  it("drops malformed filters and caps at six", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ label: `F${i}`, type: "text", default: "" }));
    expect(validFilters([{ label: "", type: "text" }, { label: "X", type: "bogus" }, ...many])).toHaveLength(4);
  });
});
