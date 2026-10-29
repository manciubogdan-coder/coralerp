import { supabase } from '@/integrations/supabase/client';
import { clearedStockPatch } from './manualStocktake';
import { manualRestockPayload } from './manualRestock';

interface Lot { id: string; cantitate_surplus: number }
export async function readCurrentStock(): Promise<Lot[]> {
  const rows: Lot[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('productie_restocari').select('id, cantitate_surplus')
      .eq('status', 'disponibil').gt('cantitate_surplus', 0).order('id').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
export async function replaceManualStock(previous: Lot[], payload: ReturnType<typeof manualRestockPayload>[]) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Autentifică-te înainte de salvare.');
  if (JSON.stringify(await readCurrentStock()) !== JSON.stringify(previous)) throw new Error('Restocul s-a schimbat. Verifică și confirmă din nou.');
  // Stage new lots unavailable before clearing existing stock: never add over existing counts.
  const staged = payload.map(row => ({ ...row, id: crypto.randomUUID(), status: 'redistribuit' }));
  if (staged.length) {
    const { error } = await supabase.from('productie_restocari').insert(staged);
    if (error) throw error;
  }
  let cleared = 0;
  try {
    for (const lot of previous) {
      const { data, error } = await supabase.from('productie_restocari').update(clearedStockPatch())
        .eq('id', lot.id).eq('status', 'disponibil').eq('cantitate_surplus', lot.cantitate_surplus).select('id');
      if (error) throw error;
      if (data?.length !== 1) throw new Error('Un lot a fost modificat de alt utilizator.');
      cleared++;
    }
    if ((await readCurrentStock()).length) throw new Error('Au apărut restocări noi între timp.');
    for (let i = 0; i < staged.length; i += 50) {
      const batch = staged.slice(i, i + 50);
      const { data, error } = await supabase.from('productie_restocari').update({ status: 'disponibil' })
        .in('id', batch.map(row => row.id)).eq('status', 'redistribuit').select('id');
      if (error) throw error;
      if (data?.length !== batch.length) throw new Error('Activarea nu a fost confirmată complet.');
    }
    const actual = await readCurrentStock();
    if (actual.length !== staged.length || staged.some(row => !actual.some(lot => lot.id === row.id && Number(lot.cantitate_surplus) === row.cantitate_surplus))) {
      throw new Error('Cantitățile salvate nu corespund verificării finale.');
    }
  } catch (error) {
    throw new Error(`Operație oprită: ${cleared}/${previous.length} loturi vechi golite. Verifică restocul înainte de o nouă reglare. ${error instanceof Error ? error.message : ''}`);
  }
}