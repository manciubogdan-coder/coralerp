import { expect, test } from "bun:test";
import { isSupplierQualityLoss, supplierQualityCreditQuantity, supplierQualityLossBase } from "../../src/lib/receptionQuality";

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

test("Rucola quality loss excludes the separately reported 33kg shortage", () => {
  const base = supplierQualityLossBase(671, 638, { under: 3, over: 100 });
  expect(base).toBe(638);
  expect(base * 30 / 100).toBe(191.4);
  expect(supplierQualityCreditQuantity(base, 30)).toBe(191);
});

test("unreported shortage inside tolerance retains the document base", () => {
  expect(supplierQualityLossBase(505, 494, { under: 3, over: 100 })).toBe(505);
});

test("reported surplus retains effective declared quantity as its quality base", () => {
  expect(supplierQualityLossBase(200, 363.5, { under: 3, over: 100 }, 270)).toBe(270);
});