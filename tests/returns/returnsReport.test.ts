import { describe, it, expect } from 'vitest';
import { reasonCategory, splitPartner, deliveryDay, enrich, groupBy, shippedBy } from '@/lib/returns/returnsReport';

describe('returns report rules', () => {
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
