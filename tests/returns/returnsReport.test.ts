import { describe, it, expect } from 'bun:test';
import { reasonCategory, splitPartner, deliveryDay, enrich, groupBy, shippedBy } from '../../src/lib/returns/returnsReport';
import { matchProduction, productionDay, type ProductionWork } from '../../supabase/functions/_shared/returnsProduction';

describe('returns report rules', () => {
  it('goods produced today are refused at delivery tomorrow, without another waiting day', () => {
    expect(productionDay('2026-11-27')).toBe('2026-11-26');
    expect(productionDay('2026-12-01')).toBe('2026-11-30');
  });
  it('shows only operators who produced the exact product for that store on the previous day', () => {
    const w: ProductionWork = { sessionId: 's1', orderId: 'o1', order: '100', day: '2026-11-26', product: 'SPANAC 500 GR LIDL', store: 'LIDL DISCOUNT SRL', point: 'ROMAN', operator: 'Ana', line: 'Salate 1', quantity: 400, start: '2026-11-26T08:00:00Z', end: '2026-11-26T09:00:00Z', employees: 5 };
    const row = { day: '2026-11-27', art: w.product, partner: 'LIDL DISCOUNT SRL - ROMAN' };
    expect(matchProduction(row, [w, { ...w, sessionId: 's2', point: 'FUNDENI' }, { ...w, sessionId: 's3', product: 'SPANAC 100 GR LIDL' }, { ...w, sessionId: 's4', day: '2026-11-25' }, { ...w, sessionId: 's5', quantity: 0 }, w])).toEqual([w]);
    expect(matchProduction({ ...row, art: 'ALT PRODUS' }, [w])).toEqual([]);
  });
  it('return seen on the 1st of next month belongs to last day of the month', () => {
    expect(deliveryDay('2026-12-01', 1)).toBe('2026-11-30');
  });
  it('categorises Senior reasons', () => {
    expect(reasonCategory('CALITATE')).toBe('Calitate');
    expect(reasonCategory('LIPSA MATERIE PRIMA')).toBe('Lipsă marfă / materie primă');
    expect(reasonCategory('NELIVRAT - TRANSPORT')).toBe('Transport / nelivrat');
    expect(reasonCategory('AVIZ GRESIT')).toBe('Greșeli documente / comandă');
    expect(reasonCategory('BAXARE GRESITA')).toBe('Etichetare / ambalare / baxare');
    expect(reasonCategory('')).toBe('Fără motiv scris');
  });
  it('splits central client and store', () => {
    expect(splitPartner('LIDL DISCOUNT SRL - ROMAN')).toEqual({ client: 'LIDL DISCOUNT SRL', store: 'ROMAN' });
  });
  it('return rate = returned value ÷ shipped value of the same client', () => {
    const l = enrich([{ id: 1, day: '2026-11-02', doc: 'CC 1', partner: 'LIDL DISCOUNT SRL - ROMAN', art: 'X', q: 10, v: 50, reason: 'CALITATE' }], 1);
    const g = groupBy(l, (x) => x.client, shippedBy([{ partner: 'LIDL DISCOUNT SRL - FUNDENI', art: 'X', q: 100, v: 1000 }], (r) => r.client));
    expect(g[0].rateV).toBeCloseTo(0.05);
    expect(l[0].delivered).toBe('2026-11-01');
  });
});
