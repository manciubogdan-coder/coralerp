import { describe, expect, test } from 'bun:test';
import { operationDate } from '../../src/lib/operationDate';

describe('locked reception and transfer date', () => {
  test('new documents use the current Romanian day, not yesterday in UTC', () => {
    expect(operationDate(new Date('2026-11-02T22:30:00Z')).day).toBe('2026-11-03');
  });
  test('summer dates honor Bucharest daylight saving', () => {
    expect(operationDate(new Date('2026-07-02T21:30:00Z')).day).toBe('2026-07-03');
  });
  test('receipt timestamps preserve the actual recording instant', () => {
    expect(operationDate(new Date('2026-11-03T03:51:00Z')).timestamp).toBe('2026-11-03T03:51:00.000Z');
  });
  test('confirmation after midnight uses the new day', () => {
    expect(operationDate(new Date('2026-11-02T21:59:59Z')).day).toBe('2026-11-02');
    expect(operationDate(new Date('2026-11-02T22:00:00Z')).day).toBe('2026-11-03');
  });
});