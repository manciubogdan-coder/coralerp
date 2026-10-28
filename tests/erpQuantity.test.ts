import { describe, it, expect } from 'bun:test';
import { plannedQuantity } from '../supabase/functions/_shared/erpQuantity';

describe('plannedQuantity (import Senior ERP)', () => {
  it('la comandă nouă preferă „Acceptat" când e setat', () => {
    expect(plannedQuantity(100, 80)).toBe(80);
  });

  it('la comandă nouă fără „Acceptat" folosește cantitatea comandată', () => {
    expect(plannedQuantity(100, null)).toBe(100);
    expect(plannedQuantity(100, 0)).toBe(100);
  });

  it('propagă modificarea făcută pe „Cantitate" când „Acceptat" a rămas vechi', () => {
    // stocat 80 (din Acceptat), Senior trimite acum Cantitate=120, Acceptat=80 (neschimbat)
    expect(plannedQuantity(120, 80, 80)).toBe(120);
  });

  it('nu suprascrie „Acceptat" când chiar el s-a modificat', () => {
    // stocat 80, Acceptat nou 90, Cantitate neschimbată 100
    expect(plannedQuantity(100, 90, 80)).toBe(90);
  });

  it('lasă cantitatea neschimbată când nimic nu s-a modificat în Senior', () => {
    expect(plannedQuantity(100, 80, 80)).toBe(80);
  });
});
