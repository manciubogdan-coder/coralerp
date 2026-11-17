import { describe, it, expect } from 'vitest';
import { composeWeek, dailyOrders, dailyPlan, isSturdy } from '@/lib/achizitii/truckBuilder';
import type { RadarRow } from '@/lib/achizitii/truckRadar';

// 2026-11-16 is a Monday. perDay = kg consumed every weekday (Mon..Sun).
const row = (name: string, perDay: number | number[]): RadarRow => ({ key: name, name, unit: 'kg', productId: name, snapshots: { '2026-11-16': 0 },
  received: {}, returned: {}, outbound: {}, commitments: {}, orderedPerDate: {}, actualConsumption: {}, buffer: 0,
  transferAvg: Array.isArray(perDay) ? perDay : Array(7).fill(perDay) });
const MON = '2026-11-16';

describe('composeWeek', () => {
  it('treats herbs and leaves as perishable, heads and radicchio as sturdy', () => {
    expect(isSturdy('Coriandru')).toBe(false);
    expect(isSturdy('Baby Spanac')).toBe(false);
    expect(isSturdy('Iceberg capatani')).toBe(true);
    expect(isSturdy('Radicchio Rosso')).toBe(true);
  });

  it('never pulls herbs or leaves from later days, only heads', () => {
    const w = composeWeek([row('Coriandru', 2200), row('Iceberg capatani', [2400, 400 * 18, 2400, 2400, 2400, 2400, 2400])], MON);
    const mon = w[0];
    expect(mon.pallets).toBeCloseTo(22, 0); // 10 coriandru + 6 iceberg + 6 iceberg pulled from Tuesday (28 → 22)
    expect(mon.items.filter((i) => i.movedFrom).every((i) => i.name.startsWith('Iceberg'))).toBe(true);
    expect(mon.items.some((i) => i.name === 'Coriandru' && i.movedFrom)).toBe(false);
  });

  it('a day already between 22 and 26 pallets pulls nothing', () => {
    const w = composeWeek([row('Rucola', 220 * 24), row('Iceberg capatani', 4000)], MON);
    expect(w[0].status).toBe('over'); // 24 + 10 = 34
    const full = composeWeek([row('Rucola', 220 * 24)], MON)[0];
    expect(full.status).toBe('full');
    expect(full.movesIn).toHaveLength(0);
  });

  it('Sunday need rides on Saturday and a tiny Saturday merges into Friday', () => {
    // Fri 20 pal of rucola, Sat 0.5 pal, Sun 0.5 pal → Sat+Sun 1 pal goes on Friday.
    const w = composeWeek([row('Rucola', [0, 0, 0, 0, 220 * 20, 110, 110])], MON);
    const fri = w.find((d) => d.day === '2026-11-20')!; const sat = w.find((d) => d.day === '2026-11-21')!;
    expect(sat.status).toBe('merged');
    expect(sat.mergedInto).toBe('2026-11-20');
    expect(fri.pallets).toBeCloseTo(21, 0);
  });

  it('overflow sends heads one truck earlier, refusing the move keeps two trucks', () => {
    // Mon 20 pal leaves, Tue 20 leaves + 12 heads = 32.
    const rows = [row('Rucola', [220 * 20, 220 * 20, 0, 0, 0, 0, 0]), row('Iceberg capatani', [0, 400 * 12, 0, 0, 0, 0, 0])];
    const w = composeWeek(rows, MON);
    expect(w[0].pallets).toBeCloseTo(26, 0);
    expect(w[1].pallets).toBeCloseTo(26, 0);
    const refused = new Set([...w[0].movesIn.map((m) => m.id)]);
    const w2 = composeWeek(rows, MON, { refused });
    expect(w2[1].trucks).toBe(2);
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
