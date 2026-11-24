import { describe, it, expect } from 'bun:test';
import { plannedQuantity } from '../supabase/functions/_shared/erpQuantity';

describe('plannedQuantity (import Senior ERP)', () => {
  it('preferă „Acceptat" când e setat', () => {
    expect(plannedQuantity(100, 80)).toBe(80);
  });

  it('Acceptat gol nu introduce cererea comandată în producție', () => {
    expect(plannedQuantity(500, null)).toBe(0);
    expect(plannedQuantity(500, undefined)).toBe(0);
  });

  it('Acceptat zero oprește cererea, chiar dacă rămân 500 comandate', () => {
    expect(plannedQuantity(500, 0)).toBe(0);
  });

  it('creșterea numai a acceptatei 500 → 600 schimbă planul', () => {
    expect(plannedQuantity(500, 500)).toBe(500);
    expect(plannedQuantity(500, 600)).toBe(600);
  });

  it('scăderea ambelor cantități 500 → 400 schimbă planul', () => {
    expect(plannedQuantity(500, 500)).toBe(500);
    expect(plannedQuantity(400, 400)).toBe(400);
  });

  it('cantitatea comandată nu schimbă planul acceptat', () => {
    expect(plannedQuantity(600, 400)).toBe(400);
  });

  it('acceptata invalidă nu reactivează cantitatea comandată', () => {
    expect(plannedQuantity(500, NaN)).toBe(0);
    expect(plannedQuantity(500, Infinity)).toBe(0);
    expect(plannedQuantity(500, -1)).toBe(0);
  });
});
