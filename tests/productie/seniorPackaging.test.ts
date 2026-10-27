import { test, expect } from 'bun:test';
import { packagingStoreKey, packagingUnits, resolveStorePackaging, type StorePackaging } from '../../supabase/functions/_shared/packagingRules';

const rows: StorePackaging[] = [
  { produs_id: 'p1', magazin: 'Mega Image', magazin_key: packagingStoreKey('Mega Image'), senior_units: '4', manual_units: null },
  { produs_id: 'p1', magazin: 'Metro', magazin_key: packagingStoreKey('Metro'), senior_units: '6', manual_units: null },
  { produs_id: 'p1', magazin: 'Auchan', magazin_key: packagingStoreKey('Auchan'), senior_units: '12', manual_units: null },
];
test('same product keeps Senior store quantities 4, 6 and 12 separate', () => {
  expect(resolveStorePackaging('p1', 'Mega Image SRL', rows)).toBe('4');
  expect(resolveStorePackaging('p1', 'Metro', rows)).toBe('6');
  expect(resolveStorePackaging('p1', 'Auchan', rows)).toBe('12');
  expect(resolveStorePackaging('p1', 'Lidl', rows)).toBeNull();
  expect(resolveStorePackaging('p2', 'Metro', rows)).toBeNull();
});
test('manual change applies only to its own product/store and restoring uses Senior', () => {
  const changed = rows.map(r => r.magazin === 'Metro' ? { ...r, manual_units: '12' } : r);
  expect(resolveStorePackaging('p1', 'Metro', changed)).toBe('12');
  expect(resolveStorePackaging('p1', 'Mega Image', changed)).toBe('4');
  expect(resolveStorePackaging('p1', 'Metro', rows)).toBe('6');
});
test('advance product cannot inherit conflicting store packaging', () => {
  expect(resolveStorePackaging('p1', 'PRODUCTIE_AVANS', rows)).toBeNull();
  expect(resolveStorePackaging('p1', 'PRODUCTIE_AVANS', [rows[0]])).toBe('4');
});
test('verified Senior units parse without interpreting pallet counts or observations', () => {
  expect(packagingUnits('8 BUC / BAX')).toBe('8');
  expect(packagingUnits('6+2 BUC/BAX')).toBe('6+2');
  expect(packagingUnits('144 PALET')).toBeNull();
  expect(packagingUnits('0')).toBeNull();
});