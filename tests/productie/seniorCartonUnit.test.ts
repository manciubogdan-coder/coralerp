import { expect, test } from 'bun:test';
import { cartonNameUnit } from '../../supabase/functions/ingest-erp-orders/cartonUnit';
import { expandCarton, type MixedCarton } from '../../supabase/functions/_shared/mixedCartons';

const lupino: MixedCarton = { produs_id: 'mix', denumire: 'Mixuri salate Lupino/Amorino', aliases: [], enabled: true, components: [{ produs_id: 'l', nume: 'Lupino', units: 6 }, { produs_id: 'a', nume: 'Amorino', units: 2 }] };
test('Senior Fundeni 108949: 480 BUC are 360 Lupino + 120 Amorino, not 3840 pieces', () => {
  expect(expandCarton(lupino, 480, cartonNameUnit('1')).map(p => p.quantity)).toEqual([360, 120]);
});
test('Senior Fundeni 108949: 600 BUC are 450 Silhouette + 150 Primavera', () => {
  const row = { ...lupino, components: [{ produs_id: 's', nume: 'Silhouette', units: 6 }, { produs_id: 'p', nume: 'Primavera', units: 2 }] };
  expect(expandCarton(row, 600, cartonNameUnit('BUC')).map(p => p.quantity)).toEqual([450, 150]);
});
test('explicit carton counts remain carton counts', () => {
  expect(expandCarton(lupino, 60, cartonNameUnit('bax')).map(p => p.quantity)).toEqual([360, 120]);
});
test('unverified numeric units and incomplete cartons fail rather than guessing', () => {
  expect(() => cartonNameUnit('28')).toThrow();
  expect(() => expandCarton(lupino, 481, cartonNameUnit('1'))).toThrow();
});