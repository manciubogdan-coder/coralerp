import { expect, test } from 'bun:test';
import { makeSheets, type OrderLine } from '../../src/lib/vanzari/orderSheets';
import { orderDocument } from '../../src/lib/vanzari/orderDocument';

const line = (id: string, produs: string, gramaj: number, bucati: number, buc_bax: number, carton_source: string | null = null): OrderLine => ({
  id, client: 'LIDL', depozit: 'ARICESTI', nr_comanda: '1', produs, gramaj, bucati, taiat: 0, buc_bax,
  ambalaj_primar: null, ambalaj_tertiar: null, carton_source,
});
// Lidl Aricești 8 Nov 2026, as imported from DA_LIDL ARICESTI- SALATE.pdf
const aricesti = [
  line('1', 'MIX SALATA PRESTIGIO', 160, 432, 8),
  line('2', 'LUPINO', 200, 432, 6, 'Mixuri salate Lupino/Amorino'),
  line('3', 'AMORINO', 200, 144, 2, 'Mixuri salate Lupino/Amorino'),
  line('4', 'SILHOUETTE', 140, 432, 6, 'Mixuri salate Silhouette/Primavera'),
  line('5', 'PRIMAVARA', 120, 144, 2, 'Mixuri salate Silhouette/Primavera'),
];

test('Primavara from Senior stays on the Lidl mixed sheet, not the mono one', () => {
  const sheets = makeSheets(aricesti);
  const mixed = sheets.find(s => s.mixed);
  expect(mixed?.lines.map(l => l.produs)).toContain('PRIMAVARA');
  expect(sheets.some(s => !s.mixed)).toBe(false);
});

test('Primavara fills the Primavera row: 144 pieces, 2 per case, cartons shared with Silhouette', () => {
  const mixed = makeSheets(aricesti).find(s => s.mixed)!;
  const doc = orderDocument(mixed, '08.11.2026');
  const primavera = doc.products.find(c => /Primavera/i.test(c.p.product))!;
  expect(primavera.lines.map(l => l.id)).toEqual(['5']);
  expect(doc.totalUnits).toBe(1584);
  // 54 Prestigio + 72 Lupino/Amorino + 72 Silhouette/Primavera
  expect(doc.totalCases).toBe(198);
});
