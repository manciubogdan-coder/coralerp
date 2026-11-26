import { describe, it, expect } from 'bun:test';
import { auditHorecaClients } from '../../src/lib/productie/horecaClientAudit';
const day = '2026-11-26';
describe('HoReCa client verification', () => {
  it('keeps all clients including those without orders and distinguishes Caterin and Mircea', () => {
    const rows = auditHorecaClients([{ id: '1', nume_magazin: 'A', nickname: 'CATERIN' }, { id: '2', nume_magazin: 'B', nickname: 'MIRCEA HORECA' }, { id: '3', nume_magazin: 'C' }], [], day);
    expect(rows.map(r => r.group)).toEqual(['Caterin', 'Mircea', null]); expect(rows).toHaveLength(3);
  });
  it('exposes a client missing from the register without guessing its group', () => {
    const rows = auditHorecaClients([], [{ magazin: 'Nou', data_productie: day }, { magazin: 'Ieri', data_productie: '2026-11-25' }, { magazin: 'PRODUCTIE_AVANS', data_productie: day }], day);
    expect(rows).toHaveLength(1); expect(rows[0].issue).toBe('missing'); expect(rows[0].group).toBeNull(); expect(rows[0].orders).toBe(1);
  });
  it('flags conflicting delivery assignments instead of borrowing a group', () => {
    const rows = auditHorecaClients([{ id: '1', nume_magazin: 'A', punct_livrare: 'X', nickname: 'Caterin' }, { id: '2', nume_magazin: 'A', punct_livrare: 'Y', nickname: 'Mircea' }], [{ magazin: 'A', punct_livrare: 'Z', data_productie: day }], day);
    expect(rows.find(r => r.point === 'Z')?.issue).toBe('conflict');
  });
  it('reflects explicit assignment and duplicate conflicts', () => {
    const clients = [{ id: '1', nume_magazin: 'A', nickname: '' }];
    expect(auditHorecaClients(clients, [], day)[0].group).toBeNull();
    clients[0].nickname = 'Caterin'; expect(auditHorecaClients(clients, [], day)[0].group).toBe('Caterin');
    expect(auditHorecaClients([...clients, { id: '2', nume_magazin: 'A', nickname: 'Mircea' }], [], day).every(r => r.issue === 'conflict')).toBe(true);
  });
});