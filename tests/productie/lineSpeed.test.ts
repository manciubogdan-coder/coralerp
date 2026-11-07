import { describe, expect, it } from 'vitest';
import { buildSpeedReport, mergedHours, suspectReason, type SpeedSession } from '../../src/lib/productie/lineSpeed';

const s = (id: string, start: string, end: string | null, buc: number, extra: Partial<SpeedSession> = {}): SpeedSession => ({
  id, linie_id: 'L1', ora_start: `2026-11-02T${start}:00`, ora_sfarsit: end ? `2026-11-02T${end}:00` : null, cantitate_produsa: buc, numar_angajati: 2, ...extra,
});
const line = { id: 'L1', nume: 'Flowpack', capacitate_ora: 1000 };
const build = (sessions: SpeedSession[], excludeSuspect = true) =>
  buildSpeedReport({ sessions, lines: [line], dayOf: iso => iso.slice(0, 10), productOf: () => 'P', excludeSuspect });

describe('viteza pe linie vs normă', () => {
  it('împarte la orele lucrate, nu la ore pe zi sau 24h', () => {
    // 2 sesiuni a câte 2h într-o zi = 4h lucrate, 3200 buc → 800 buc/oră, 80% din normă
    const r = build([s('a', '06:00', '08:00', 1600), s('b', '10:00', '12:00', 1600)]).lines[0];
    expect(r.ore).toBe(4);
    expect(r.bucPeOra).toBe(800);
    expect(r.procentNorma).toBe(80);
    expect(r.bucNerealizate).toBe(800);
    expect(r.orePierdute).toBeCloseTo(0.8);
  });

  it('nu numără de două ori timpul sesiunilor simultane pe aceeași linie', () => {
    expect(mergedHours([s('a', '06:00', '08:00', 0), s('b', '07:00', '09:00', 0)])).toBe(3);
    const r = build([s('a', '06:00', '08:00', 1500), s('b', '07:00', '09:00', 1500)]).lines[0];
    expect(r.ore).toBe(3);
    expect(r.bucPeOra).toBe(1000);
  });

  it('buc/oră/om folosește orele fiecărei sesiuni × oamenii ei', () => {
    const r = build([s('a', '06:00', '08:00', 1600, { numar_angajati: 4 })]).lines[0];
    expect(r.bucPeOraOm).toBe(200);
  });

  it('marchează sesiunile uitate pornite, prea scurte sau peste 3× norma', () => {
    expect(suspectReason(s('x', '06:00', null, 0), 1000)).toBe('deschisa');
    expect(suspectReason({ ...s('x', '06:00', '06:00', 10), ora_sfarsit: '2026-11-02T19:00:00' }, 1000)).toBe('prea_lunga');
    expect(suspectReason(s('x', '06:00', '06:01', 10), 1000)).toBe('prea_scurta');
    expect(suspectReason(s('x', '06:00', '07:00', 3001), 1000)).toBe('peste_norma');
    expect(suspectReason(s('x', '06:00', '07:00', 3000), 1000)).toBeNull();
  });

  it('exclude sesiunile suspecte doar când e bifat, dar pe cele deschise mereu', () => {
    const xs = [s('a', '06:00', '08:00', 1600), s('b', '09:00', '10:00', 9000), s('c', '11:00', null, 0)];
    expect(build(xs, true).lines[0].buc).toBe(1600);
    expect(build(xs, false).lines[0].buc).toBe(10600);
    expect(build(xs, true).suspects.map(x => x.motiv).sort()).toEqual(['deschisa', 'peste_norma']);
  });
});
