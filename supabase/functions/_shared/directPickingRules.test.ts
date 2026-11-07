import { describe, expect, test } from 'bun:test';
import { applyDirectPicking } from '../../../src/lib/productie/directPickingRules';

const BIO = '136ec27a-fe67-4777-aa5e-eb32d6e3be60';
const ids = new Set([BIO]);
const order = (o: Record<string, any> = {}) => ({ produs_id: BIO, magazin: 'LIDL DISCOUNT SRL - ROMAN', status: 'assigned', linie_id: 'giostra', cantitate: 576, ...o });

describe('direct picking', () => {
  test('a Bio Baby Spanac order assigned to Giostra leaves the line and is ready for picking', () => {
    const r: any = applyDirectPicking(order(), ids);
    expect(r.linie_id).toBeNull();
    expect(r.status).toBe('completed');
    expect(r.direct_picking).toBe(true);
  });
  test('other products keep their production line', () => {
    const r = applyDirectPicking(order({ produs_id: 'other' }), ids);
    expect(r.linie_id).toBe('giostra');
    expect(r.status).toBe('assigned');
  });
  test('an order already started on a line is not taken off it', () => {
    expect(applyDirectPicking(order({ status: 'in_progress' }), ids).status).toBe('in_progress');
    expect(applyDirectPicking(order({ cantitate_produsa_sesiuni: 100 }), ids).linie_id).toBe('giostra');
  });
  test('advance-production orders are not sent to picking', () => {
    expect(applyDirectPicking(order({ magazin: 'Producție în avans' }), ids).status).toBe('assigned');
  });
});
