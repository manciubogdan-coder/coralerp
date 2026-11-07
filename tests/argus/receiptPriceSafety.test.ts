import { describe, expect, test } from 'bun:test';
import { priceSafety, safetySql } from '../../supabase/functions/_shared/receiptPriceSafety';

const baseline = { latestPrice: 26.19, averagePrice: 0.0262, historyCount: 3, unit: 'BUC', day: '2026-11-06', documentId: 27220, historyStart: '2026-05-06' };
describe('packaging/label last-NIR safety', () => {
  test('BAMIS rolls entered as pieces trigger the >3× alert without altering price', () => {
    const result = priceSafety(baseline);
    expect(result.suspect).toBe(true);
    expect(result.latestPrice).toBe(26.19);
    expect(result.ratio).toBeCloseTo(999.6183, 4);
  });
  test('strict 3× threshold does not warn at exactly three times', () => {
    expect(priceSafety({ ...baseline, latestPrice: 3, averagePrice: 1 }).suspect).toBe(false);
    expect(priceSafety({ ...baseline, latestPrice: 3.001, averagePrice: 1 }).suspect).toBe(true);
  });
  test('unknown or zero history is not labelled safe or anomalous', () => {
    expect(priceSafety({ ...baseline, averagePrice: null }).ratio).toBeNull();
    expect(priceSafety({ ...baseline, averagePrice: 0 }).suspect).toBe(false);
    expect(priceSafety({ ...baseline, historyCount: 0 }).suspect).toBe(false);
  });
  test('baseline is six calendar months, same article/unit, latest excluded, weighted by quantity', () => {
    const sql = safetySql([300], '2026-11-08');
    expect(sql).toContain('DATEADD(month,-6,l.day)');
    expect(sql).toContain('p.unitId=l.unitId AND p.rn<>1');
    expect(sql).toContain('SUM(p.v)/NULLIF(SUM(p.q),0)');
    expect(sql).toContain("t.Cod='NIR'");
  });
  test('unsafe identifiers/date rejected before querying', () => {
    expect(() => safetySql([1.5], '2026-11-08')).toThrow();
    expect(() => safetySql([300], "2026-11-08';DROP")).toThrow();
  });
});