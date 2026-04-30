import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Restocking {
  id: string;
  produs_id: string;
  cantitate_surplus: number;
  data_productie: string;
  status: string;
  comanda_originala_id: string;
  created_at: string;
  updated_at: string;
  productie_produse?: {
    nume: string;
    unitate_masura: string;
  };
  productie_comenzi?: {
    numar_comanda: string;
    magazin: string;
    punct_livrare: string;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  supplier?: string;
  receipt_date: string;
}

export const useRestockings = () => {
  return useQuery({
    queryKey: ['restockings'],
    queryFn: async () => {
      console.log('🔍 Se încarcă restocările...');
      const { data, error } = await supabase
        .from('productie_restocari')
        .select(`
          *,
          productie_produse (nume, unitate_masura),
          productie_comenzi (numar_comanda, magazin, punct_livrare)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Eroare la încărcarea restocărilor:', error);
        throw error;
      }

      console.log('✅ Restocări încărcate:', data?.length || 0, 'înregistrări');
      return data as Restocking[];
    }
  });
};

export const useCreateRestocking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (restocking: {
      produs_id: string;
      cantitate_surplus: number;
      data_productie: string;
      comanda_originala_id?: string;
    }) => {
      console.log('➕ Creez restocată nouă:', restocking);
      
      const { data, error } = await supabase
        .from('productie_restocari')
        .insert([{
          ...restocking,
          status: 'disponibil'
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Eroare la crearea restocării:', error);
        throw error;
      }

      console.log('✅ Restocată creată cu succes:', data);
      
      // Redistribuire automată dezactivată - restocarea rămâne disponibilă
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restockings'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      toast.success('Restocată creată cu succes');
    },
    onError: (error) => {
      console.error('❌ Eroare la crearea restocării:', error);
      toast.error('Nu s-a putut crea restocarea');
    }
  });
};

export const useAutoRedistribute = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (restockingId: string) => {
      console.log('🔄 ÎNCEPUT REDISTRIBUIRE MANUALĂ pentru restocată:', restockingId);
      
      // Obține detaliile restocării
      const { data: restocking, error: restockingError } = await supabase
        .from('productie_restocari')
        .select('*')
        .eq('id', restockingId)
        .single();

      if (restockingError) {
        console.error('❌ Eroare la obținerea restocării:', restockingError);
        throw new Error(`Nu s-a putut găsi restocarea: ${restockingError.message}`);
      }

      console.log('📦 Restocată găsită pentru redistribuire:', {
        id: restocking.id,
        cantitate_surplus: restocking.cantitate_surplus,
        produs_id: restocking.produs_id,
        status: restocking.status
      });

      // Verifică dacă restocarea mai este disponibilă
      if (restocking.status !== 'disponibil') {
        throw new Error('Restocarea nu mai este disponibilă pentru redistribuire');
      }

      // Găsește comenzile care pot beneficia de redistribuire
      const { data: availableOrders, error: ordersError } = await supabase
        .from('productie_comenzi')
        .select('*')
        .eq('produs_id', restocking.produs_id)
        .in('status', ['pending', 'assigned', 'in_progress', 'partial'])
        .order('created_at', { ascending: true });

      if (ordersError) {
        console.error('❌ Eroare la căutarea comenzilor disponibile:', ordersError);
        throw new Error(`Nu s-au putut găsi comenzile: ${ordersError.message}`);
      }

      console.log('📋 Comenzi disponibile găsite:', availableOrders?.length || 0);

      if (!availableOrders || availableOrders.length === 0) {
        throw new Error('Nu există comenzi disponibile pentru redistribuire pentru acest produs');
      }

      // Filtrează comenzile care au nevoie efectiv de cantitate
      const ordersThatNeedQuantity = availableOrders.filter(order => {
        const cantitateNecesara = order.cantitate;
        const cantitateRealaProadusa = order.cantitate_reala_produsa || 0;
        const cantitatedinRestock = order.cantitate_din_restock || 0;
        const cantitateAcoperita = cantitateRealaProadusa + cantitatedinRestock;
        
        console.log(`🔍 Verificare comandă ${order.numar_comanda}:`, {
          cantitate_necesara: cantitateNecesara,
          cantitate_reala_produsa: cantitateRealaProadusa,
          cantitate_din_restock: cantitatedinRestock,
          cantitate_acoperita: cantitateAcoperita,
          are_nevoie: cantitateAcoperita < cantitateNecesara
        });
        
        return cantitateAcoperita < cantitateNecesara;
      });

      if (ordersThatNeedQuantity.length === 0) {
        throw new Error('Toate comenzile pentru acest produs sunt deja acoperite complet');
      }

      console.log('🎯 Comenzi care au nevoie de cantitate:', ordersThatNeedQuantity.length);

      let cantitateRamasaDistribuire = restocking.cantitate_surplus;
      const updates = [];
      const completedOrders = [];

      // Distribuie pe comenzile care au nevoie
      for (const order of ordersThatNeedQuantity) {
        if (cantitateRamasaDistribuire <= 0) break;

        const cantitateRealaProadusa = order.cantitate_reala_produsa || 0;
        const cantitatedinRestockVeche = order.cantitate_din_restock || 0;
        const cantitateAcoperitaActual = cantitateRealaProadusa + cantitatedinRestockVeche;
        const cantitateNecesara = order.cantitate - cantitateAcoperitaActual;
        
        if (cantitateNecesara > 0) {
          const cantitateDeDistribuit = Math.min(cantitateNecesara, cantitateRamasaDistribuire);
          const nouaCantitateRestock = cantitatedinRestockVeche + cantitateDeDistribuit;

          updates.push({
            id: order.id,
            cantitate_din_restock: nouaCantitateRestock,
            numar_comanda: order.numar_comanda
          });

          cantitateRamasaDistribuire -= cantitateDeDistribuit;
          
          console.log(`📊 Distribui ${cantitateDeDistribuit} la comanda ${order.numar_comanda}`);
          console.log(`   - Cantitate din restock veche: ${cantitatedinRestockVeche}`);
          console.log(`   - Cantitate din restock nouă: ${nouaCantitateRestock}`);
          console.log(`   - Cantitate rămasă de distribuit: ${cantitateRamasaDistribuire}`);

          // Verifică dacă comanda devine completă prin restocări
          const cantitateAcoperitaNoua = cantitateRealaProadusa + nouaCantitateRestock;
          
          if (cantitateAcoperitaNoua >= order.cantitate) {
            console.log(`✅ Comanda ${order.numar_comanda} devine completă prin restocări`);
            completedOrders.push(order.id);
          }
        }
      }

      if (updates.length === 0) {
        throw new Error('Nu s-a putut redistribui nimic - toate comenzile sunt deja acoperite');
      }

      // Execută update-urile pentru comenzi
      for (const update of updates) {
        const isCompleted = completedOrders.includes(update.id);
        const updateData: any = { 
          cantitate_din_restock: update.cantitate_din_restock,
          updated_at: new Date().toISOString()
        };
        
        // Dacă comanda devine completă, actualizează și statusul
        if (isCompleted) {
          updateData.status = 'completed';
          console.log(`🎯 Marcăm comanda ${update.numar_comanda} ca finalizată`);
        }

        const { error: updateError } = await supabase
          .from('productie_comenzi')
          .update(updateData)
          .eq('id', update.id);

        if (updateError) {
          console.error('❌ Eroare la actualizarea comenzii:', updateError);
          throw new Error(`Nu s-a putut actualiza comanda: ${updateError.message}`);
        }
        
        console.log(`✅ Comandă actualizată: ${update.numar_comanda}`);
      }

      // Actualizează restocarea
      const newStatus = cantitateRamasaDistribuire === 0 ? 'redistribuit' : 'disponibil';
      const updateRestockingData: any = { 
        updated_at: new Date().toISOString()
      };
      
      if (cantitateRamasaDistribuire === 0) {
        updateRestockingData.status = 'redistribuit';
        updateRestockingData.cantitate_surplus = 0;
        console.log('✅ Restocarea complet redistribuită');
      } else {
        updateRestockingData.cantitate_surplus = cantitateRamasaDistribuire;
        console.log(`ℹ️ Restocarea parțial redistribuită, rămân ${cantitateRamasaDistribuire} bucăți`);
      }

      const { error: updateRestockingError } = await supabase
        .from('productie_restocari')
        .update(updateRestockingData)
        .eq('id', restockingId);

      if (updateRestockingError) {
        console.error('❌ Eroare la actualizarea restocării:', updateRestockingError);
        throw new Error(`Nu s-a putut actualiza restocarea: ${updateRestockingError.message}`);
      }

      console.log('🏁 REDISTRIBUIRE MANUALĂ FINALIZATĂ CU SUCCES');
      return { 
        distributed: restocking.cantitate_surplus - cantitateRamasaDistribuire,
        completedOrders: completedOrders.length,
        remaining: cantitateRamasaDistribuire
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['restockings'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      
      if (data.completedOrders > 0) {
        toast.success(`Redistribuire completă! ${data.distributed} bucăți redistribuite, ${data.completedOrders} comenzi finalizate.`);
      } else {
        toast.success(`Redistribuire completă! ${data.distributed} bucăți redistribuite.`);
      }
      
      if (data.remaining > 0) {
        toast.info(`Au rămas ${data.remaining} bucăți nedistribuite.`);
      }
    },
    onError: (error) => {
      console.error('❌ Eroare la redistribuire:', error);
      toast.error(`Nu s-a putut redistribui: ${error.message}`);
    }
  });
};

export const useAdjustRestockingQuantity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      restockingId, 
      cantitateProblematica, 
      motiv 
    }: { 
      restockingId: string; 
      cantitateProblematica: number; 
      motiv: string;
    }) => {
      console.log('🔧 Ajustez cantitatea restocării:', restockingId, 'cu probleme:', cantitateProblematica);
      
      // Obține restocarea curentă - CORECTEZ QUERY-UL
      const { data: restocking, error: restockingError } = await supabase
        .from('productie_restocari')
        .select(`
          *,
          productie_comenzi (*)
        `)
        .eq('id', restockingId)
        .single();

      if (restockingError) {
        console.error('❌ Eroare la obținerea restocării:', restockingError);
        throw new Error(`Nu s-a putut găsi restocarea: ${restockingError.message}`);
      }

      console.log('📦 Restocată găsită:', restocking);

      const cantitateNoua = restocking.cantitate_surplus - cantitateProblematica;
      console.log('📊 Cantitatea nouă calculată:', cantitateNoua);

      if (cantitateNoua <= 0) {
        console.log('🗑️ Cantitatea devine 0 sau negativă - șterg restocarea');
        
        // Șterge restocarea
        const { error: deleteError } = await supabase
          .from('productie_restocari')
          .delete()
          .eq('id', restockingId);

        if (deleteError) {
          console.error('❌ Eroare la ștergerea restocării:', deleteError);
          throw new Error(`Nu s-a putut șterge restocarea: ${deleteError.message}`);
        }

        console.log('✅ Restocată ștearsă cu succes');
      } else {
        console.log('🔄 Actualizez cantitatea restocării la:', cantitateNoua);
        
        // Actualizează cantitatea
        const { error: updateError } = await supabase
          .from('productie_restocari')
          .update({ 
            cantitate_surplus: cantitateNoua,
            updated_at: new Date().toISOString()
          })
          .eq('id', restockingId);

        if (updateError) {
          console.error('❌ Eroare la actualizarea restocării:', updateError);
          throw new Error(`Nu s-a putut actualiza restocarea: ${updateError.message}`);
        }

        console.log('✅ Restocată actualizată cu succes');
      }

      // IMPORTANT: Actualizează și cantitatea reală produsă în comandă
      if (restocking.productie_comenzi && restocking.comanda_originala_id) {
        const comandaOriginala = restocking.productie_comenzi;
        const cantitateRealaVeche = comandaOriginala.cantitate_reala_produsa || 0;
        const cantitateRealaNoua = cantitateRealaVeche - cantitateProblematica;
        
        console.log('🔄 Actualizez cantitatea reală produsă în comandă de la', cantitateRealaVeche, 'la', cantitateRealaNoua);
        
        const { error: updateOrderError } = await supabase
          .from('productie_comenzi')
          .update({ 
            cantitate_reala_produsa: Math.max(0, cantitateRealaNoua),
            updated_at: new Date().toISOString()
          })
          .eq('id', restocking.comanda_originala_id);

        if (updateOrderError) {
          console.error('❌ Eroare la actualizarea comenzii:', updateOrderError);
          throw new Error(`Nu s-a putut actualiza comanda: ${updateOrderError.message}`);
        }

        console.log('✅ Comandă actualizată cu succes');
      }

      console.log('🎉 Ajustarea cantității finalizată cu succes');
      return { success: true, cantitateNoua, cantitateProblematica };
    },
    onSuccess: (data) => {
      console.log('🔄 Invalidez cache-ul după ajustarea cantității...');
      
      // Invalidează cache-ul pentru toate datele relevante
      queryClient.invalidateQueries({ queryKey: ['restockings'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      
      // Forțează refresh-ul imediat
      queryClient.refetchQueries({ queryKey: ['restockings'] });
      queryClient.refetchQueries({ queryKey: ['orders'] });
      
      console.log('✅ Cache invalidat și actualizat');
      
      if (data.cantitateNoua <= 0) {
        toast.success(`Restocarea a fost ștearsă - toate produsele (${data.cantitateProblematica} bucăți) au fost marcate ca problematice.`);
      } else {
        toast.success(`Au fost eliminate ${data.cantitateProblematica} bucăți cu probleme. Cantitatea rămasă: ${data.cantitateNoua} bucăți.`);
      }
    },
    onError: (error) => {
      console.error('❌ Eroare completă la ajustarea cantității:', error);
      toast.error(`Nu s-a putut ajusta cantitatea: ${error.message}`);
    }
  });
};

export const useInventoryStock = () => {
  return useQuery({
    queryKey: ['inventory-stock'],
    queryFn: async () => {
      console.log('🔍 Se încarcă stocurile...');
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Eroare la încărcarea stocurilor:', error);
        throw error;
      }

      console.log('✅ Stocuri încărcate:', data?.length || 0, 'înregistrări');
      return data as InventoryItem[];
    }
  });
};

// Funcție helper pentru redistribuirea automată - ACTUALIZATĂ
const tryAutoRedistribution = async (restockingId: string, produsId: string, cantitateDisponibila: number) => {
  console.log('🔄 ÎNCEPUT REDISTRIBUIRE AUTOMATĂ pentru:', { restockingId, produsId, cantitateDisponibila });
  
  // Caută comenzi care au nevoie de cantitate pentru același produs
  const { data: comenziDisponibile } = await supabase
    .from('productie_comenzi')
    .select('*')
    .eq('produs_id', produsId)
    .in('status', ['pending', 'assigned', 'in_progress', 'partial'])
    .order('created_at');
  
  if (!comenziDisponibile || comenziDisponibile.length === 0) {
    console.log('ℹ️ Nu există comenzi disponibile pentru redistribuire automată');
    return;
  }
  
  // Filtrează comenzile care au nevoie efectiv de cantitate 
  const ordersThatNeedQuantity = comenziDisponibile.filter(order => {
    const cantitateNecesara = order.cantitate;
    const cantitateRealaProadusa = order.cantitate_reala_produsa || 0;
    const cantitatedinRestock = order.cantitate_din_restock || 0;
    const cantitateAcoperita = cantitateRealaProadusa + cantitatedinRestock;
    
    return cantitateAcoperita < cantitateNecesara;
  });

  if (ordersThatNeedQuantity.length === 0) {
    console.log('ℹ️ Toate comenzile sunt deja acoperite complet');
    return;
  }

  console.log(`🎯 Găsite ${ordersThatNeedQuantity.length} comenzi care au nevoie de cantitate`);
  
  let cantitateRamasa = cantitateDisponibila;
  let comenziModificate = 0;
  let comenziFinalizate = 0;
  
  for (const comanda of ordersThatNeedQuantity) {
    if (cantitateRamasa <= 0) break;
    
    const cantitateRealaProadusa = comanda.cantitate_reala_produsa || 0;
    const cantitatedinRestockVeche = comanda.cantitate_din_restock || 0;
    const cantitateAcoperitaActual = cantitateRealaProadusa + cantitatedinRestockVeche;
    const cantitateNecesara = comanda.cantitate - cantitateAcoperitaActual;
    
    if (cantitateNecesara > 0) {
      const cantitateDeDistribuit = Math.min(cantitateNecesara, cantitateRamasa);
      const nouaCantitateRestock = cantitatedinRestockVeche + cantitateDeDistribuit;
      
      // Verifică dacă comanda devine complet
      const cantitateAcoperitaNoua = cantitateRealaProadusa + nouaCantitateRestock;
      const statusNou = cantitateAcoperitaNoua >= comanda.cantitate ? 'completed' : comanda.status;
      
      const { error } = await supabase
        .from('productie_comenzi')
        .update({ 
          status: statusNou,
          cantitate_din_restock: nouaCantitateRestock,
          updated_at: new Date().toISOString()
        })
        .eq('id', comanda.id);
      
      if (!error) {
        cantitateRamasa -= cantitateDeDistribuit;
        comenziModificate++;
        
        if (statusNou === 'completed') {
          comenziFinalizate++;
          console.log(`✅ Comandă completată automat din restock: ${comanda.numar_comanda}`);
        }
        
        console.log(`📊 Distribuit automat ${cantitateDeDistribuit} la comanda ${comanda.numar_comanda}`);
      }
    }
  }
  
  // Actualizează statusul restocării
  if (comenziModificate > 0) {
    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (cantitateRamasa === 0) {
      updateData.status = 'redistribuit';
      console.log('✅ Restocarea complet redistribuită automat');
    } else {
      updateData.cantitate_surplus = cantitateRamasa;
      console.log(`ℹ️ Restocarea parțial redistribuită automat, rămân: ${cantitateRamasa} bucăți`);
    }
    
    await supabase
      .from('productie_restocari')
      .update(updateData)
      .eq('id', restockingId);
      
    console.log(`🎉 REDISTRIBUIRE AUTOMATĂ FINALIZATĂ: ${comenziModificate} comenzi modificate, ${comenziFinalizate} finalizate`);
  } else {
    console.log('ℹ️ Nu s-au putut redistribui produse automat');
  }
};
