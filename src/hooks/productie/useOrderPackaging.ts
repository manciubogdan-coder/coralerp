import { useQuery } from '@tanstack/react-query';
import { supabaseCloud } from '@/integrations/supabase/cloudClient';
import type { PackagingMethod } from '@/lib/productie/orderPackaging';

export function useOrderPackaging() {
  return useQuery({
    queryKey: ['order-packaging-methods'],
    staleTime: 60_000,
    queryFn: async () => {
      const rows: PackagingMethod[] = [];
      while (true) {
        const { data, error } = await supabaseCloud.from('packaging_methods')
          .select('client_name,product_name,weight,units_per_case,tertiary_packaging')
          .order('id').range(rows.length, rows.length + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) return rows;
      }
    },
  });
}