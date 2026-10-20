export const SUPPLIER_QUALITY_LOSS_MIN_PERCENT = 5;

export const isSupplierQualityLoss = (percent: number): boolean =>
  Number.isFinite(percent) && percent >= SUPPLIER_QUALITY_LOSS_MIN_PERCENT;

// Preserve whole-unit credits, but never hide a positive sub-unit loss as zero.
export const supplierQualityCreditQuantity = (quantity: number, percent: number): number => {
  if (!isSupplierQualityLoss(percent) || !Number.isFinite(quantity) || quantity <= 0) return 0;
  const loss = quantity * percent / 100;
  return Math.round(loss) || Math.round(loss * 100) / 100;
};