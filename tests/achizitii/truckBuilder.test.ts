import { describe, it, expect } from 'vitest';
import { arrivalFor, composeWeek, dailyOrders, dailyPlan, isSturdy } from '@/lib/achizitii/truckBuilder';
import type { RadarRow } from '@/lib/achizitii/truckRadar';

// 2026-11-16 is a Monday. perDay = kg consumed every weekday (Mon..Sun).
const row = (name: string, perDay: number | number[]): RadarRow => ({ key: name, name, unit: 'kg', productId: name, snapshots: { '2026-11-16': 0 },
  received: {}, returned: {}, outbound: {}, commitments: {}, orderedPerDate: {}, actualConsumption: {}, buffer: 0,
  transferAvg: Array.isArray(perDay) ? perDay : Array(7).fill(perDay) });
const MON = '2026-11-16';

// Arrivals Tue–Sat; goods are used the day after they arrive. Weekday arrays are Mon..Sun need per production day.
describe('composeWeek', () => {
  it('treats herbs and leaves as perishable, heads and radicchio as sturdy', () => {
    expect(isSturdy('Coriandru')).toBe(false);
    expect(isSturdy('Baby Spanac')).toBe(false);
    expect(isSturdy('Iceberg capatani')).toBe(true);
    expect(isSturdy('Radicchio Rosso')).toBe(true);
  });

  it('Saturday truck carries Sunday, Monday and Tuesday production; no Sunday or Monday truck', () => {
    expect(arrivalFor('2026-11-22')).toBe('2026-11-21'); // Sun → Sat
    expect(arrivalFor('2026-11-23')).toBe('2026-11-21'); // Mon → Sat
    expect(arrivalFor('2026-11-24')).toBe('2026-11-21'); // Tue → Sat
    expect(arrivalFor('2026-11-25')).toBe('2026-11-24'); // Wed → Tue
    const w = composeWeek([row('Rucola', [220 * 8, 220 * 8, 220 * 22, 220 * 22, 220 * 22, 220 * 22, 220 * 6])], MON);
    expect(w.some((d) => [1, 7].includes(new Date(`${d.day}T12:00:00Z`).getUTCDay() || 7))).toBe(false);
    expect(w.find((d) => d.day === '2026-11-21')!.pallets).toBeCloseTo(22, 0); // 6 + 8 + 8
    expect(w.find((d) => d.day === '2026-11-24')!.pallets).toBeCloseTo(22, 0); // Wednesday
  });

  it('never pulls herbs or leaves from later trucks, only heads', () => {
    // Wed truck (Thu production) 10 coriandru + 6 heads; Thu truck (Fri) 20 coriandru + 8 heads = 28.
    const w = composeWeek([row('Coriandru', [0, 0, 0, 220 * 10, 220 * 20, 0, 0]), row('Iceberg capatani', [0, 0, 0, 400 * 6, 400 * 8, 0, 0])], MON);
    const wed = w.find((d) => d.day === '2026-11-18')!;
    expect(wed.pallets).toBeCloseTo(22, 0);
    expect(wed.items.filter((i) => i.movedFrom).every((i) => i.name.startsWith('Iceberg'))).toBe(true);
    expect(wed.items.some((i) => i.name === 'Coriandru' && i.movedFrom)).toBe(false);
  });

  it('a truck already between 22 and 26 pallets pulls nothing', () => {
    const full = composeWeek([row('Rucola', [0, 0, 0, 220 * 24, 0, 0, 0])], MON).find((d) => d.day === '2026-11-18')!;
    expect(full.status).toBe('full');
    expect(full.movesIn).toHaveLength(0);
  });

  it('overflow sends heads one truck earlier, refusing the move keeps two trucks', () => {
    // Wed truck 20 leaves; Thu truck 20 leaves + 12 heads = 32.
    const rows = [row('Rucola', [0, 0, 0, 220 * 20, 220 * 20, 0, 0]), row('Iceberg capatani', [0, 0, 0, 0, 400 * 12, 0, 0])];
    const w = composeWeek(rows, MON);
    const wed = w.find((d) => d.day === '2026-11-18')!; const thu = w.find((d) => d.day === '2026-11-19')!;
    expect(wed.pallets).toBeCloseTo(26, 0);
    expect(thu.pallets).toBeCloseTo(26, 0);
    const refused = new Set(wed.movesIn.map((m) => m.id));
    const w2 = composeWeek(rows, MON, { refused });
    expect(w2.find((d) => d.day === '2026-11-19')!.trucks).toBe(2);
  });
});

describe('dailyPlan (forecast table and truck panel share it)', () => {
  it('goods already ordered for a day cover it, so nothing more is suggested there', () => {
    // Latuga Bowl: 71.2 kg stock, 66.2 kg/day, buffer 55.5, 220 kg already ordered for Tuesday.
    const r: RadarRow = { ...row('Latuga Bowl', 66.2), snapshots: { [MON]: 71.2 }, buffer: 55.5, orderedPerDate: { '2026-11-17': 220 } };
    const days = ['2026-11-16', '2026-11-17', '2026-11-18'];
    const plan = dailyPlan(r, days, MON);
    expect(plan[0].qty).toBeCloseTo(50.5, 1); // 55.5 − (71.2 − 66.2)
    expect(plan[1].qty).toBe(0);              // 5 + 50.5 + 220 − 66.2 = 209.3 ≥ 55.5
    expect(dailyOrders(r, days, MON)).toEqual(plan.map((s) => s.qty));
  });
});

describe('composeWeek two weeks ahead', () => {
  it('shows two weeks of trucks, Tuesday to Saturday', () => {
    const w = composeWeek([row('Rucola', 220 * 22)], MON);
    expect(w).toHaveLength(10);
    expect(w[0].day).toBe('2026-11-17');
    expect(w[w.length - 1].day).toBe('2026-11-28');
  });

  it('a tiny truck rides on the full truck before it after that one sends heads earlier', () => {
    // Thu truck (Fri production) 20 rucola + 6 heads = 26; Fri truck (Sat production) 1 pal; Wed truck 20 rucola.
    const rows = [row('Rucola', [0, 0, 0, 220 * 20, 220 * 20, 220, 0]), row('Iceberg capatani', [0, 0, 0, 0, 400 * 6, 0, 0])];
    const w = composeWeek(rows, MON);
    const wed = w.find((d) => d.day === '2026-11-18')!; const thu = w.find((d) => d.day === '2026-11-19')!; const fri = w.find((d) => d.day === '2026-11-20')!;
    expect(fri.status).toBe('merged');
    expect(thu.pallets).toBeLessThanOrEqual(26.05);
    expect(wed.items.some((i) => i.name === 'Iceberg capatani' && i.movedFrom === '2026-11-19')).toBe(true);
  });
});
