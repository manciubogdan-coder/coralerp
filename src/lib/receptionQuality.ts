export const SUPPLIER_QUALITY_LOSS_MIN_PERCENT = 5;

export const isSupplierQualityLoss = (percent: number): boolean =>
  Number.isFinite(percent) && percent >= SUPPLIER_QUALITY_LOSS_MIN_PERCENT;