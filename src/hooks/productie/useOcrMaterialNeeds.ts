 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { format } from "date-fns";
 
 export interface MaterialNeed {
   ingredient_id: string;
   ingredient_nume: string;
   unitate_masura: string;
   cantitate_necesara: number;
   stoc_inceput_zi: number;
   diferenta: number;
   status: 'ok' | 'atentie' | 'insuficient';
 }
 
 // Funcție pentru convertirea unităților la kg
 const convertToKg = (cantitate: number, unitate: string): number => {
   switch (unitate?.toLowerCase()) {
     case 'g':
     case 'gr':
     case 'grame':
       return cantitate / 1000;
     case 'kg':
     case 'kilograme':
       return cantitate;
     case 't':
     case 'tone':
       return cantitate * 1000;
     default:
       return cantitate; // Presupunem kg dacă nu știm
   }
 };
 
 export const useOcrMaterialNeeds = (date: Date) => {
   const dateStr = format(date, 'yyyy-MM-dd');
 
   // Fetch OCR orders for selected date
  const { data: ocrOrders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['ocr-orders-for-materials', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_ocr_comenzi')
        .select('produs_id, cantitate')
        .eq('data_comanda', dateStr);
      
      if (error) throw error;
      return data;
    },
    refetchOnMount: 'always',
    staleTime: 0,
  });
 
   // Fetch recipes with ingredients
   const { data: recipes, isLoading: isLoadingRecipes } = useQuery({
     queryKey: ['recipes-with-ingredients'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('productie_retete')
         .select(`
           produs_id,
           activa,
           productie_retete_ingrediente(
             ingredient_id,
             cantitate_necesara,
             unitate_masura,
             productie_ingrediente(id, nume, unitate_masura)
           )
         `)
         .eq('activa', true);
       
       if (error) throw error;
       return data;
     },
   });
 
   // Fetch daily stock snapshot for selected date
   const { data: stockSnapshot, isLoading: isLoadingStock } = useQuery({
     queryKey: ['daily-stock-snapshot', dateStr],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('daily_stock_snapshots')
         .select('*')
         .eq('snapshot_date', dateStr);
       
       if (error) throw error;
       return data;
     },
   });
 
   // Calculate material needs
   const materialNeeds: MaterialNeed[] = [];
 
   if (ocrOrders && recipes && stockSnapshot) {
     const ingredientsMap = new Map<string, {
       ingredient_id: string;
       ingredient_nume: string;
       unitate_masura: string;
       cantitate_necesara: number;
     }>();
 
     // Calculate required ingredients from OCR orders
     ocrOrders.forEach(order => {
       if (!order.produs_id) return;
 
       // Find active recipe for this product
       const productRecipe = recipes.find(r => r.produs_id === order.produs_id && r.activa);
       
       if (productRecipe?.productie_retete_ingrediente) {
         productRecipe.productie_retete_ingrediente.forEach((ing: any) => {
           const key = ing.ingredient_id;
           const requiredQty = (ing.cantitate_necesara || 0) * order.cantitate;
           const requiredQtyKg = convertToKg(requiredQty, ing.unitate_masura);
           
           if (ingredientsMap.has(key)) {
             const existing = ingredientsMap.get(key)!;
             existing.cantitate_necesara += requiredQtyKg;
           } else {
             ingredientsMap.set(key, {
               ingredient_id: ing.ingredient_id,
               ingredient_nume: ing.productie_ingrediente?.nume || 'Necunoscut',
               unitate_masura: 'kg',
               cantitate_necesara: requiredQtyKg,
             });
           }
         });
       }
     });
 
     // Calculate stock and difference
     ingredientsMap.forEach((ingredient) => {
       // Find stock for this ingredient by name matching
       const stockItems = stockSnapshot.filter(s => 
         s.name?.toLowerCase().includes(ingredient.ingredient_nume.toLowerCase())
       );
       
       const stocTotal = stockItems.reduce((sum, item) => {
         return sum + convertToKg(item.quantity || 0, item.unit || 'kg');
       }, 0);
 
       const diferenta = stocTotal - ingredient.cantitate_necesara;
       
       let status: 'ok' | 'atentie' | 'insuficient' = 'ok';
       if (diferenta < 0) {
         status = 'insuficient';
       } else if (diferenta < 20) {
         status = 'atentie';
       }
 
       materialNeeds.push({
         ingredient_id: ingredient.ingredient_id,
         ingredient_nume: ingredient.ingredient_nume,
         unitate_masura: ingredient.unitate_masura,
         cantitate_necesara: ingredient.cantitate_necesara,
         stoc_inceput_zi: stocTotal,
         diferenta,
         status,
       });
     });
   }
 
   // Sort by status (insuficient first, then atentie, then ok)
   materialNeeds.sort((a, b) => {
     const statusOrder = { insuficient: 0, atentie: 1, ok: 2 };
     return statusOrder[a.status] - statusOrder[b.status];
   });
 
   return {
     materialNeeds,
     isLoading: isLoadingOrders || isLoadingRecipes || isLoadingStock,
   };
 };