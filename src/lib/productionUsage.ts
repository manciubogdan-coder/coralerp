import { supabase } from '@/integrations/supabase/client';
import { dayBounds, readPages, sessionUsage } from './forecastReconciliation';

export async function loadProductionUsage(from: string, to: string) {
  const sessions = await readPages(() => supabase.from('productie_sesiuni_lucru')
    .select('id, comanda_id, ora_sfarsit, status, cantitate_produsa')
    .in('status', ['finalizata', 'partial']).gte('ora_sfarsit', dayBounds(from).start)
    .lte('ora_sfarsit', dayBounds(to).end).order('id'));
  const ids = [...new Set(sessions.map(s => s.comanda_id))];
  const orders: any[] = [], customs: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const [o, c] = await Promise.all([
      readPages(() => supabase.from('productie_comenzi').select(`id, data_productie, tip_comanda, magazin,
        productie_produse(nume, productie_retete(activa, productie_retete_ingrediente(cantitate_necesara, unitate_masura, productie_ingrediente(nume))))`)
        .in('id', batch).order('id')),
      readPages(() => supabase.from('productie_comenzi_ingrediente')
        .select('*, productie_ingrediente(nume)').in('comanda_id', batch).order('id')),
    ]);
    orders.push(...o); customs.push(...c);
  }
  return sessionUsage(sessions, orders, customs);
}