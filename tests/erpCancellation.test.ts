import { describe, expect, it } from 'bun:test';
import { cancellationPatch, isErpCancellationApplied } from '../supabase/functions/ingest-erp-orders/cancellation';
import { plannedQuantity } from '../supabase/functions/_shared/erpQuantity';

describe('Senior removed order lines', () => {
  it('uses completed with zero demand instead of the rejected canceled_by_erp', () => {
    expect(cancellationPatch()).toEqual({ cantitate: 0, status: 'completed' });
  });

  it('does not repeat cancellation writes on subsequent bridge cycles', () => {
    expect(isErpCancellationApplied(cancellationPatch())).toBe(true);
    expect(isErpCancellationApplied({ cantitate: 258, status: 'completed' })).toBe(false);
    expect(isErpCancellationApplied({ cantitate: 0, status: 'assigned' })).toBe(false);
  });

  it('recognizes older cancellation records without processing stock again', () => {
    expect(isErpCancellationApplied({ cantitate: 0, status: 'canceled_by_erp' })).toBe(true);
  });

  for (const accepted of [null, 0]) {
    it(`an already-imported 500-piece order stops demand when Acceptat is ${accepted}`, () => {
      const existing = { cantitate: 500, status: 'assigned', cantitate_reala_produsa: 120 };
      const nextQuantity = plannedQuantity(500, accepted);
      if (nextQuantity <= 0 && !isErpCancellationApplied(existing)) {
        Object.assign(existing, cancellationPatch());
      }
      expect(existing.cantitate).toBe(0);
      expect(existing.status).toBe('completed');
      expect(existing.cantitate_reala_produsa).toBe(120);
      expect(isErpCancellationApplied(existing)).toBe(true);
    });
  }
});