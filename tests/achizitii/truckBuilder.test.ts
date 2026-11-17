import { describe, it, expect } from 'vitest';
import { composeTrucks } from '@/lib/achizitii/truckBuilder';
import type { RadarRow } from '@/lib/achizitii/truckRadar';

const row = (name: string, perDay: number): RadarRow => ({ key: name, name, unit: 'kg', productId: name, snapshots: { '2026-11-16': 0 },
  received: {}, returned: {}, outbound: {}, commitments: {}, orderedPerDate: {}, transferAvg: Array(7).fill(perDay), actualConsumption: {}, buffer: 0 });

describe('composeTrucks', () => {
  it('flags under 22 pallets and pulls only sturdy goods forward', () => {
    const d = composeTrucks([row('Rucola', 440), row('Iceberg capatani', 800)], '2026-11-16', 1, 3)[0];
    expect(d.pallets).toBeCloseTo(4); // 2 rucola + 2 capatani
    expect(d.missing).toBeCloseTo(18);
    expect(d.pullForward.every((p) => p.name.startsWith('Iceberg'))).toBe(true);
  });
  it('needs two trucks above 26 pallets', () => {
    const d = composeTrucks([row('Iceberg capatani', 400 * 30)], '2026-11-16', 1, 0)[0];
    expect(d.trucks).toBe(2);
  });
});
