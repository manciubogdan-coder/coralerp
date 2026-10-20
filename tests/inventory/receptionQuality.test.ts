import { expect, test } from "bun:test";
import { isSupplierQualityLoss, supplierQualityCreditQuantity } from "../../src/lib/receptionQuality";

test("supplier quality loss starts at 5% inclusive", () => {
  expect(isSupplierQualityLoss(4.99)).toBe(false);
  expect(isSupplierQualityLoss(5)).toBe(true);
  expect(isSupplierQualityLoss(5.01)).toBe(true);
  expect(isSupplierQualityLoss(8)).toBe(true);
});

test("the supplier credit retains the 5% loss on a 2.9kg reception", () => {
  expect(supplierQualityCreditQuantity(2.9, 5)).toBe(0.15);
});

test("loss below the inclusive 5% threshold does not generate credit", () => {
  expect(supplierQualityCreditQuantity(2.9, 4.99)).toBe(0);
});