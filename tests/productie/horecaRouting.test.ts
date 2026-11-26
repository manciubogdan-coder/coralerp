import { expect, test } from 'bun:test';
import { HORECA_LINE_ID, horecaGroup, createHorecaClientLookup } from '../../supabase/functions/_shared/horecaRules';
import { reconcileHorecaRouting } from '../../supabase/functions/_shared/horecaRouting';

test('HoReCa means the configured Caterin and Mircea nicknames, not product or store names', () => {
  expect(horecaGroup(' CATERIN ')).toBe('Caterin');
  expect(horecaGroup('MIRCEA HORECA')).toBe('Mircea');
  expect(horecaGroup('mircea')).toBe('Mircea');
  expect(horecaGroup('SALATA HORECA')).toBeNull();
  expect(horecaGroup('MELODY')).toBeNull();
});

test('delivery points cannot borrow a nickname from an ambiguous store', () => {
  const lookup = createHorecaClientLookup([
    { nume_magazin: 'Client', punct_livrare: 'A', nickname: 'CATERIN' },
    { nume_magazin: 'Client', punct_livrare: 'B', nickname: 'MIRCEA HORECA' },
  ]);
  expect(lookup({ magazin: 'Client', punct_livrare: 'A' })).toBe('Caterin');
  expect(lookup({ magazin: 'Client', punct_livrare: 'B' })).toBe('Mircea');
  expect(lookup({ magazin: 'Client', punct_livrare: 'C' })).toBeNull();
  expect(lookup({ magazin: 'PRODUCTIE_AVANS', punct_livrare: 'A' })).toBeNull();
});

function memoryClient(tables: Record<string, any[]>) {
  return { from(table: string) {
    let patch: any, insert: any, filters: ((r: any) => boolean)[] = [], offset = 0, end = Infinity;
    const query: any = {
      select: () => query,
      order: () => query,
      range: (from: number, to: number) => { offset = from; end = to; return query; },
      eq: (key: string, value: any) => { filters.push(r => r[key] === value); return query; },
      neq: (key: string, value: any) => { filters.push(r => r[key] !== value); return query; },
      gt: (key: string, value: any) => { filters.push(r => r[key] > value); return query; },
      is: (key: string, value: any) => { filters.push(r => (r[key] ?? null) === value); return query; },
      in: (key: string, values: any[]) => {
        if (key === 'id' && values.some(v => v == null)) throw new Error('UUID null is invalid');
        filters.push(r => values.includes(r[key])); return query;
      },
      update: (value: any) => { patch = value; return query; },
      upsert: (value: any) => { insert = value; return query; },
      then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data[0] || null }; },
      single: async () => { const result = execute(); return { ...result, data: result.data[0] || null }; },
    };
    function execute() {
      const rows = tables[table] || (tables[table] = []);
      if (insert && !rows.some(r => r.id === insert.id)) rows.push({ ...insert });
      const matched = rows.filter(r => filters.every(f => f(r))).sort((a, b) => a.id.localeCompare(b.id)).slice(offset, end + 1);
      if (patch) matched.forEach(r => Object.assign(r, patch));
      return { data: matched.map(r => ({ ...r })), error: null };
    }
    return query;
  } };
}

