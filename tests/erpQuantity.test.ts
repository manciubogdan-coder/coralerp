import { describe, it, expect } from 'bun:test';
import { plannedQuantity } from '../supabase/functions/_shared/erpQuantity';

describe('plannedQuantity (import Senior ERP)', () => {
  it('preferă „Acceptat" când e setat', () => {
    expect(plannedQuantity(100, 80)).toBe(80);
  });

  it('fără „Acceptat" folosește cantitatea comandată', () => {
    expect(plannedQuantity(100, null)).toBe(100);
    expect(plannedQuantity(100, 0)).toBe(100);
    expect(plannedQuantity(100, undefined)).toBe(100);
  });

  it('o modificare a „Acceptat" se propagă', () => {
    expect(plannedQuantity(100, 90)).toBe(90);
  });

  it('o modificare a „Cantitate" se propagă când „Acceptat" lipsește', () => {
    expect(plannedQuantity(120, null)).toBe(120);
  });
});
