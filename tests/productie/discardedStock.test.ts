import { describe, expect, test } from 'bun:test';
import { discardedPoolPatch, isResetOrder, ResetOrder, statusWithoutDiscardedStock } from '../../src/lib/productie/discardedStockRules';
const order: ResetOrder = { id: 'a', data_productie: '2026-10-27', cantitate: 576, cantitate_din_restock: 576, linie_id: 'giostra', status: 'completed', updated_at: 't' };
describe('restoc aruncat', () => {
  test('comanda acoperită numai din stoc reapare nefăcută', () => {
    expect(statusWithoutDiscardedStock(order, 0)).toBe('assigned');
  });
  test('producția parțială rămâne parțială', () => {
    expect(statusWithoutDiscardedStock(order, 120)).toBe('partial');
  });
  test('producția reală completă rămâne finalizată', () => {
    expect(statusWithoutDiscardedStock(order, 576)).toBe('completed');
  });
  test('resetarea afectează numai ziua selectată și alocările pozitive', () => {
    expect(isResetOrder(order, '2026-10-27')).toBe(true);
    expect(isResetOrder(order, '2026-10-26')).toBe(false);
    expect(isResetOrder({ ...order, data_productie: null }, '2026-10-27')).toBe(false);
    expect(isResetOrder({ ...order, cantitate_din_restock: 0 }, '2026-10-27')).toBe(false);
  });
  test('marfa aruncată ajunge la zero și rămâne indisponibilă cu motiv și cantitate în istoric', () => {
    const patch = discardedPoolPatch(2304, '2026-10-26T18:18:00Z', 'user');
    expect(patch.cantitate_surplus).toBe(0);
    expect(patch.status).toBe('redistribuit');
    expect(patch.motiv_scoatere).toBe('aruncat');
    expect(patch.observatii_scoatere).toContain('[2304]');
  });
});