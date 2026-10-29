export const SUPPLIER_QUALITY_LOSS_MIN_PERCENT = 5;

export const isSupplierQualityLoss = (percent: number): boolean =>
  Number.isFinite(percent) && percent >= SUPPLIER_QUALITY_LOSS_MIN_PERCENT;

// Quantitative claims are separate: never apply quality loss to missing goods.
// Unreported differences inside the existing tolerances still use the document.
export const supplierQualityLossBase = (
  documentQuantity: number | null,
  receivedQuantity: number,
  tolerance: { under: number; over: number },
  effectiveQuantity = receivedQuantity,
): number => {
  if (documentQuantity == null || !Number.isFinite(documentQuantity) || documentQuantity <= 0) return effectiveQuantity;
  const difference = receivedQuantity - documentQuantity;
  const reportedShortage = -difference > documentQuantity * tolerance.under / 100 + 1e-9;
  const reportedSurplus = difference > tolerance.over;
  return reportedShortage || reportedSurplus ? effectiveQuantity : documentQuantity;
};

// Preserve whole-unit credits, but never hide a positive sub-unit loss as zero.
export const supplierQualityCreditQuantity = (quantity: number, percent: number): number => {
  if (!isSupplierQualityLoss(percent) || !Number.isFinite(quantity) || quantity <= 0) return 0;
  const loss = quantity * percent / 100;
  return Math.round(loss) || Math.round((loss + Number.EPSILON) * 100) / 100;
};