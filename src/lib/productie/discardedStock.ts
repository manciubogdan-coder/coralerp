import { supabase } from '@/integrations/supabase/client';
import { discardedPoolPatch, isResetOrder, ResetOrder, statusWithoutDiscardedStock } from './discardedStockRules';

interface Lot { id: string; cantitate_surplus: number }
interface Session { comanda_id: string; status: string; cantitate_produsa: number | null }
export interface DiscardPreview { day: string; lots: Lot[]; orders: ResetOrder[]; sessions: Session[] }

async function allPages<T>(query: (from: number) => any): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await query(from);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

export async function previewDiscardedStock(day: string): Promise<DiscardPreview> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Alege o dată validă.');
  const [lots, orders] = await Promise.all([
    allPages<Lot>(from => supabase.from('productie_restocari').select('id, cantitate_surplus')
      .eq('status', 'disponibil').gt('cantitate_surplus', 0).order('id').range(from, from + 999)),
    allPages<ResetOrder>(from => supabase.from('productie_comenzi')
      .select('id, data_productie, cantitate, cantitate_din_restock, linie_id, status, updated_at')
      .eq('data_productie', day).gt('cantitate_din_restock', 0).order('id').range(from, from + 999)),
  ]);
  const sessions: Session[] = [];
  for (let i = 0; i < orders.length; i += 50) {
    sessions.push(...await allPages<Session>(from => supabase.from('productie_sesiuni_lucru')
      .select('comanda_id, status, cantitate_produsa').in('comanda_id', orders.slice(i, i + 50).map(o => o.id))
      .order('id').range(from, from + 999)));
  }
  return { day, lots, orders: orders.filter(o => isResetOrder(o, day)), sessions };
}

export async function applyDiscardedStock(preview: DiscardPreview, clearPool: boolean) {
  // Recheck before writing: confirmation must not silently include newly added lots/orders.
  const fresh = await previewDiscardedStock(preview.day);
  const signature = (p: DiscardPreview) => JSON.stringify({
    lots: clearPool ? p.lots : [], orders: p.orders, sessions: p.sessions,
  });
  if (signature(fresh) !== signature(preview)) throw new Error('Datele s-au schimbat. Închide și verifică din nou înainte de confirmare.');
  if (fresh.sessions.some(s => s.status === 'activa')) throw new Error('Există producție în desfășurare pe comenzile afectate. Oprește sau finalizează sesiunile înainte de resetare.');
  const { data: user } = await supabase.auth.getUser();
  const timestamp = new Date().toISOString();
  let cleared = 0;
  let reset = 0;
  try {
    // Clear stock FIRST so a partial failure never leaves discarded stock available.
    if (clearPool) for (const lot of fresh.lots) {
      const { data, error } = await supabase.from('productie_restocari')
        .update(discardedPoolPatch(Number(lot.cantitate_surplus), timestamp, user.user?.id || null))
        .eq('id', lot.id).eq('status', 'disponibil').eq('cantitate_surplus', lot.cantitate_surplus).select('id');
      if (error) throw error;
      if (data?.length !== 1) throw new Error('Un lot a fost modificat între timp.');
      cleared++;
    }
    for (const order of fresh.orders) {
      const produced = fresh.sessions.filter(s => s.comanda_id === order.id && ['finalizata', 'partial'].includes(s.status))
        .reduce((sum, s) => sum + Number(s.cantitate_produsa || 0), 0);
      // Do NOT use setAlocareComanda: that would return discarded goods to the pool.
      const { data, error } = await supabase.from('productie_comenzi').update({
        cantitate_din_restock: 0, status: statusWithoutDiscardedStock(order, produced), updated_at: timestamp,
      }).eq('id', order.id).eq('data_productie', preview.day).eq('updated_at', order.updated_at)
        .eq('cantitate_din_restock', order.cantitate_din_restock).select('id');
      if (error) throw error;
      if (data?.length !== 1) throw new Error('O comandă a fost modificată între timp.');
      reset++;
    }
  } catch (error: any) {
    throw new Error(`Operație oprită: ${cleared} loturi golite, ${reset} comenzi resetate. ${error.message || 'Reîncearcă după reîncărcare.'}`);
  }
  return { cleared, reset };
}