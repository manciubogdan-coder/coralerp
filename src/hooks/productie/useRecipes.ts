
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductieReteta {
  id: string;
  produs_id: string;
  nume_reteta: string;
  descriere?: string;
  versiune: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductieRetetaIngredient {
  id: string;
  reteta_id: string;
  ingredient_id: string;
  cantitate_necesara: number;
  unitate_masura: string;
  observatii?: string;
  created_at: string;
  productie_ingrediente?: {
    id: string;
    nume: string;
    unitate_masura: string;
  };
}

export interface ProductieRetetaCompleta extends ProductieReteta {
  productie_retete_ingrediente?: ProductieRetetaIngredient[];
  productie_produse?: {
    id: string;
    nume: string;
  };
}

// Hook pentru încărcarea rețetelor
export const useRecipes = () => {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: async () => {
      console.log('Fetching recipes from database...');
      const { data, error } = await supabase
        .from('productie_retete')
        .select(`
          *,
          productie_produse!inner(id, nume),
          productie_retete_ingrediente(
            *,
            productie_ingrediente(id, nume, unitate_masura)
          )
        `)
        .order('nume_reteta');
      
      if (error) {
        console.error('Error fetching recipes:', error);
        throw error;
      }
      console.log('Recipes fetched:', data);
      return data as ProductieRetetaCompleta[];
    }
  });
};

// Hook pentru încărcarea rețetelor pentru un produs specific
export const useRecipesByProduct = (productId: string) => {
  return useQuery({
    queryKey: ['recipes', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_retete')
        .select(`
          *,
          productie_retete_ingrediente(
            *,
            productie_ingrediente(id, nume, unitate_masura)
          )
        `)
        .eq('produs_id', productId)
        .order('versiune', { ascending: false });
      
      if (error) throw error;
      return data as ProductieRetetaCompleta[];
    },
    enabled: !!productId
  });
};

// Hook pentru crearea unei rețete noi
export const useCreateRecipe = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (recipeData: {
      produs_id: string;
      nume_reteta: string;
      descriere?: string;
      ingrediente: {
        ingredient_id: string;
        cantitate_necesara: number;
        unitate_masura: string;
        observatii?: string;
      }[];
    }) => {
      // Creează rețeta
      const { data: recipe, error: recipeError } = await supabase
        .from('productie_retete')
        .insert([{
          produs_id: recipeData.produs_id,
          nume_reteta: recipeData.nume_reteta,
          descriere: recipeData.descriere
        }])
        .select()
        .single();
      
      if (recipeError) throw recipeError;

      // Adaugă ingredientele
      if (recipeData.ingrediente.length > 0) {
        const ingredientData = recipeData.ingrediente.map(ing => ({
          reteta_id: recipe.id,
          ingredient_id: ing.ingredient_id,
          cantitate_necesara: ing.cantitate_necesara,
          unitate_masura: ing.unitate_masura,
          observatii: ing.observatii
        }));

        const { error: ingredientsError } = await supabase
          .from('productie_retete_ingrediente')
          .insert(ingredientData);
        
        if (ingredientsError) throw ingredientsError;
      }

      return recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    }
  });
};

// Hook pentru actualizarea unei rețete
export const useUpdateRecipe = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      updates, 
      ingrediente 
    }: { 
      id: string; 
      updates: Partial<ProductieReteta>;
      ingrediente?: {
        ingredient_id: string;
        cantitate_necesara: number;
        unitate_masura: string;
        observatii?: string;
      }[];
    }) => {
      // Actualizează rețeta
      const { data, error } = await supabase
        .from('productie_retete')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Dacă sunt specificate ingrediente, le actualizează
      if (ingrediente) {
        // Șterge ingredientele existente
        await supabase
          .from('productie_retete_ingrediente')
          .delete()
          .eq('reteta_id', id);

        // Adaugă ingredientele noi
        if (ingrediente.length > 0) {
          const ingredientData = ingrediente.map(ing => ({
            reteta_id: id,
            ingredient_id: ing.ingredient_id,
            cantitate_necesara: ing.cantitate_necesara,
            unitate_masura: ing.unitate_masura,
            observatii: ing.observatii
          }));

          const { error: ingredientsError } = await supabase
            .from('productie_retete_ingrediente')
            .insert(ingredientData);
          
          if (ingredientsError) throw ingredientsError;
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    }
  });
};

// Hook pentru ștergerea unei rețete
export const useDeleteRecipe = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productie_retete')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    }
  });
};
