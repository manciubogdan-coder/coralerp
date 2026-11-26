import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFinishWorkSession } from './useProductionData';
import { useAddSessionRebut } from './useSessionRebut';
import { refreshProductionQueries } from '@/lib/productie/refreshProductionQueries';
import { horecaProductNeeds, planHorecaFinish, type HorecaFinishOrder } from '@/lib/productie/horecaFinish';
import { loadDirectPickingIds } from '@/lib/productie/directPicking';
import { loadHorecaRouting } from '../../../supabase/functions/_shared/horecaRouting';
import { wholeUnits } from '@/lib/productie/finishSession';

async function loadSnapshot(ids: string[]) {
  const orders: any[] = [], sessions: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const [orderRows, sessionRows] = await Promise.all([
      supabase.from('productie_comenzi').select('*').in('id', part),
      (async () => {
        const rows: any[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from('productie_sesiuni_lucru').select('*')
            .in('comanda_id', part).order('id').range(offset, offset + 999);
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < 1000) return rows;
        }
      })(),
    ]);
    if (orderRows.error) throw orderRows.error;
    orders.push(...(orderRows.data || []));
    sessions.push(...sessionRows);
  }
  for (const order of orders) {
    const made = sessions.filter(s => s.comanda_id === order.id && ['finalizata', 'partial'].includes(s.status))
      .reduce((sum, s) => sum + Number(s.cantitate_produsa || 0), 0);
    order.cantitate_reala_produsa = Math.min(made, Math.max(0, wholeUnits(order.cantitate) - Number(order.cantitate_din_restock || 0)));
  }
  return { orders, sessions };
}

export function useHorecaWork() {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const queryClient = useQueryClient();
  const finishSession = useFinishWorkSession();
  const addRebut = useAddSessionRebut();
  const refresh = () => refreshProductionQueries(queryClient, ['orders', 'work-sessions', 'production-lines', 'restockings', 'marfa-restocata', 'orders-for-reports']);

  async function start(ids: string[], name: string, people: number) {
    if (locked.current) throw new Error('Acțiunea este deja în curs.');
    if (!name.trim() || !Number.isInteger(people) || people < 1) throw new Error('Completează operatorul principal și numărul de oameni.');
    setBusy(true);
    locked.current = true;
    try {
      const [snapshot, direct, routing] = await Promise.all([loadSnapshot(ids), loadDirectPickingIds(), loadHorecaRouting(supabase)]);
      const activeIds = new Set(snapshot.sessions.filter(s => s.status === 'activa').map(s => s.comanda_id));
      const pending = snapshot.orders.filter(o => routing.lookup(o) && !direct.has(String(o.produs_id)) &&
        o.status !== 'completed' && wholeUnits(o.cantitate) > Number(o.cantitate_reala_produsa || 0) + Number(o.cantitate_din_restock || 0) && !activeIds.has(o.id));
      if (!pending.length) return 0;
      const oraStart = new Date().toISOString();
      for (let i = 0; i < pending.length; i += 100) {
        const { error } = await supabase.from('productie_sesiuni_lucru').insert(pending.slice(i, i + 100).map(o => ({
          comanda_id: o.id, linie_id: routing.lineId, nume_operator: name.trim(), numar_angajati: people,
          ora_start: oraStart, status: 'activa',
        })));
        if (error) throw error;
      }
      return pending.length;
    } finally { await refresh(); locked.current = false; setBusy(false); }
  }

  async function finish(ids: string[], quantities: ReadonlyMap<string, number>, waste: ReadonlyMap<string, number>, full: boolean) {
    if (locked.current) throw new Error('Acțiunea este deja în curs.');
    for (const quantity of waste.values()) {
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Introdu rebutul valid, separat pe produs.');
    }
    setBusy(true);
    locked.current = true;
    try {
      const [snapshot, direct, routing] = await Promise.all([loadSnapshot(ids), loadDirectPickingIds(), loadHorecaRouting(supabase)]);
      const work: HorecaFinishOrder[] = [];
      let missing = false;
      for (const order of snapshot.orders) {
        if (!routing.lookup(order) || direct.has(String(order.produs_id))) continue;
        const active = snapshot.sessions.filter(s => s.comanda_id === order.id && s.status === 'activa');
        if (active.length > 1) throw new Error('O comandă are mai multe sesiuni active. Verifică sesiunile înainte de finalizare.');
        const session = active[0];
        if (!session) {
          if (order.status !== 'completed' && wholeUnits(order.cantitate) > Number(order.cantitate_reala_produsa || 0) + Number(order.cantitate_din_restock || 0)) missing = true;
          continue;
        }
        work.push({ ...order, sessionId: session.id });
      }
      if (!work.length) throw new Error('Nu mai există sesiuni active. Reîncarcă lista.');
      if (full && missing) throw new Error('Au rămas produse fără sesiune. Pornește-le înainte să finalizezi toată comanda.');
      const needs = horecaProductNeeds(work);
      if (full && [...needs].some(([id, need]) => (quantities.get(id) ?? 0) < need)) {
        throw new Error('Cantitățile s-au schimbat. Redeschide finalizarea sau închide parțial cu ceea ce ai produs.');
      }
      const plan = planHorecaFinish(work, quantities);
      const failed: string[] = [], succeeded = new Set<string>();
      for (const item of plan) {
        try {
          await finishSession.mutateAsync({ ...item, verifyWrites: true });
          succeeded.add(item.id);
        } catch (error: any) { failed.push(error?.message || String(error)); }
      }
      // Each product records its own waste, once, on a successfully closed session.
      for (const [productId, quantity] of waste) {
        if (quantity <= 0) continue;
        const row = work.find(o => o.produs_id === productId && succeeded.has(o.sessionId));
        const session = snapshot.sessions.find(s => s.id === row?.sessionId);
        if (!row || !session) { failed.push('Rebutul nu a putut fi salvat pentru unul dintre produse.'); continue; }
        try {
          await addRebut.mutateAsync({ sesiune_id: row.sessionId, comanda_id: row.id,
            linie_id: session.linie_id, linie_nume: 'HoReCa', cantitate: quantity });
        } catch (error: any) { failed.push(`Rebut: ${error?.message || error}`); }
      }
      if (failed.length) throw new Error(`Închiderea nu s-a terminat complet. ${failed.join(' · ')}`);
      return plan;
    } finally { await refresh(); locked.current = false; setBusy(false); }
  }
  return { start, finish, busy };
}