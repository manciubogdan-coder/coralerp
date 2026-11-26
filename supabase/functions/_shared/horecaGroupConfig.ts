import { DEFAULT_HORECA_GROUPS, normalizeHoreca, type HorecaGroupDefinition } from './horecaRules.ts';

export async function loadHorecaGroups(cloud: any): Promise<{ groups: HorecaGroupDefinition[]; version: number }> {
  const { data, error } = await cloud.from('productie_horeca_grupe').select('groups,version').eq('id', true).maybeSingle();
  if (error) throw error;
  return data ? { groups: data.groups, version: data.version } : { groups: DEFAULT_HORECA_GROUPS, version: 0 };
}

export function changeHorecaGroups(current: HorecaGroupDefinition[], body: any, clients: { nickname?: string }[]) {
  const id = String(body?.id ?? '');
  const group = current.find(g => g.id === id);
  if (!['create', 'rename', 'delete'].includes(body?.operation)) throw new Error('Operațiune invalidă.');
  if (body.operation !== 'create' && !group) throw new Error('Grupa nu mai există. Reverifică lista.');
  if (body.operation === 'delete' && group) {
    const aliases = new Set([group.name, ...group.aliases].map(normalizeHoreca));
    const count = clients.filter(c => aliases.has(normalizeHoreca(c.nickname))).length;
    if (count) throw new Error(`Grupa are ${count} clienți. Atribuie-i altei grupe sau scoate-i din HoReCa înainte să o ștergi.`);
    return current.filter(g => g.id !== id);
  }
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name)) throw new Error('Denumirea trebuie să aibă între 1 și 80 de caractere.');
  if (current.some(g => g.id !== group?.id && [g.name, ...g.aliases].some(a => normalizeHoreca(a) === normalizeHoreca(name)))) throw new Error('Denumirea este deja folosită de altă grupă.');
  if (body.operation === 'create') {
    if (!/^[0-9a-f-]{36}$/i.test(id) || current.some(g => g.id === id)) throw new Error('Identificator de grupă invalid.');
    return [...current, { id, name, aliases: [name] }];
  }
  return current.map(g => g.id === id ? { ...g, name, aliases: [...new Set([...g.aliases, g.name, name])] } : g);
}