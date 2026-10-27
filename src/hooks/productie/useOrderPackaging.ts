import { useQuery } from '@tanstack/react-query';
import { supabaseCloud } from '@/integrations/supabase/cloudClient';
import type { StorePackaging } from '../../../supabase/functions/_shared/packagingRules';

export function useOrderPackaging() {
  return useQuery({
    queryKey: ['senior-store-packaging'],
    staleTime: 60_000,
    queryFn: async () => {
      const rows: StorePackaging[] = [];
      while (true) {
        const { data, error } = await supabaseCloud.from('productie_baxare_magazine')
          .select('*')
          .order('produs_id').order('magazin_key').range(rows.length, rows.length + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) return rows;
      }
    },
  });
}