
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useDirectOrderData = (orderId: string, shouldRefresh: boolean = false) => {
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDirectFromDB = async () => {
    if (!orderId) return;
    
    console.log('🔍 === CITIRE DIRECTĂ DIN DB ===');
    console.log('📊 Order ID:', orderId);
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('productie_comenzi')
        .select(`
          *,
          productie_produse (
            id,
            nume,
            unitate_masura
          ),
          productie_linii (
            id,
            nume
          )
        `)
        .eq('id', orderId)
        .single();
      
      if (error) {
        console.error('❌ Eroare la citire directă:', error);
        return;
      }
      
      console.log('✅ Date citite direct din DB:', {
        id: data.id,
        numar_comanda: data.numar_comanda,
        cantitate_comandata: data.cantitate,
        cantitate_reala_produsa: data.cantitate_reala_produsa,
        updated_at: data.updated_at
      });
      
      setOrderData(data);
    } catch (error) {
      console.error('💥 Eroare neașteptată:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectFromDB();
  }, [orderId, shouldRefresh]);

  return { orderData, isLoading, refetch: fetchDirectFromDB };
};
