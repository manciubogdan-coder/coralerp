import { supabaseCloud } from '@/integrations/supabase/cloudClient';

// Produse primite gata ambalate (doar etichetate): comenzile lor nu merg pe nicio linie,
// ci direct în Picking, unde apar gata de numărat.
export async function loadDirectPickingIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseCloud.from('productie_direct_picking')
      .select('produs_id').order('produs_id').range(from, from + 999);
    if (error) throw error;
    (data || []).forEach((r: any) => ids.add(String(r.produs_id)));
    if (!data || data.length < 1000) break;
  }
  return ids;
}

export { isDirectPickingOrder, applyDirectPicking } from './directPickingRules';
