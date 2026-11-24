import { describe, expect, it } from 'bun:test';
import { auditLine, matchSupplier, totals, validatePricePeriods, type SupplierPricePeriod, type PriceList, type InvoiceLine } from '../../src/lib/achizitii/supplierPriceAudit';
import { saveSupplierPriceList, supplierPriceList } from '../../supabase/functions/argus/supplierPriceStore';

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

const period = (id: string, supplier: string, from: string, to: string, price: number): SupplierPricePeriod => ({ id, supplier, validFrom: from, validTo: to, items: [{ product: 'RUCOLA VRAC', category: 'Salate', price }] });
const historical: PriceList = { ...list, periods: [
  period('a1', 'Alphacom Italia', '2026-01-05', '2026-03-12', 2),
  period('a2', 'Alphacom Italia', '2026-03-13', '2026-12-31', 2.5),
  period('s1', 'Sole e Rugiada', '2026-01-05', '2026-03-12', 1.7),
  period('s2', 'Sole e Rugiada', '2026-03-13', '2026-12-31', 3),
] };
const on = (day: string) => auditLine({ ...line('ALPHACOM ITALIA S.R.L.', 2.3, 1000), day }, historical);

describe('supplier contract validity', () => {
  it('includes 5 January in the old list', () => { expect(on('2026-01-05').agreed).toBe(2); });
  it('includes 12 March in the old list', () => { expect(on('2026-03-12').agreed).toBe(2); });
  it('uses the new price from 13 March, not the latest list for old invoices', () => {
    expect(on('2026-03-13').agreed).toBe(2.5);
    expect(on('2026-02-01').priceDiff).toBeCloseTo(300);
  });
  it('compares only prices valid on the same day for each supplier', () => {
    expect(on('2026-03-12').bestSupplier).toBe('Sole e Rugiada');
    expect(on('2026-03-12').choiceDiff).toBeCloseTo(300);
    expect(on('2026-03-13').bestSupplier).toBe('Alphacom Italia');
    expect(on('2026-03-13').totalDiff).toBeCloseTo(-200);
  });
  it('does not invent a price before 5 January or use the undated initial list', () => {
    const a = on('2026-01-04');
    expect(a.agreed).toBeNull(); expect(a.best).toBeNull(); expect(a.status).toBe('fara_pret');
    const t = totals([a]); expect(t.withoutAgreed).toBe(1); expect(t.withoutBest).toBe(1); expect(t.atBest).toBe(0);
  });
  it('reports a gap rather than carrying a previous contract forward', () => {
    const a = auditLine({ ...line('ALPHACOM ITALIA S.R.L.', 2), day: '2026-03-13' }, { ...historical, periods: historical.periods?.filter((p) => p.id !== 'a2') });
    expect(a.agreed).toBeNull(); expect(a.choiceDiff).toBe(0); expect(a.best).toBe(3);
  });
  it('rejects overlapping periods of the same supplier including shared endpoints', () => {
    expect(() => validatePricePeriods([period('1', 'Alphacom Italia', '2026-01-05', '2026-03-12', 2), period('2', 'Alphacom Italia', '2026-03-12', '2026-04-01', 3)])).toThrow('se suprapun');
  });
  it('allows adjacent periods and concurrent contracts of different suppliers', () => {
    expect(() => validatePricePeriods(historical.periods ?? [])).not.toThrow();
  });
  it('rejects impossible calendar dates and reversed periods', () => {
    expect(() => validatePricePeriods([period('1', 'A', '2026-02-30', '2026-03-12', 2)])).toThrow();
    expect(() => validatePricePeriods([period('1', 'A', '2026-03-13', '2026-03-12', 2)])).toThrow();
  });
  it('preserves credit notes with the correct historical prices', () => {
    const a = auditLine({ ...line('ALPHACOM ITALIA S.R.L.', 2.3, -100), day: '2026-03-12' }, historical);
    expect(a.priceDiff).toBeCloseTo(-30); expect(a.choiceDiff).toBeCloseTo(-30); expect(a.totalDiff).toBeCloseTo(-60);
  });
  it('saves and reads all historical periods without erasing old contracts', async () => {
    let saved: any;
    const cloud = { from: () => ({ insert: async (row: any) => { saved = row; return { error: null }; }, select: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { ...saved, created_at: '2026-11-24' }, error: null }) }) }) }) }) };
    await saveSupplierPriceList(cloud, { list: historical }, 'test-admin');
    const read = await supplierPriceList(cloud);
    expect(read.list.periods).toHaveLength(4);
    expect(auditLine({ ...line('ALPHACOM ITALIA S.R.L.', 2.3), day: '2026-03-12' }, read.list).agreed).toBe(2);
  });
  it('rejects overlap server-side before storing anything', async () => {
    let writes = 0;
    const cloud = { from: () => ({ insert: async () => { writes++; return { error: null }; } }) };
    await expect(saveSupplierPriceList(cloud, { list: { ...historical, periods: [...(historical.periods ?? []), period('bad', 'Alphacom Italia', '2026-03-12', '2026-04-01', 9)] } }, 'test-admin')).rejects.toThrow('se suprapun');
    expect(writes).toBe(0);
  });
});

import { auditLine as _al } from '../../src/lib/achizitii/supplierPriceAudit';
import { test as _t, expect as _e } from 'bun:test';
_t('flags whether the chosen supplier was the cheapest that day', () => {
  const list = { currency: 'EUR', items: [], suppliers: [{ name: 'A', aliases: [] }, { name: 'B', aliases: [] }], periods: [
    { id: '1', supplier: 'A', validFrom: '2026-10-01', validTo: '2026-11-30', items: [{ product: 'RUCOLA', category: '', price: 2 }] },
    { id: '2', supplier: 'B', validFrom: '2026-10-01', validTo: '2026-11-30', items: [{ product: 'RUCOLA', category: '', price: 1.7 }] }] };
  const base = { id: 1, day: '2026-10-05', tip: 'FF', doc: '1', art: 'RUCOLA', um: 'KG', q: 1000, pron: 0, vron: 0, pref: null, cur: 'EUR', rate: null };
  const a = _al({ ...base, sup: 'A', peur: 2.3 }, list);
  _e(a.isCheapest).toBe(false); _e(a.priceDiff).toBeCloseTo(300); _e(a.choiceDiff).toBeCloseTo(300); _e(a.totalDiff).toBeCloseTo(600);
  _e(_al({ ...base, sup: 'B', peur: 1.7 }, list).isCheapest).toBe(true);
});

_t('billed at the cheapest price counts as cheapest with no choice loss', () => {
  const list = { currency: 'EUR', items: [], suppliers: [{ name: 'A', aliases: [] }, { name: 'B', aliases: [] }], periods: [
    { id: '1', supplier: 'A', validFrom: '2026-10-01', validTo: '2026-11-30', items: [{ product: 'PDZ', category: '', price: 0.9 }] },
    { id: '2', supplier: 'B', validFrom: '2026-10-01', validTo: '2026-11-30', items: [{ product: 'PDZ', category: '', price: 0.75 }] }] };
  const l = _al({ id: 1, day: '2026-10-05', tip: 'FF', doc: '1', art: 'PDZ', um: 'KG', q: 901, pron: 0, vron: 0, pref: null, cur: 'EUR', rate: null, sup: 'A', peur: 0.75 }, list);
  _e(l.isCheapest).toBe(true); _e(l.choiceDiff).toBe(0); _e(l.totalDiff).toBeCloseTo(0);
});
