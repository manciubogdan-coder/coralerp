import { isSupplierQualityLoss, supplierQualityCreditQuantity, supplierQualityLossBase } from './credit.ts';

export type Tolerance = { under: number; over: number };
export type QuantityRow = {
  document: number | null;
  weighed: number;
  missing: boolean;
  tolerance: Tolerance;
  qualityLossPercent?: number;
};
export type QuantityResult = {
  document: number | null;
  received: number;
  shortage: number;
  surplus: number;
  credit: number;
};

// Tolerance applies per delivered row (lot/pallet), exactly as the row-level table shows it.
export const rowQuantity = (row: QuantityRow): QuantityResult => {
  const doc = row.document != null && Number.isFinite(row.document) ? row.document : null;
  if (row.missing) return { document: doc, received: 0, shortage: doc && doc > 0 ? doc : 0, surplus: 0, credit: 0 };
  const weighed = Number(row.weighed) || 0;
  let received = weighed, shortage = 0, surplus = 0;
  if (doc != null && doc > 0) {
    const diff = weighed - doc;
    if (diff > 0 && diff > row.tolerance.over) surplus = diff;
    else if (diff < 0 && -diff > doc * row.tolerance.under / 100 + 1e-9) shortage = -diff;
    else received = doc;
  }
  const p = row.qualityLossPercent || 0;
  const credit = isSupplierQualityLoss(p) ? supplierQualityCreditQuantity(supplierQualityLossBase(doc, weighed, row.tolerance), p) : 0;
  return { document: doc, received, shortage, surplus, credit };
};

// One product line = sum of its rows, so the short report always equals the row-level report.
export const productQuantity = (rows: QuantityRow[]): QuantityResult => {
  const parts = rows.map(rowQuantity);
  const docs = parts.map((q) => q.document).filter((n): n is number => n != null);
  const sum = (f: (q: QuantityResult) => number) => parts.reduce((a, q) => a + f(q), 0);
  return {
    document: docs.length ? docs.reduce((a, b) => a + b, 0) : null,
    received: sum((q) => q.received),
    shortage: sum((q) => q.shortage),
    surplus: sum((q) => q.surplus),
    credit: sum((q) => q.credit),
  };
};
