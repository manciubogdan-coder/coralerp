
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductieComanda } from "./useProductionData";

// Hook dedicat pentru rapoarte care include TOATE comenzile (inclusiv finalizate)
export const useOrdersForReports = () => {
  return useQuery({
    queryKey: ['orders-for-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_comenzi')
        .select(`
          *,
          productie_produse(id, nume, unitate_masura, created_at, updated_at),
          productie_linii(id, nume)
        `)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Găsim clientul pentru fiecare comandă bazat pe magazin și punct_livrare
      const comandiCuClienti = await Promise.all(data.map(async (comanda) => {
        const { data: client } = await supabase
          .from('productie_clienti')
          .select(`
            *,
            productie_zone_livrare(*)
          `)
          .eq('nume_magazin', comanda.magazin)
          .eq('punct_livrare', comanda.punct_livrare)
          .single();
        
        // Calculăm cantitatea reală produsă din sesiunile de lucru
        const { data: sesiuni } = await supabase
          .from('productie_sesiuni_lucru')
          .select('cantitate_produsa')
          .eq('comanda_id', comanda.id)
          .in('status', ['finalizata', 'partial']);
        
        const cantitateRealaProadusa = sesiuni?.reduce((total, sesiune) => 
          total + (sesiune.cantitate_produsa || 0), 0) || 0;
        
        return {
          ...comanda,
          productie_clienti: client,
          cantitate_reala_produsa: cantitateRealaProadusa
        };
      }));
      
      // Sortăm comenzile după prioritatea zonei de livrare, apoi după data actualizării
      const sortedData = comandiCuClienti.sort((a, b) => {
        // Primul criteriu: updated_at descendent (cel mai recent modificat primul)
        const dateComparison = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        if (dateComparison !== 0) return dateComparison;
        
        // Al doilea criteriu: prioritatea zonei de livrare
        const priorityA = a.productie_clienti?.productie_zone_livrare?.prioritate || 999;
        const priorityB = b.productie_clienti?.productie_zone_livrare?.prioritate || 999;
        return priorityA - priorityB;
      });
      
      return sortedData as ProductieComanda[];
    }
  });
};
