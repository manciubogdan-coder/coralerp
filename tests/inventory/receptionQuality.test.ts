import { expect, test } from "bun:test";
import { isSupplierQualityLoss, productQuantity, rowQuantity, supplierQualityCreditQuantity, supplierQualityLossBase } from "../../src/lib/receptionQuality";

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
test("short report sums per-lot tolerance: Baby Spanac 573 + 788 within tolerance + 217 missing = 1361 received, 217 less", () => {
  const tolerance = { under: 3, over: 100 };
  const q = productQuantity([
    { document: 573, weighed: 570, missing: false, tolerance },
    { document: 788, weighed: 785.5, missing: false, tolerance, qualityLossPercent: 7 },
    { document: 217, weighed: 0, missing: true, tolerance },
  ]);
  expect(q.document).toBe(1578);
  expect(q.received).toBe(1361);
  expect(q.shortage).toBe(217);
  expect(q.surplus).toBe(0);
  expect(q.credit).toBe(rowQuantity({ document: 788, weighed: 785.5, missing: false, tolerance, qualityLossPercent: 7 }).credit);
});

test("a shortage beyond tolerance on one lot is reported with its weighed quantity", () => {
  const q = rowQuantity({ document: 671, weighed: 638, missing: false, tolerance: { under: 3, over: 100 } });
  expect(q.received).toBe(638);
  expect(q.shortage).toBe(33);
});
