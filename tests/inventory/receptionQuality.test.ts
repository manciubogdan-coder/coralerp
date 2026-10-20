import { expect, test } from "bun:test";
import { isSupplierQualityLoss } from "../../src/lib/receptionQuality";

test("supplier quality loss starts at 5% inclusive", () => {
  expect(isSupplierQualityLoss(4.99)).toBe(false);
  expect(isSupplierQualityLoss(5)).toBe(true);
  expect(isSupplierQualityLoss(5.01)).toBe(true);
  expect(isSupplierQualityLoss(8)).toBe(true);
});