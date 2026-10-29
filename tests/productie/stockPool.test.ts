import { expect, mock, test } from 'bun:test';

const lot = { id: 'lot', produs_id: 'stock', cantitate_surplus: 320, data_productie: '2026-10-27', status: 'disponibil', comanda_originala_id: null as string | null };
const allocations: Record<string, number> = {};
mock.module('../../src/integrations/supabase/client', () => ({
  supabase: { from(table: string) {
    let patch: Record<string, any> | undefined;
    const filters: Record<string, any> = {};
    const chain: any = {
      select() { return chain; }, order() { return chain; },
      eq(key: string, value: any) { filters[key] = value; return chain; },
      gt() { return chain; }, in() { return chain; },
      range() { return Promise.resolve({ data: table === 'productie_comenzi' ? [{ id: 'today', cantitate: 1000, cantitate_din_restock: 0, magazin: 'MEGA IMAGE' }] : lot.status === 'disponibil' ? [{ ...lot }] : [], error: null }); },
      update(value: Record<string, any>) { patch = value; return chain; },
      then(resolve: (value: any) => void) {
        if (table === 'productie_restocari' && patch) {
          if (!['disponibil', 'redistribuit'].includes(patch.status)) {
            return resolve({ data: null, error: new Error('productie_restocari_status_check') });
          }
          if (filters.cantitate_surplus !== lot.cantitate_surplus) return resolve({ data: [], error: null });
          Object.assign(lot, patch);
        } else if (patch) allocations[filters.id] = patch.cantitate_din_restock;
        resolve({ data: [{ id: lot.id }], error: null });
      },
    };
    return chain;
  } },
}));
const { setAlocareComanda, fetchPoolTotals, consumaDinPool } = await import('../../src/lib/productie/stockPool');

test('partial allocation followed by exhaustion uses accepted status and does not allocate twice', async () => {
  const groups = { stock: 'Mamamia150G punga', mi: 'Mamamia150G punga' };
  expect(await setAlocareComanda({ id: 'first', produs_id: 'mi' }, 282, groups)).toBe(282);
  expect(lot.cantitate_surplus).toBe(38);
  expect(lot.status).toBe('disponibil');
  expect(await setAlocareComanda({ id: 'second', produs_id: 'mi' }, 336, groups)).toBe(38);
  expect(lot.status).toBe('redistribuit');
  expect(lot.cantitate_surplus).toBe(0);
  expect(allocations).toEqual({ first: 282, second: 38 });
  expect(await setAlocareComanda({ id: 'second', produs_id: 'mi', cantitate_din_restock: 38 }, 336, groups)).toBe(38);
  expect(1194 - allocations.first - allocations.second).toBe(874);
});

test('reserved 1000 pieces are invisible to tomorrow but consumable by todays Picking', async () => {
  Object.assign(lot, { status: 'disponibil', cantitate_surplus: 1000, comanda_originala_id: 'today' });
  expect((await fetchPoolTotals(['stock'])).get('stock')).toBe(0);
  expect(await setAlocareComanda({ id: 'tomorrow', produs_id: 'stock' }, 1000)).toBe(0);
  expect(lot.cantitate_surplus).toBe(1000);
  expect(await consumaDinPool('stock', 1000, {}, 'today')).toBe(1000);
  expect(lot.cantitate_surplus).toBe(0);
});

test('manual Operator total includes all 1000 reserved pieces across product group and taking reduces the same physical stock', async () => {
  Object.assign(lot, { status: 'disponibil', cantitate_surplus: 1000, comanda_originala_id: 'today' });
  const groups = { stock: 'Spinach500', tomorrowVariant: 'Spinach500' };
  expect((await fetchPoolTotals(['tomorrowVariant'], groups, undefined, 'physical')).get('tomorrowVariant')).toBe(1000);
  expect(await setAlocareComanda({ id: 'tomorrowManual', produs_id: 'tomorrowVariant' }, 76, groups, 'physical')).toBe(76);
  expect(lot.cantitate_surplus).toBe(924);
  expect((await fetchPoolTotals(['tomorrowVariant'], groups, undefined, 'physical')).get('tomorrowVariant')).toBe(924);
  expect(await consumaDinPool('stock', 1000, {}, 'today')).toBe(924);
  expect(lot.cantitate_surplus).toBe(0);
  expect(await consumaDinPool('stock', 1000, {}, 'today', 'physical')).toBe(0);
});