import { describe, expect, it } from 'bun:test';
import { projectionDemand, requiresPurchasingProjection, purchasingProjectionStep, weekdayAverages, reconcileProjection } from '../../supabase/functions/_shared/forecastProjectionRules';
import { weekdayAverages as screenAverages, reconcileProjection as screenProjection } from '../../src/lib/forecastReconciliation';

describe('Argus and Achiziții projection parity', () => {
  for (const question of ['Iceberg cât am pe stoc?', 'Spanac cât îmi ajunge marfa?', 'Folie ambalaje consum mediu', 'Etichete cât mă ține stocul?']) {
    it(`uses the purchasing projection for ${question}`, () => {
      expect(purchasingProjectionStep(question, 0)?.toolChoice.toolName).toBe('stoc_si_proiectie_achizitii');
    });
  }
  it('leaves explicit Senior accounting stock and finished stock to their own tools', () => {
    expect(purchasingProjectionStep('Ce stoc contabil am în Senior?', 0)).toBeUndefined();
    expect(purchasingProjectionStep('Cât stoc de produse finite am în picking?', 0)).toBeUndefined();
    expect(purchasingProjectionStep('Compară stocul fizic din aplicație cu Senior pentru rucola', 0)?.toolChoice.toolName).toBe('stoc_si_proiectie_achizitii');
  });
  it('chat and scheduled agents must read the purchasing source first for stock/coverage', () => {
    expect(purchasingProjectionStep('Stoc rucola și cât ajunge', 0)).toEqual({toolChoice:{type:'tool',toolName:'stoc_si_proiectie_achizitii'}});
    expect(purchasingProjectionStep('Stoc rucola și cât ajunge', 1)).toBeUndefined();
    expect(purchasingProjectionStep('Vânzări Metro', 0)).toBeUndefined();
  });
  it('uses the same functions as the daily projection screen', () => {
    expect(screenAverages).toBe(weekdayAverages);
    expect(screenProjection).toBe(reconcileProjection);
  });
  it('requires the forecast tool for the reported rucola stock and coverage question', () => {
    expect(requiresPurchasingProjection('Rucola cât am pe stoc și cât îmi ajunce marfa?')).toBe(true);
    expect(requiresPurchasingProjection('Rucola cât consum în medie pe zi?')).toBe(true);
    expect(requiresPurchasingProjection('Unde sunt birourile?')).toBe(false);
  });
  it('does not confuse weekday demand with a diluted calendar average', () => {
    const dates = Array.from({ length: 28 }, (_, i) => { const d = new Date('2026-10-27T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0,10); });
    const averages = weekdayAverages({ '2026-10-27': 1000, '2026-11-03': 1000, '2026-11-10': 1000, '2026-11-17': 1000 }, dates);
    expect(averages[1]).toBe(1000);
    expect(projectionDemand({ '2026-11-24': 1348.5 }, averages, '2026-11-24', '2026-11-24')).toBe(1348.5);
    expect(projectionDemand({}, averages, '2026-12-01', '2026-11-24')).toBe(1000);
  });
});