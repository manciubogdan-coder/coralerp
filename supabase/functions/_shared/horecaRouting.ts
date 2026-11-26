import { HORECA_LINE_ID, createHorecaClientLookup, isHorecaLine, DEFAULT_HORECA_GROUPS } from './horecaRules.ts';

async function pages(makeQuery: () => any) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await makeQuery().order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function loadHorecaRouting(client: any, groups = DEFAULT_HORECA_GROUPS) {
  const [clients, lines] = await Promise.all([
    pages(() => client.from('productie_clienti').select('id,nume_magazin,punct_livrare,nickname')),
    pages(() => client.from('productie_linii').select('id,nume,status')),
  ]);
  const lookup = createHorecaClientLookup(clients, groups);
  let line = lines.find(isHorecaLine);
  if (!line) {
    const { data, error } = await client.from('productie_linii').upsert({
      id: HORECA_LINE_ID, nume: 'HoReCa', capacitate_ora: 0, status: 'activa',
    }, { onConflict: 'id', ignoreDuplicates: true }).select('id,nume,status').maybeSingle();
    if (error) throw error;
    // A concurrent creator may have won the insert.
    line = data;
    if (!line) {
      const result = await client.from('productie_linii').select('id,nume,status').eq('id', HORECA_LINE_ID).single();
      if (result.error) throw result.error;
      line = result.data;
    }
  }
  if (!line || line.status !== 'activa') throw new Error('Linia HoReCa nu este activă. Verifică liniile de producție.');
  return { lineId: String(line.id), lookup };
}

/** Move demand and active sessions only. Finished sessions retain their real line/time. */
export async function reconcileHorecaRouting(client: any, directIds: Set<string>, days?: string[], groups = DEFAULT_HORECA_GROUPS) {
  const routing = await loadHorecaRouting(client, groups);
  const [outstanding, active] = await Promise.all([
    pages(() => {
      const query = client.from('productie_comenzi').select('id,magazin,punct_livrare,produs_id,tip_comanda,linie_id,status,cantitate')
        .neq('status', 'completed').gt('cantitate', 0);
      return days ? query.in('data_productie', days.length ? days : ['0001-01-01']) : query;
    }),
    pages(() => client.from('productie_sesiuni_lucru').select('id,comanda_id,linie_id,status').eq('status', 'activa')),
  ]);
  const byId = new Map(outstanding.map(row => [row.id, row]));
  const missing = [...new Set(active.map(s => s.comanda_id))].filter(id => id && !byId.has(id));
  for (let i = 0; i < missing.length; i += 50) {
    const rows = await pages(() => client.from('productie_comenzi')
      .select('id,magazin,punct_livrare,produs_id,tip_comanda,linie_id,status,cantitate').in('id', missing.slice(i, i + 50)));
    rows.forEach(row => byId.set(row.id, row));
  }
  let movedOrders = 0, movedSessions = 0;
  const failures: string[] = [];
  const readyOrders = new Set<string>();
  const orderGroups = new Map<string, any[]>();
  for (const order of byId.values()) {
    if (!routing.lookup(order) || directIds.has(String(order.produs_id))) continue;
    if (order.linie_id === routing.lineId) { readyOrders.add(order.id); continue; }
    const key = `${order.linie_id || ''}||${order.status}`;
    orderGroups.set(key, [...(orderGroups.get(key) || []), order]);
  }
  for (const group of orderGroups.values()) {
    const first = group[0];
    if (!first) continue;
    for (let i = 0; i < group.length; i += 50) {
      const part = group.slice(i, i + 50);
      const patch = { linie_id: routing.lineId, ...(first.status === 'pending' ? { status: 'assigned' } : {}) };
      let query = client.from('productie_comenzi').update(patch).in('id', part.map(o => o.id)).eq('status', first.status);
      query = first.linie_id ? query.eq('linie_id', first.linie_id) : query.is('linie_id', null);
      const { data, error } = await query.select('id');
      if (error) { failures.push(error.message); continue; }
      for (const row of data || []) readyOrders.add(row.id);
      movedOrders += (data || []).length;
      if ((data || []).length !== part.length) failures.push('Unele comenzi au fost modificate în timpul mutării; vor fi reverificate.');
    }
  }
  const sessionGroups = new Map<string, any[]>();
  for (const session of active) {
    if (!readyOrders.has(session.comanda_id) || session.linie_id === routing.lineId) continue;
    sessionGroups.set(session.linie_id, [...(sessionGroups.get(session.linie_id) || []), session]);
  }
  for (const [oldLine, group] of sessionGroups) {
    for (let i = 0; i < group.length; i += 50) {
      const part = group.slice(i, i + 50);
      let query = client.from('productie_sesiuni_lucru').update({ linie_id: routing.lineId })
        .in('id', part.map(s => s.id)).eq('status', 'activa');
      query = oldLine ? query.eq('linie_id', oldLine) : query.is('linie_id', null);
      const { data, error } = await query.select('id');
      if (error) failures.push(error.message);
      else {
        movedSessions += (data || []).length;
        if ((data || []).length !== part.length) failures.push('Unele sesiuni s-au încheiat în timpul mutării; istoricul lor a rămas neatins.');
      }
    }
  }
  return { lineId: routing.lineId, movedOrders, movedSessions, failures };
}