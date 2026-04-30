
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductieIngredient {
  id: string;
  nume: string;
  descriere?: string;
  unitate_masura: string;
  created_at: string;
  updated_at: string;
}

// Hook pentru încărcarea ingredientelor
export const useIngredients = () => {
  return useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => {
      console.log('Fetching ingredients from database...');
      const { data, error } = await supabase
        .from('productie_ingrediente')
        .select('*')
        .order('nume');
      
      if (error) {
        console.error('Error fetching ingredients:', error);
        throw error;
      }
      console.log('Ingredients fetched:', data);
      return data as ProductieIngredient[];
    }
  });
};

// Hook pentru crearea unui ingredient nou
export const useCreateIngredient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ingredientData: {
      nume: string;
      descriere?: string;
      unitate_masura: string;
    }) => {
      const { data, error } = await supabase
        .from('productie_ingrediente')
        .insert([ingredientData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    }
  });
};

// Hook pentru actualizarea unui ingredient
export const useUpdateIngredient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductieIngredient> }) => {
      const { data, error } = await supabase
        .from('productie_ingrediente')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    }
  });
};

// Hook pentru ștergerea unui ingredient
export const useDeleteIngredient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productie_ingrediente')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    }
  });
};
