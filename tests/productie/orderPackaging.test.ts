import { expect, test } from 'bun:test';
import { findOrderPackaging, packagingQuantity, type PackagingMethod } from '../../src/lib/productie/orderPackaging';

const methods: PackagingMethod[] = [
  { client_name: 'MEGA IMAGE', product_name: 'BABY SPANAC', weight: '100g', units_per_case: '4', tertiary_packaging: 'Cutii 4' },
  { client_name: 'LIDL ROMÂNIA', product_name: 'Baby Spanac', weight: '100g', units_per_case: '8', tertiary_packaging: 'Cutii 8' },
];
test('same product uses packaging for its own store, including retailer/new suffixes', () => {
  expect(findOrderPackaging({ cantitate: 600, magazin: 'Mega Image', productie_produse: { nume: 'BABY SPANAC 100 MI NOU' } }, methods)?.units_per_case).toBe('4');
  expect(findOrderPackaging({ cantitate: 600, magazin: 'Lidl Roman', productie_produse: { nume: 'BABY SPANAC 100 GR LIDL' } }, methods)?.units_per_case).toBe('8');
});
test('never borrows packaging from another store or weight', () => {
  expect(findOrderPackaging({ cantitate: 600, magazin: 'Auchan', productie_produse: { nume: 'BABY SPANAC 100' } }, methods)).toBeUndefined();
  expect(findOrderPackaging({ cantitate: 600, magazin: 'Mega Image', productie_produse: { nume: 'BABY SPANAC 200' } }, methods)).toBeUndefined();
});
test('conflicting definitions stay unresolved instead of guessing', () => {
  expect(findOrderPackaging({ cantitate: 600, magazin: 'Mega Image', productie_produse: { nume: 'BABY SPANAC 100' } }, [...methods, { ...methods[0], units_per_case: '6' }])).toBeUndefined();
});
test('cartons preserve loose pieces and do not calculate shared assortments', () => {
  expect(packagingQuantity(603, '4')).toEqual({ fullCases: 150, looseUnits: 3 });
  expect(packagingQuantity(600, '6+2')).toBeNull();
});