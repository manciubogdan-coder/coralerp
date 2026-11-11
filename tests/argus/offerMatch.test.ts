import { describe, expect, it } from "vitest";
import { matchOffer, offerIdentity, offerSearchWords } from "../../supabase/functions/_shared/offerMatch";

const moldova = [
  { aid: 2015, name: "MENTA 30 MC MD", lastDay: "2025-11-28" },
  { aid: 3758, name: "MENTA 100 GR MC MD", lastDay: "2025-11-28" },
  { aid: 1914, name: "BABY SPANAC 200 MC MD", lastDay: "2025-11-28" },
  { aid: 1955, name: "CIMBRISOR 30 MC MD", lastDay: "2025-11-28" },
  { aid: 2093, name: "SAL. MISTICANZA 200 MC MD", lastDay: "2025-11-28" },
  { aid: 144, name: "Transport", lastDay: "2025-11-28" },
];

describe("offer to another client: matching the target's own article", () => {
  it("Metro România MENTA 30 MC finds ICS Metro Moldova MENTA 30 MC MD, not the 100 g pack", () => {
    expect(matchOffer({ aid: 2014, name: "MENTA 30 MC" }, moldova)).toMatchObject({ row: { aid: 2015 }, match: "exact" });
  });
  it("grams written as 200 GR match 200 without unit", () => {
    expect(matchOffer({ aid: 4519, name: "BABY SPANAC 200 GR MC" }, moldova)?.row.aid).toBe(1914);
  });
  it("cimbru and cimbrișor are the same herb", () => {
    expect(matchOffer({ aid: 1954, name: "CIMBRU 30 MC" }, moldova)?.row.aid).toBe(1955);
  });
  it("a longer name with the same grams is only a similar product", () => {
    expect(matchOffer({ aid: 4529, name: "SALATA MISTICANZA EXOTIC 200G MC" }, moldova)).toMatchObject({ row: { aid: 2093 }, match: "similar" });
  });
  it("the same article wins and an unknown product has no history", () => {
    expect(matchOffer({ aid: 2015, name: "x" }, moldova)?.match).toBe("same");
    expect(matchOffer({ aid: 1, name: "ROZMARIN 30 MC" }, moldova)).toBeNull();
    expect(offerIdentity("Transport")).toBeNull();
  });
  it("search words are the stem of each product family, so CIMBRU also reads CIMBRISOR", () => {
    expect(offerSearchWords(["MENTA 30 MC", "SALATA MOZAIC 200G MC", "BABY SPANAC 500 MC", "CIMBRU 30 MC"])).toEqual(["menta", "mozai", "baby", "cimbr"]);
  });
});
