export type PriceSafety = {
  latestPrice: number; averagePrice: number | null; ratio: number | null;
  suspect: boolean; historyCount: number; unit: string; day: string;
  documentId: number; historyStart: string;
};

export function priceSafety(input: Omit<PriceSafety, 'ratio' | 'suspect'>): PriceSafety {
  const ratio = input.averagePrice != null && input.averagePrice > 0 && Number.isFinite(input.latestPrice)
    ? input.latestPrice / input.averagePrice : null;
  return { ...input, ratio, suspect: ratio != null && input.historyCount > 0 && ratio > 3 };
}