test('moves already-started HoReCa orders and active sessions, retaining timestamps and finished production', async () => {
  const tables = {
    productie_clienti: [{ id: 'client', nume_magazin: 'A', punct_livrare: 'Standard', nickname: 'CATERIN' }],
    productie_linii: [{ id: 'old', nume: 'Giostra', status: 'activa' }],
    productie_comenzi: [{ id: 'order', magazin: 'A', punct_livrare: 'Standard', produs_id: 'p', cantitate: 20, cantitate_reala_produsa: 5, status: 'partial', linie_id: 'old' }],
    productie_sesiuni_lucru: [
      { id: 'active', comanda_id: 'order', status: 'activa', linie_id: 'old', ora_start: '2026-11-26T07:00:00Z' },
      { id: 'done', comanda_id: 'order', status: 'partial', linie_id: 'old', cantitate_produsa: 5, ora_start: '2026-11-26T06:00:00Z' },
    ],
  };
  const result = await reconcileHorecaRouting(memoryClient(tables), new Set());
  expect(result).toMatchObject({ movedOrders: 1, movedSessions: 1, failures: [] });
  expect(tables.productie_comenzi[0]).toMatchObject({ linie_id: HORECA_LINE_ID, cantitate_reala_produsa: 5, status: 'partial' });
  expect(tables.productie_sesiuni_lucru[0]).toMatchObject({ linie_id: HORECA_LINE_ID, ora_start: '2026-11-26T07:00:00Z' });
  expect(tables.productie_sesiuni_lucru[1]).toMatchObject({ linie_id: 'old', cantitate_produsa: 5 });
  const second = await reconcileHorecaRouting(memoryClient(tables), new Set());
  expect(second).toMatchObject({ movedOrders: 0, movedSessions: 0 });
});

test('ready-packed HoReCa remains in Picking and unrelated customers keep their original lines', async () => {
  const tables = {
    productie_clienti: [{ id: 'client', nume_magazin: 'A', nickname: 'CATERIN' }, { id: 'other', nume_magazin: 'B', nickname: '' }],
    productie_linii: [{ id: HORECA_LINE_ID, nume: 'HoReCa', status: 'activa' }],
    productie_comenzi: [
      { id: 'direct', magazin: 'A', produs_id: 'ready', cantitate: 20, status: 'assigned', linie_id: null },
      { id: 'retail', magazin: 'B', produs_id: 'p', cantitate: 20, status: 'assigned', linie_id: 'old' },
      { id: 'historic', magazin: 'A', produs_id: 'p', cantitate: 20, status: 'completed', linie_id: 'old' },
      { id: 'zero', magazin: 'A', produs_id: 'p', cantitate: 0, status: 'completed', linie_id: 'old' },
    ],
    productie_sesiuni_lucru: [],
  };
  expect(await reconcileHorecaRouting(memoryClient(tables), new Set(['ready']))).toMatchObject({ movedOrders: 0, movedSessions: 0 });
  expect(tables.productie_comenzi.map(r => r.linie_id)).toEqual([null, 'old', 'old', 'old']);
});

test('moves all HoReCa demand beyond the 1000-row reader limit in checked batches', async () => {
  const tables = {
    productie_clienti: [{ id: 'client', nume_magazin: 'A', nickname: 'MIRCEA HORECA' }],
    productie_linii: [{ id: HORECA_LINE_ID, nume: 'HoReCa', status: 'activa' }],
    productie_comenzi: Array.from({ length: 1101 }, (_, i) => ({ id: String(i).padStart(5, '0'), magazin: 'A', produs_id: 'p', cantitate: 20, status: 'pending', linie_id: null })),
    productie_sesiuni_lucru: [],
  };
  expect(await reconcileHorecaRouting(memoryClient(tables), new Set())).toMatchObject({ movedOrders: 1101, failures: [] });
  expect(tables.productie_comenzi.filter(r => r.linie_id === HORECA_LINE_ID).length).toBe(1101);
});

test('active sessions without an order remain untouched and never enter UUID lookups', async () => {
  const tables = {
    productie_clienti: [], productie_comenzi: [],
    productie_linii: [{ id: HORECA_LINE_ID, nume: 'HoReCa', status: 'activa' }],
    productie_sesiuni_lucru: [{ id: 'unlinked', comanda_id: null, linie_id: 'old', status: 'activa' }],
  };
  expect(await reconcileHorecaRouting(memoryClient(tables), new Set())).toMatchObject({ movedOrders: 0, movedSessions: 0 });
  expect(tables.productie_sesiuni_lucru[0].linie_id).toBe('old');
});