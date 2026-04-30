
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useQuantityCorrection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      comandaId, 
      cantitateNoua, 
      cantitateVeche,
      produsId 
    }: { 
      comandaId: string; 
      cantitateNoua: number; 
      cantitateVeche: number;
      produsId: string;
    }) => {
      console.log('🚀 === ÎNCEPE CORECȚIA CANTITĂȚII ===');
      console.log('📊 Parametri:', { comandaId, cantitateVeche, cantitateNoua, diferenta: cantitateNoua - cantitateVeche });
      
      // Calculez noul status al comenzii
      const { data: comandaData, error: fetchError } = await supabase
        .from('productie_comenzi')
        .select('cantitate')
        .eq('id', comandaId)
        .single();
      
      if (fetchError) {
        console.error('❌ EROARE LA CITIRE COMANDĂ:', fetchError);
        throw new Error(`Eroare la citirea comenzii: ${fetchError.message}`);
      }
      
      const cantitateComandată = comandaData.cantitate;
      
      // LOGICA CORECTATĂ: Determin statusul nou bazat pe cantitatea reală vs comandată
      let newStatus = 'pending';
      if (cantitateNoua === 0) {
        newStatus = 'pending';
      } else if (cantitateNoua > 0 && cantitateNoua < cantitateComandată) {
        newStatus = 'in_progress';
      } else if (cantitateNoua >= cantitateComandată) {
        newStatus = 'completed';
      }
      
      console.log('📈 Status nou calculat:', {
        cantitateComandată,
        cantitateNoua,
        statusVechi: 'unknown',
        statusNou: newStatus,
        logica: `${cantitateNoua} vs ${cantitateComandată} => ${newStatus}`
      });
      
      // Update direct în baza de date cu statusul nou
      const { data: updateResult, error: updateError } = await supabase
        .from('productie_comenzi')
        .update({ 
          cantitate_reala_produsa: cantitateNoua,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', comandaId)
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
        .single();
      
      if (updateError) {
        console.error('❌ EROARE UPDATE:', updateError);
        throw new Error(`Eroare la actualizare: ${updateError.message}`);
      }
      
      console.log('✅ UPDATE EXECUTAT CU SUCCES:', {
        id: updateResult.id,
        cantitate_reala_produsa: updateResult.cantitate_reala_produsa,
        status: updateResult.status,
        cantitate_comandata: updateResult.cantitate,
        statusCalculat: newStatus,
        statusActualizat: updateResult.status
      });
      
      // GESTIONARE RESTOCĂRI - creează/actualizează surplus FĂRĂ redistribuire automată
      const esteComandeAvans = updateResult.magazin === 'PRODUCTIE_AVANS';
      
      if (esteComandeAvans && cantitateNoua > 0) {
        // Pentru comenzile de producție în avans, toată cantitatea devine restocată
        console.log('🎯 COMANDĂ AVANS - gestionez restocată pentru toată cantitatea:', cantitateNoua);
        
        // Verific dacă există deja o restocată pentru această comandă
        const { data: existingRestock, error: fetchRestockError } = await supabase
          .from('productie_restocari')
          .select('*')
          .eq('comanda_originala_id', comandaId)
          .maybeSingle();
        
        if (fetchRestockError) {
          console.error('❌ Eroare la verificare restocată existentă:', fetchRestockError);
        }
        
        if (existingRestock) {
          // Actualizez restocată existentă
          const { error: updateRestockError } = await supabase
            .from('productie_restocari')
            .update({
              cantitate_surplus: cantitateNoua,
              status: cantitateNoua > 0 ? 'disponibil' : 'epuizat'
            })
            .eq('id', existingRestock.id);
          
          if (updateRestockError) {
            console.error('❌ Eroare la actualizare restocată:', updateRestockError);
          } else {
            console.log('✅ Restocată actualizată pentru avans (FĂRĂ redistribuire automată):', cantitateNoua);
          }
        } else {
          // Creez restocată nouă FĂRĂ redistribuire automată
          const { error: insertRestockError } = await supabase
            .from('productie_restocari')
            .insert([{
              comanda_originala_id: comandaId,
              produs_id: produsId,
              cantitate_surplus: cantitateNoua,
              data_productie: new Date().toISOString().split('T')[0],
              status: 'disponibil'
            }]);
          
          if (insertRestockError) {
            console.error('❌ Eroare la creare restocată pentru avans:', insertRestockError);
          } else {
            console.log('✅ Restocată creată pentru avans (FĂRĂ redistribuire automată):', cantitateNoua);
          }
        }
      } else if (!esteComandeAvans && cantitateNoua > cantitateComandată) {
        // Pentru comenzile normale, doar surplus-ul devine restocată
        const surplus = cantitateNoua - cantitateComandată;
        console.log('🎯 SURPLUS DETECTAT pentru comandă normală:', surplus, 'bucăți');
        
        // Verific dacă există deja o restocată pentru această comandă
        const { data: existingRestock, error: fetchRestockError } = await supabase
          .from('productie_restocari')
          .select('*')
          .eq('comanda_originala_id', comandaId)
          .maybeSingle();
        
        if (fetchRestockError) {
          console.error('❌ Eroare la verificare restocată existentă:', fetchRestockError);
        }
        
        if (existingRestock) {
          // Actualizez restocată existentă
          const { error: updateRestockError } = await supabase
            .from('productie_restocari')
            .update({
              cantitate_surplus: surplus,
              status: surplus > 0 ? 'disponibil' : 'epuizat'
            })
            .eq('id', existingRestock.id);
          
          if (updateRestockError) {
            console.error('❌ Eroare la actualizare restocată:', updateRestockError);
          } else {
            console.log('✅ Restocată actualizată pentru surplus (FĂRĂ redistribuire automată):', surplus);
          }
        } else {
          // Creez restocată nouă FĂRĂ redistribuire automată
          const { error: insertRestockError } = await supabase
            .from('productie_restocari')
            .insert([{
              comanda_originala_id: comandaId,
              produs_id: produsId,
              cantitate_surplus: surplus,
              data_productie: new Date().toISOString().split('T')[0],
              status: 'disponibil'
            }]);
          
          if (insertRestockError) {
            console.error('❌ Eroare la creare restocată pentru surplus:', insertRestockError);
          } else {
            console.log('✅ Restocată creată pentru surplus (FĂRĂ redistribuire automată):', surplus);
          }
        }
      } else if (!esteComandeAvans && cantitateNoua <= cantitateComandată) {
        // Dacă nu mai există surplus, șterg restocată existentă (dacă există)
        console.log('ℹ️ Nu există surplus - verific dacă trebuie să șterg restocată existentă');
        
        const { error: deleteRestockError } = await supabase
          .from('productie_restocari')
          .delete()
          .eq('comanda_originala_id', comandaId);
        
        if (deleteRestockError) {
          console.error('⚠️ Eroare la ștergere restocată (poate nu exista):', deleteRestockError);
        } else {
          console.log('✅ Restocată ștearsă (dacă exista)');
        }
      }
      
      return { 
        success: true, 
        cantitateNoua, 
        cantitateVeche, 
        comandaId, 
        updateResult,
        statusNou: newStatus
      };
    },
    onSuccess: async (data) => {
      console.log('🎯 === MUTAȚIA A REUȘIT ===');
      console.log(`✅ CORECȚIE FINALIZATĂ: ${data.cantitateVeche} → ${data.cantitateNoua} (Status: ${data.statusNou})`);
      
      // STRATEGIA NOUĂ: Actualizează direct cache-ul cu noile date
      console.log('🔄 ACTUALIZARE DIRECTĂ CACHE...');
      
      // 1. Actualizează toate query-urile care conțin comenzi
      const queryKeys = [
        ['orders'],
        ['production-orders'], 
        ['productie-comenzi'],
        ['work-sessions'],
        ['lines'],
        ['products']
      ];
      
      // 2. Pentru fiecare query key, actualizează cache-ul direct
      queryKeys.forEach(key => {
        queryClient.setQueryData(key, (oldData: any) => {
          if (!oldData) return oldData;
          
          // Dacă este array de comenzi, actualizează comanda specifică
          if (Array.isArray(oldData)) {
            return oldData.map((item: any) => {
              if (item.id === data.comandaId) {
                console.log(`🎯 ACTUALIZEZ ITEM ${item.id}:`, {
                  cantitate_reala_veche: item.cantitate_reala_produsa,
                  cantitate_reala_noua: data.cantitateNoua,
                  status_vechi: item.status,
                  status_nou: data.statusNou
                });
                return {
                  ...item,
                  cantitate_reala_produsa: data.cantitateNoua,
                  status: data.statusNou,
                  updated_at: new Date().toISOString()
                };
              }
              return item;
            });
          }
          
          return oldData;
        });
      });
      
      // 3. Invalidează și query-ul pentru restocări
      queryClient.invalidateQueries({ queryKey: ['restockings'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata'] });
      
      // 4. Forțează re-fetch pentru siguranță
      setTimeout(() => {
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
        queryClient.invalidateQueries({ queryKey: ['restockings'] });
        queryClient.invalidateQueries({ queryKey: ['marfa-restocata'] });
      }, 100);
      
      // 4. Dispatch global event pentru componente care nu folosesc aceste query-uri
      console.log('📡 DISPATCH GLOBAL EVENT...');
      window.dispatchEvent(new CustomEvent('quantity-corrected', { 
        detail: { 
          comandaId: data.comandaId, 
          cantitateNoua: data.cantitateNoua,
          statusNou: data.statusNou,
          timestamp: Date.now()
        } 
      }));
      
      // 5. Storage event pentru cross-tab communication
      localStorage.setItem('quantity-correction-trigger', JSON.stringify({
        comandaId: data.comandaId,
        cantitateNoua: data.cantitateNoua,
        statusNou: data.statusNou,
        timestamp: Date.now()
      }));
      
      console.log('✅ TOATE STRATEGIILE DE ACTUALIZARE CACHE EXECUTATE');
      
      const statusMessage = data.statusNou === 'completed' ? 'finalizată' : 
                           data.statusNou === 'in_progress' ? 'în progres' : 'pending';
      
      toast.success(`Cantitatea actualizată: ${data.cantitateVeche} → ${data.cantitateNoua}! Status: ${statusMessage}`);
    },
    onError: (error) => {
      console.error('❌ MUTAȚIA A EȘUAT:', error);
      toast.error(`Eroare: ${error.message}`);
    }
  });
};
