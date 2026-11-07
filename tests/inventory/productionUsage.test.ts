import { expect, mock, test } from 'bun:test';

const orderId = 'b74828e2-2a09-4e4d-b8ef-c8d2dc96fb4d';
let sessions: any[] = [];
const requests: { table: string; values: unknown[] }[] = [];
mock.module('../../src/integrations/supabase/client', () => ({
  supabase: { from(table: string) {
    const chain: any = {
      select() { return chain; }, gte() { return chain; }, lte() { return chain; }, order() { return chain; },
      in(_column: string, values: unknown[]) {
        if (table !== 'productie_sesiuni_lucru') requests.push({ table, values });
        return chain;
      },
      async range() {
        if (table === 'productie_sesiuni_lucru') return { data: sessions, error: null };
        const values = requests.find(r => r.table === table)?.values || [];
        if (values.some(id => !id || id === 'null')) return { data: null, error: new Error('invalid input syntax for type uuid: "null"') };
        return { data: table === 'productie_comenzi' ? [{ id: orderId, data_productie: '2026-11-06',
          productie_produse: { nume: 'Rucola', productie_retete: [{ activa: true, productie_retete_ingrediente: [
            { cantitate_necesara: 125, unitate_masura: 'gr', productie_ingrediente: { nume: 'Rucola' } },
          ] }] } }] : [], error: null };
      },
    };
    return chain;
  } },
}));
const { loadProductionUsage } = await import('../../src/lib/productionUsage');
const session = (id: unknown) => ({ comanda_id: id, status: 'finalizata', ora_sfarsit: '2026-11-06T10:00:00Z', cantitate_produsa: 100 });

test('nullable session links never reach either UUID query; linked consumption is retained', async () => {
  requests.length = 0;
  sessions = [session(null), session(orderId), session(undefined), session('null'), session('')];
  const result = await loadProductionUsage('2026-11-01', '2026-11-07');
  expect(requests).toEqual([
    { table: 'productie_comenzi', values: [orderId] },
    { table: 'productie_comenzi_ingrediente', values: [orderId] },
  ]);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ orderId, quantity: 12.5, day: '2026-11-06' });
});

test('only unlinked sessions need no order requests and do not fail the forecast', async () => {
  requests.length = 0;
  sessions = [session(null), session(undefined)];
  expect(await loadProductionUsage('2026-11-01', '2026-11-07')).toEqual([]);
  expect(requests).toEqual([]);
});