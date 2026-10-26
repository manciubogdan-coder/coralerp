
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readAll } from '../../../supabase/functions/_shared/productRecipes';

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
      const data = await readAll(supabase, 'productie_retete', `
          *,
          productie_produse!inner(id, nume),
          productie_retete_ingrediente(
            *,
            productie_ingrediente(id, nume, unitate_masura)
          )
        `);
      console.log('Recipes fetched:', data);
      return (data as ProductieRetetaCompleta[]).sort((a, b) => a.nume_reteta.localeCompare(b.nume_reteta));
    }
  });
};

// Hook pentru încărcarea rețetelor pentru un produs specific
export const useRecipesByProduct = (productId: string) => {
  return useQuery({
    queryKey: ['recipes', productId],
    queryFn: async () => {
      const data = await readAll({ from: (table: string) => ({ select: (select: string) => supabase.from(table).select(select).eq('produs_id', productId) }) }, 'productie_retete', `
          *,
          productie_retete_ingrediente(
            *,
            productie_ingrediente(id, nume, unitate_masura)
          )
        `);
      return (data as ProductieRetetaCompleta[]).sort((a, b) => Number(b.activa) - Number(a.activa) || b.versiune - a.versiune);
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
        
        if (ingredientsError) {
          const { error: cleanupError } = await supabase.from('productie_retete').delete().eq('id', recipe.id);
          throw new Error(`Ingredientele nu s-au salvat: ${ingredientsError.message}${cleanupError ? '. Rețeta goală a rămas; reîncearcă din editare.' : ''}`);
        }
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

      // Preserve existing ingredient rows rather than deleting the entire recipe first.
      if (ingrediente) {
        const existing = await readAll({ from: (table: string) => ({ select: (select: string) => supabase.from(table).select(select).eq('reteta_id', id) }) }, 'productie_retete_ingrediente');
        const remaining = [...existing];
        for (const ing of ingrediente) {
          const index = remaining.findIndex(row => row.ingredient_id === ing.ingredient_id);
          const row = index >= 0 ? remaining.splice(index, 1)[0] : null;
          const values = { ingredient_id: ing.ingredient_id, cantitate_necesara: ing.cantitate_necesara, unitate_masura: ing.unitate_masura, observatii: ing.observatii ?? '' };
          const { error: saveError } = row
            ? await supabase.from('productie_retete_ingrediente').update(values).eq('id', row.id)
            : await supabase.from('productie_retete_ingrediente').insert({ ...values, reteta_id: id });
          if (saveError) throw new Error(`Ingredientele nu s-au salvat: ${saveError.message}`);
        }
        for (const row of remaining) {
          const { error: deleteError } = await supabase.from('productie_retete_ingrediente').delete().eq('id', row.id);
          if (deleteError) throw new Error(`Ingredientul nu poate fi eliminat: ${deleteError.message}`);
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
