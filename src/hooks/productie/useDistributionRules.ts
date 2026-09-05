
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DistributionRule {
  id: string;
  produs_id: string;
  linie_preferata_id: string;
  prioritate: number;
  created_at: string;
  updated_at: string;
  productie_linii?: {
    id: string;
    nume: string;
  };
}

// Hook pentru încărcarea tuturor regulilor de distribuire (produs -> linii)
export const useAllDistributionRules = () => {
  return useQuery({
    queryKey: ['distribution-rules', 'all'],
    queryFn: async () => {
      const all: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('productie_reguli_distribuire')
          .select(`*, productie_linii(id, nume)`)
          .order('prioritate')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return all as DistributionRule[];
    }
  });
};

// Hook pentru încărcarea regulilor de distribuire pentru un produs
export const useDistributionRulesByProduct = (productId: string) => {
  return useQuery({
    queryKey: ['distribution-rules', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_reguli_distribuire')
        .select(`
          *,
          productie_linii(id, nume)
        `)
        .eq('produs_id', productId)
        .order('prioritate');
      
      if (error) throw error;
      return data as DistributionRule[];
    },
    enabled: !!productId
  });
};

// Hook pentru crearea unei reguli de distribuire
export const useCreateDistributionRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ruleData: {
      produs_id: string;
      linie_preferata_id: string;
      prioritate: number;
    }) => {
      const { data, error } = await supabase
        .from('productie_reguli_distribuire')
        .insert([ruleData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-rules'] });
    }
  });
};

// Hook pentru ștergerea regulilor de distribuire pentru un produs
export const useDeleteDistributionRulesByProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('productie_reguli_distribuire')
        .delete()
        .eq('produs_id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-rules'] });
    }
  });
};
