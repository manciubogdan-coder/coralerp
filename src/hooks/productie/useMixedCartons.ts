import { useQuery } from '@tanstack/react-query';
import { supabaseCloud } from '@/integrations/supabase/cloudClient';
import type { MixedCarton } from '../../../supabase/functions/_shared/mixedCartons';
export async function loadMixedCartons(): Promise<MixedCarton[]> {
  const out: MixedCarton[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseCloud.from('productie_baxuri_mixte').select('*').order('produs_id').range(offset, offset + 999);
    if (error) throw error;
    out.push(...(data ?? []) as MixedCarton[]);
    if (!data || data.length < 1000) return out;
  }
}
export const useMixedCartons = () => useQuery({ queryKey: ['mixed-cartons'], queryFn: loadMixedCartons });