import { describe, expect, it } from "vitest";
import { canUsePricing, SALES_PRICING_ACTIONS } from "../../supabase/functions/_shared/crmRules";

describe("price calculator in Vânzări: who may use it", () => {
  it("approved sales and admin users may, others and unapproved users may not", () => {
    expect(canUsePricing(true, ["picking_vanzari"])).toBe(true);
    expect(canUsePricing(true, ["admin"])).toBe(true);
    expect(canUsePricing(true, ["productie"])).toBe(false);
    expect(canUsePricing(false, ["picking_vanzari"])).toBe(false);
  });
  it("only the price list, offer history and partner mirror reads are opened; rules and live saves stay admin-only", () => {
    expect([...SALES_PRICING_ACTIONS].sort()).toEqual(["partner_mirror_sales", "price_history", "price_list", "price_options"]);
    expect(SALES_PRICING_ACTIONS.has("price_rules_save")).toBe(false);
    expect(SALES_PRICING_ACTIONS.has("live_save")).toBe(false);
  });
});
