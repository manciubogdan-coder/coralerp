import { describe, it, expect } from 'bun:test';
import { changeHorecaGroups, loadHorecaGroups } from '../../supabase/functions/_shared/horecaGroupConfig';
import { DEFAULT_HORECA_GROUPS, createHorecaClientLookup, horecaGroup, horecaOrderGroup } from '../../supabase/functions/_shared/horecaRules';
import { auditHorecaClients } from '../../src/lib/productie/horecaClientAudit';
const id = '1146e95e-c7f4-4d9a-82f8-027b78a6567a';
describe('configurable HoReCa groups', () => {
  it('creates a new group and routes only its assigned clients', () => {
    const groups = changeHorecaGroups(DEFAULT_HORECA_GROUPS, { operation: 'create', id, name: 'Restaurante' }, []);
    expect(groups).toHaveLength(3);
    const lookup = createHorecaClientLookup([{ nume_magazin: 'A', nickname: 'Restaurante' }, { nume_magazin: 'B', nickname: 'Retail' }], groups);
    expect(lookup({ magazin: 'A' })).toBe('Restaurante'); expect(lookup({ magazin: 'B' })).toBeNull();
    expect(horecaOrderGroup({ horeca_group: 'Restaurante' })).toBe('Restaurante');
  });
  it('renames Mircea while preserving existing clients and aliases', () => {
    const groups = changeHorecaGroups(DEFAULT_HORECA_GROUPS, { operation: 'rename', id: 'mircea', name: 'Echipa Nord' }, [{ nickname: 'MIRCEA HORECA' }]);
    expect(groups[1].id).toBe('mircea');
    expect(horecaGroup('MIRCEA HORECA', groups)).toBe('Echipa Nord');
    expect(horecaGroup('Mircea', groups)).toBe('Echipa Nord');
    expect(auditHorecaClients([{ id: 'c1', nume_magazin: 'A', nickname: 'MIRCEA HORECA' }], [], '2026-11-26', groups)[0].group).toBe('Echipa Nord');
  });
  it('deletes an empty group without restoring it from built-in defaults', () => {
    const groups = changeHorecaGroups(DEFAULT_HORECA_GROUPS, { operation: 'delete', id: 'caterin' }, []);
    expect(horecaGroup('Caterin', groups)).toBeNull();
    expect(horecaOrderGroup({ horeca_group: null, productie_clienti: { nickname: 'Caterin' } })).toBeNull();
  });
  it('protects clients when deleting assigned groups', () => {
    expect(() => changeHorecaGroups(DEFAULT_HORECA_GROUPS, { operation: 'delete', id: 'mircea' }, [{ nickname: 'MIRCEA HORECA' }])).toThrow('1 clienți');
    expect(DEFAULT_HORECA_GROUPS).toHaveLength(2);
  });
  it('rejects empty names and conflicts including previous names', () => {
    expect(() => changeHorecaGroups(DEFAULT_HORECA_GROUPS, { operation: 'create', id, name: ' ' }, [])).toThrow();
    expect(() => changeHorecaGroups(DEFAULT_HORECA_GROUPS, { operation: 'create', id, name: '  MIRCEA HORECA ' }, [])).toThrow();
  });
  it('retains an intentionally empty configuration and fails visibly on read errors', async () => {
    const cloud = (data: any, error: any = null) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }) });
    expect(await loadHorecaGroups(cloud({ groups: [], version: 3 }))).toEqual({ groups: [], version: 3 });
    await expect(loadHorecaGroups(cloud(null, new Error('offline')))).rejects.toThrow('offline');
  });
});