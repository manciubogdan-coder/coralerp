import { describe, expect, it } from 'bun:test';
import { cancellationPatch, isErpCancellationApplied } from '../supabase/functions/ingest-erp-orders/cancellation';

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
});