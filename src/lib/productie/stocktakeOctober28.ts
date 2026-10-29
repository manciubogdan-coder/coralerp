import { manualRestockPayload } from './manualRestock';

export const stocktakeDay = '2026-10-28';
export const stocktakeRows = [
  ['Rozmarin 30 g', [[6, 15], [4, 61]], ['Rozmarin 30 g']],
  ['Rozmarin 100 g', [[6, 3]], ['Rozmarin 100 g']],
  ['Cimbru 30 g', [[6, 9], [4, 95]], ['Cimbru 30 g']],
  ['Cimbru 70 g', [[4, 11]], ['Cimbru 70 g']],
  ['Salvie 30 g', [[6, 7], [4, 20]], ['Salvie 30 g']],
  ['Oregano 30 g', [[4, 2]], ['Oregano 30 g']],
  ['Coriandru 70 g', [[4, 16]], ['Coriandru 70 g']],
  ['Coriandru 100 g', [[6, 5]], ['Coriandru 100 g']],
  ['Menta 70 g', [[4, 10]], ['Menta 70 g']],
  ['Valeriana 100 g', [[6, 18]], ['Valeriana 100 g']],
  ['Valeriana 200 g', [[6, 9]], ['Valeriana 200 g', 'Valeriana 200g Metro']],
  ['Valeriana 500 g', [[4, 5]], ['Valeriana 500g GASTRO', 'Valeriana 500g PUNGA']],
  ['Spanac 100 g', [[6, 89]], ['Baby spanac 100 g']],
  ['Spanac 200 g', [[6, 13]], ['Baby spanac 200g', 'Baby spanac 200g METRO']],
  ['Spanac 500 g', [[4, 15]], ['Baby spanac 500g GASTRO', 'Baby spanac 500g PUNGA']],
  ['Rucola 125 g', [[6, 23]], ['Rucola 125g']],
  ['Rucola 200 g', [[6, 5]], ['Rucola 200g', 'Rucola 200g METRO']],
  ['Rucola 500 g', [[4, 12]], ['Rucola 500 GASTRO', 'Rucola 500g Punga']],
  ['Menta 500 g', [[4, 4]], ['Menta 500g GASTRO', 'Menta 500g PUNGA']],
  ['Armonia 150 g', [[4, 300]], ['Armonia 150g', 'Armonia punga 150 G']],
  ['Oriental Mix 200 g', [[6, 19]], ['Oriental Mix 200 g', 'Oriental Mix 200 g Metro', 'Oriental 200g']],
  ['Misticanza Exotic 200 g', [[6, 9]], ['Misticanza Exotic 200g Metro']],
  ['Mozaic 500 g', [[4, 33]], ['Mozaic 500g', 'Mozaic 500g Metro', 'mozaic 500g meteo']],
  ['Mozaic 200 g', [[8, 2]], ['Mozaic 200g Metro']],
  ['Crocanta 500 g', [[4, 8]], ['Crocanta 500g', 'Crocanta 500 g Metro']],
  ['Primavara 150 g', [[6, 4]], ['Primavara 150g Metro']],
  ['Bellezza 150 g', [[6, 5]], ['Bellezza 150 g']],
] as const;

export function countedQuantity(index: number): number {
  const row = stocktakeRows[index];
  if (!row) throw new Error('Rând inventar invalid.');
  return row[1].reduce((sum, [units, cases]) => sum + units * cases, 0);
}

export function stocktakeId(index: number) {
  return `20261028-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

export function stocktakePayloads(productIds: string[]) {
  if (productIds.length !== stocktakeRows.length || productIds.some(id => !id)) throw new Error('Selectează toate grupele.');
  if (new Set(productIds).size !== productIds.length) throw new Error('Două rânduri au același produs. Verifică grupele.');
  return productIds.map((id, index) => ({ id: stocktakeId(index), ...manualRestockPayload(id, countedQuantity(index), stocktakeDay) }));
}