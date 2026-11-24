import { describe, expect, it } from 'bun:test';
import { auditLine, matchSupplier, totals, type PriceList, type InvoiceLine } from '../../src/lib/achizitii/supplierPriceAudit';

const list: PriceList = { currency: 'EUR', items: [{ product: 'RUCOLA VRAC', category: 'Salate', prices: { 'Alphacom Italia': 2.05, 'Sole e Rugiada': 1.45, 'Aniello De Divitiis': 1.6 } }],
  suppliers: [{ name: 'Alphacom Italia', aliases: ['ALPHACOM ITALIA S.R.L.'] }, { name: 'Sole e Rugiada', aliases: [] }, { name: 'Aniello De Divitiis', aliases: [] }] };
const line = (sup: string, peur: number, q = 100): InvoiceLine => ({ id: 1, day: '2026-10-01', tip: 'FFIC', doc: 'X', sup, art: 'RUCOLA VRAC', um: 'KG', q, pron: 0, vron: 0, peur, pref: null, cur: 'EUR', rate: 5 });

describe('supplier price audit', () => {
  it('matches Senior partner names to list names', () => {
    expect(matchSupplier('ALPHACOM ITALIA S.R.L.', list)).toBe('Alphacom Italia');
    expect(matchSupplier('O.P. SOLE E RUGIADA S.A.C.P.A.', list)).toBe('Sole e Rugiada');
    expect(matchSupplier('GAL ALBERT', list)).toBeNull();
  });
  it('splits extra cost into supplier overcharge and supplier choice', () => {
    const a = auditLine(line('ALPHACOM ITALIA S.R.L.', 2.15), list);
    expect(a.status).toBe('peste');
    expect(a.priceDiff).toBeCloseTo(10);   // 100 kg × (2.15 − 2.05)
    expect(a.choiceDiff).toBeCloseTo(60);  // 100 kg × (2.05 − 1.45 cheapest)
    expect(a.totalDiff).toBeCloseTo(70);
  });
  it('cheapest supplier at agreed price costs nothing extra', () => {
    const a = auditLine(line('Sole e Rugiada', 1.45), list);
    expect(a.status).toBe('ok'); expect(a.totalDiff).toBeCloseTo(0);
  });
  it('credit notes reduce the totals', () => {
    const t = totals([auditLine(line('ALPHACOM ITALIA S.R.L.', 2.05, 100), list), auditLine(line('ALPHACOM ITALIA S.R.L.', 2.05, -20), list)]);
    expect(t.qty).toBe(80); expect(t.choiceDiff).toBeCloseTo(48);
  });
});
