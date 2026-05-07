import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Types pentru datele de producție
export interface ProductieLinie {
  id: string;
  nume: string;
  capacitate_ora: number;
  status: 'activa' | 'inactiva' | 'mentenanta';
  created_at: string;
  updated_at: string;
}

export interface ProductieProds {
  id: string;
  nume: string;
  descriere?: string;
  unitate_masura: string;
  created_at: string;
  updated_at: string;
}

export interface ProductieZonaLivrare {
  id: string;
  nume_zona: string;
  descriere?: string;
  prioritate: number;
  culoare: string;
  ora_limita_plecare?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductieClient {
  id: string;
  nume_magazin: string;
  punct_livrare: string;
  adresa?: string;
  telefon?: string;
  email?: string;
  zona_livrare_id?: string;
  created_at: string;
  updated_at: string;
  productie_zone_livrare?: ProductieZonaLivrare;
}

// Tipuri specifice pentru query-uri - reflectă datele reale returnate
export interface ProductieLiniePartial {
  id: string;
  nume: string;
}

export interface ProductieComanda {
  id: string;
  numar_comanda: string;
  magazin: string;
  punct_livrare: string;
  produs_id: string;
  cantitate: number;
  baxare?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'partial' | 'completed';
  linie_id?: string;
  created_at: string;
  updated_at: string;
  cantitate_din_restock?: number;
  cantitate_reala_produsa?: number; // Added this property
  cantitate_produsa_sesiuni?: number;
  cantitate_surplus_produsa?: number;
  productie_produse?: ProductieProds;
  productie_linii?: ProductieLiniePartial;
  productie_clienti?: ProductieClient;
}

export interface ProductieSesiuneLucru {
  id: string;
  comanda_id: string;
  linie_id: string;
  nume_operator: string;
  numar_angajati: number;
  ora_start: string;
  ora_sfarsit?: string;
  cantitate_produsa?: number;
  status: 'activa' | 'finalizata' | 'partial';
  created_at: string;
  updated_at: string;
}

// Hook pentru încărcarea liniilor de producție
export const useProductionLines = () => {
  return useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_linii')
        .select('*')
        .order('nume');
      
      if (error) throw error;
      return data as ProductieLinie[];
    }
  });
};

// Hook pentru crearea unei linii noi
export const useCreateLine = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (lineData: {
      nume: string;
      capacitate_ora: number;
      status: 'activa' | 'inactiva' | 'mentenanta';
    }) => {
      const { data, error } = await supabase
        .from('productie_linii')
        .insert([lineData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
    }
  });
};

// Hook pentru actualizarea unei linii
export const useUpdateLine = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductieLinie> }) => {
      const { data, error } = await supabase
        .from('productie_linii')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
    }
  });
};

// Hook pentru ștergerea unei linii
export const useDeleteLine = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productie_linii')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
    }
  });
};

// Hook pentru distribuirea automată a comenzii pe linie
export const useAutoDistributeToLine = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (comandaId: string) => {
      console.log('🔄 Încep distribuirea automată pentru comanda:', comandaId);
      
      // Obține detaliile comenzii
      const { data: comanda, error: comandaError } = await supabase
        .from('productie_comenzi')
        .select(`
          *,
          productie_produse(*)
        `)
        .eq('id', comandaId)
        .single();
      
      if (comandaError) throw comandaError;
      
      console.log('📋 Detalii comandă pentru distribuire:', comanda);
      
      // Caută o regulă de distribuire pentru acest produs
      const { data: regula } = await supabase
        .from('productie_reguli_distribuire')
        .select(`
          *,
          productie_linii(*)
        `)
        .eq('produs_id', comanda.produs_id)
        .eq('productie_linii.status', 'activa')
        .order('prioritate')
        .limit(1)
        .single();
      
      let linieSelectata = null;
      
      if (regula) {
        console.log('✅ Găsit regulă de distribuire:', regula);
        linieSelectata = regula.productie_linii;
      } else {
        console.log('⚠️ Nu există regulă specifică - caut prima linie activă disponibilă');
        
        // Dacă nu există regulă specifică, găsește prima linie activă
        const { data: liniiActive } = await supabase
          .from('productie_linii')
          .select('*')
          .eq('status', 'activa')
          .order('nume')
          .limit(1);
        
        if (liniiActive && liniiActive.length > 0) {
          linieSelectata = liniiActive[0];
          console.log('📍 Linie selectată implicit:', linieSelectata);
        }
      }
      
      if (!linieSelectata) {
        throw new Error('Nu există linii active disponibile pentru distribuire');
      }
      
      // Actualizează comanda cu linia selectată și statusul 'assigned'
      const { data: comandaActualizata, error: updateError } = await supabase
        .from('productie_comenzi')
        .update({ 
          linie_id: linieSelectata.id,
          status: 'assigned'
        })
        .eq('id', comandaId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      console.log('✅ Comandă distribuită cu succes pe linia:', linieSelectata.nume);
      return comandaActualizata;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    }
  });
};

// Hook pentru încărcarea produselor
export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_produse')
        .select('*')
        .order('nume');
      
      if (error) throw error;
      return data as ProductieProds[];
    }
  });
};

// Hook pentru încărcarea clienților
export const useClients = () => {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_clienti')
        .select(`
          *,
          productie_zone_livrare(*)
        `)
        .order('nume_magazin');
      
      if (error) throw error;
      return data as ProductieClient[];
    }
  });
};

// Hook pentru crearea unui produs nou
export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productData: {
      nume: string;
      descriere?: string;
      unitate_masura: string;
    }) => {
      const { data, error } = await supabase
        .from('productie_produse')
        .insert([productData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
};

// Hook pentru actualizarea unui produs
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductieProds> }) => {
      const { data, error } = await supabase
        .from('productie_produse')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
};

// Hook pentru ștergerea unui produs
export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Verifică dacă există comenzi pentru acest produs
      const { data: comenzi, error: comenziError } = await supabase
        .from('productie_comenzi')
        .select('id')
        .eq('produs_id', id)
        .limit(1);
      
      if (comenziError) throw comenziError;
      
      if (comenzi && comenzi.length > 0) {
        throw new Error('Nu poți șterge acest produs deoarece există comenzi asociate cu el.');
      }
      
      // 2. Șterge regulile de distribuire
      const { error: reguliError } = await supabase
        .from('productie_reguli_distribuire')
        .delete()
        .eq('produs_id', id);
      
      if (reguliError) throw reguliError;
      
      // 3. Șterge rețetele (ingredientele se șterg automat prin CASCADE)
      const { error: reteteError } = await supabase
        .from('productie_retete')
        .delete()
        .eq('produs_id', id);
      
      if (reteteError) throw reteteError;
      
      // 4. Șterge produsul
      const { error } = await supabase
        .from('productie_produse')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['distribution-rules'] });
    }
  });
};

// Hook pentru crearea unui client nou
export const useCreateClient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (clientData: {
      nume_magazin: string;
      punct_livrare: string;
      adresa?: string;
      telefon?: string;
      email?: string;
    }) => {
      const { data, error } = await supabase
        .from('productie_clienti')
        .insert([clientData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  });
};

// Hook pentru actualizarea unui client
export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductieClient> }) => {
      const { data, error } = await supabase
        .from('productie_clienti')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  });
};

// Hook pentru ștergerea unui client
export const useDeleteClient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productie_clienti')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  });
};

// Hook pentru încărcarea comenzilor cu relațiile corecte - AFIȘEAZĂ TOATE COMENZILE (inclusiv finalizate)
export const useOrders = () => {
  return useQuery({
    queryKey: ['orders'],
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
        
        const totalProdusDinSesiuni = sesiuni?.reduce((total, sesiune) => 
          total + Number(sesiune.cantitate_produsa || 0), 0) || 0;
        const cantitateDinRestock = Number(comanda.cantitate_din_restock || 0);
        const necesarMaximDinProductie = Math.max(0, Number(comanda.cantitate || 0) - cantitateDinRestock);
        const cantitateRealaProadusa = Math.min(totalProdusDinSesiuni, necesarMaximDinProductie);
        
        return {
          ...comanda,
          productie_clienti: client,
          cantitate_reala_produsa: cantitateRealaProadusa,
          cantitate_produsa_sesiuni: totalProdusDinSesiuni,
          cantitate_surplus_produsa: Math.max(0, totalProdusDinSesiuni - cantitateRealaProadusa)
        };
      }));
      
      // Încearcă alocare automată din restocări pentru comenzi neacoperite (FIFO)
      for (const com of comandiCuClienti) {
        const produsId = (com as any).produs_id;
        if (!produsId) continue;
        if ((com as any).magazin === 'PRODUCTIE_AVANS' || (com as any).tip_comanda === 'PRODUCTIE_AVANS') continue;
        if ((com as any).magazin === 'REAMBALARE' || (com as any).tip_comanda === 'REAMBALARE') continue;
        const acoperit = (com as any).cantitate_reala_produsa + ((com as any).cantitate_din_restock || 0);
        let necesar = Math.max(0, (com as any).cantitate - acoperit);
        const status = (com as any).status || '';
        if (necesar <= 0) continue;
        if (!['pending', 'assigned', 'in_progress', 'alocata', 'allocated'].includes(status)) continue;
        
        const { data: restocari } = await supabase
          .from('productie_restocari')
          .select('*')
          .eq('produs_id', produsId)
          .eq('status', 'disponibil')
          .gt('cantitate_surplus', 0)
          .order('data_productie', { ascending: true });
        
        if (restocari && restocari.length > 0) {
          let folosit = 0;
          for (const r of restocari) {
            if (necesar <= 0) break;
            const take = Math.min(necesar, Number(r.cantitate_surplus || 0));
            if (take <= 0) continue;
            if (take === r.cantitate_surplus) {
              await supabase.from('productie_restocari').update({ status: 'folosit', cantitate_surplus: 0 }).eq('id', r.id);
            } else {
              await supabase.from('productie_restocari').update({ cantitate_surplus: Number(r.cantitate_surplus) - take }).eq('id', r.id);
            }
            folosit += take;
            necesar -= take;
          }
          if (folosit > 0) {
            const cantVeche = Number((com as any).cantitate_din_restock || 0);
            await supabase
              .from('productie_comenzi')
              .update({ cantitate_din_restock: cantVeche + folosit, updated_at: new Date().toISOString() })
              .eq('id', (com as any).id);
            (com as any).cantitate_din_restock = cantVeche + folosit; // reflectă imediat în UI
          }
        }
      }

      // Sortăm comenzile după prioritatea zonei de livrare, apoi după data actualizării
      const sortedData = comandiCuClienti.sort((a, b) => {
        // Primul criteriu: statusul (comenzile în progres și pending primul)
        const statusPriorityA = a.status === 'in_progress' ? 0 : a.status === 'pending' ? 1 : a.status === 'assigned' ? 2 : 3;
        const statusPriorityB = b.status === 'in_progress' ? 0 : b.status === 'pending' ? 1 : b.status === 'assigned' ? 2 : 3;
        
        if (statusPriorityA !== statusPriorityB) return statusPriorityA - statusPriorityB;
        
        // Al doilea criteriu: updated_at descendent (cel mai recent modificat primul)
        const dateComparison = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        if (dateComparison !== 0) return dateComparison;
        
        // Al treilea criteriu: prioritatea zonei de livrare
        const priorityA = a.productie_clienti?.productie_zone_livrare?.prioritate || 999;
        const priorityB = b.productie_clienti?.productie_zone_livrare?.prioritate || 999;
        return priorityA - priorityB;
      });
      
      return sortedData as ProductieComanda[];
    }
  });
};

// Hook pentru crearea unei comenzi noi - cu verificare automată de restocări ȘI ACTUALIZARE STATUS
export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: {
      magazin: string;
      punct_livrare: string;
      produs_id: string;
      cantitate: number;
      baxare?: string;
      linie_id?: string | null;
      status?: string;
      tip_comanda?: string;
      data_productie?: string | null;
    }) => {
      console.log('🆕 Creez comandă nouă:', orderData);
      
      let cantitateRamasa = orderData.cantitate;
      let cantitatedinRestock = 0;
      let statusFinal = orderData.status || 'pending';
      
      // IMPORTANT: Pentru comenzile PRODUCTIE_AVANS și REAMBALARE nu se ia din restocări
      const esteProductieAvans = orderData.tip_comanda === 'PRODUCTIE_AVANS';
      const esteReambalare = orderData.tip_comanda === 'REAMBALARE' || orderData.magazin === 'REAMBALARE';
      
      if (esteProductieAvans) {
        console.log('🔧 Comandă de producție în avans - NU se alocă din restocări');
      }
      if (esteReambalare) {
        console.log('🔁 Comandă de reambalare - NU se alocă din restocări');
      }
      
      // Verifică restocări disponibile pentru acest produs DOAR dacă NU e producție în avans/reambalare
      if (!esteProductieAvans && !esteReambalare) {
        const { data: restocariDisponibile } = await supabase
          .from('productie_restocari')
          .select('*')
          .eq('produs_id', orderData.produs_id)
          .eq('status', 'disponibil')
          .gt('cantitate_surplus', 0)
          .order('created_at');
        
        // Dacă există restocări disponibile, încearcă să le utilizeze
        if (restocariDisponibile && restocariDisponibile.length > 0) {
          console.log('📦 Găsit restocări disponibile:', restocariDisponibile.length);
          
          for (const restocate of restocariDisponibile) {
            if (cantitateRamasa <= 0) break;
            
            const surplusDisponibil = Number(restocate.cantitate_surplus || 0);
            if (surplusDisponibil <= 0) continue;
            const cantitateUtilizata = Math.min(cantitateRamasa, surplusDisponibil);
            cantitatedinRestock += cantitateUtilizata;
            cantitateRamasa -= cantitateUtilizata;
            
            // Actualizează restocarea
            if (cantitateUtilizata >= surplusDisponibil) {
              // Restocarea este complet utilizată
              await supabase
                .from('productie_restocari')
                .update({ status: 'redistribuit', cantitate_surplus: 0 })
                .eq('id', restocate.id);
              console.log('✅ Restocarea completă utilizată:', restocate.id);
            } else {
              // Restocarea este parțial utilizată
              await supabase
                .from('productie_restocari')
                .update({ cantitate_surplus: surplusDisponibil - cantitateUtilizata })
                .eq('id', restocate.id);
              console.log('📝 Restocarea parțial utilizată:', restocate.id, 'Rămas:', surplusDisponibil - cantitateUtilizata);
            }
          }
          
          // ACTUALIZARE FINALĂ STATUS - Dacă comanda este 100% acoperită din restocări
          if (cantitateRamasa === 0) {
            statusFinal = 'completed';
            console.log('🎉 Comanda 100% acoperită din restocări - STATUS: completed');
          } else {
            console.log('⚠️ Comanda parțial acoperită din restocări. Rămas de produs:', cantitateRamasa);
          }
        }
      }
      
      // Creează comanda cu statusul corect
      const { data, error } = await supabase
        .from('productie_comenzi')
        .insert([{
          magazin: orderData.magazin,
          punct_livrare: orderData.punct_livrare,
          produs_id: orderData.produs_id,
          cantitate: orderData.cantitate,
          baxare: orderData.baxare || undefined,
          linie_id: orderData.linie_id || null,
          status: statusFinal,
          cantitate_din_restock: cantitatedinRestock,
          tip_comanda: orderData.tip_comanda,
          data_productie: orderData.data_productie || null,
          numar_comanda: ''
        } as any])
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Comandă creată cu succes:', {
        id: data.id,
        status: statusFinal,
        cantitate_din_restock: cantitatedinRestock,
        cantitate_ramasa_de_produs: cantitateRamasa,
        procent_acoperire: Math.round((cantitatedinRestock / orderData.cantitate) * 100)
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['restockings'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata-istoric'] });
    }
  });
};

// Hook pentru actualizarea unei comenzi
export const useUpdateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      console.log('🔄 === ACTUALIZARE COMANDĂ ===');
      console.log('📊 ID comandă:', id);
      console.log('📋 Actualizări:', updates);
      
      // VALIDARE NOUĂ: Nu permite setarea statusului "completed" dacă nu este 100% finalizată
      if (updates.status === 'completed') {
        console.log('🚫 Verificare validare status completed...');
        
        // Citesc datele actuale ale comenzii
        const { data: comandaData, error: fetchError } = await supabase
          .from('productie_comenzi')
          .select('cantitate, cantitate_reala_produsa, magazin, produs_id')
          .eq('id', id)
          .single();
        
        if (fetchError) {
          console.error('❌ EROARE LA CITIRE COMANDĂ:', fetchError);
          throw new Error(`Eroare la citirea comenzii: ${fetchError.message}`);
        }
        
        const cantitateComandată = comandaData.cantitate;
        const cantitateReală = comandaData.cantitate_reala_produsa || 0;
        const esteComandeAvans = comandaData.magazin === 'PRODUCTIE_AVANS';
        const esteReambalareCom = comandaData.magazin === 'REAMBALARE' || (comandaData as any).tip_comanda === 'REAMBALARE';
        
        console.log('📊 Verificare cantități:', {
          cantitateComandată,
          cantitateReală,
          esteComandeAvans,
          procentProgres: cantitateComandată > 0 ? Math.round((cantitateReală / cantitateComandată) * 100) : 0
        });
        
        if (!esteComandeAvans && !esteReambalareCom && cantitateReală < cantitateComandată) {
          const procentProgres = cantitateComandată > 0 ? Math.round((cantitateReală / cantitateComandată) * 100) : 0;
          throw new Error(`Nu poți finaliza comanda! Ai produs doar ${cantitateReală} din ${cantitateComandată} bucăți (${procentProgres}%). Trebuie să ai cel puțin 100% pentru a marca comanda ca finalizată.`);
        }
        
        // CREARE RESTOCăRI pentru comenzile de producție în avans / reambalare când sunt finalizate manual
        if ((esteComandeAvans || esteReambalareCom) && cantitateReală > 0) {
          console.log('🎯 COMANDĂ DE PRODUCȚIE ÎN AVANS FINALIZATĂ MANUAL - creez restocată pentru:', cantitateReală);
          
          // Verifică dacă nu există deja o restocată pentru această comandă
          const { data: restocareExistenta } = await supabase
            .from('productie_restocari')
            .select('id')
            .eq('comanda_originala_id', id)
            .single();
          
          if (!restocareExistenta) {
            const restockingData = {
              comanda_originala_id: id,
              produs_id: comandaData.produs_id,
              cantitate_surplus: cantitateReală,
              data_productie: new Date().toISOString().split('T')[0],
              status: 'disponibil'
            };
            
            console.log('📦 Creez restocarea pentru producție în avans finalizată manual:', restockingData);
            
            const { data: restockingResult, error: restockingError } = await supabase
              .from('productie_restocari')
              .insert([restockingData])
              .select()
              .single();
            
            if (restockingError) {
              console.error('❌ EROARE la crearea restocării pentru producția în avans:', restockingError);
            } else {
              console.log('✅ RESTOCAREA PENTRU PRODUCȚIA ÎN AVANS FINALIZATĂ MANUAL A FOST CREATĂ:', restockingResult);
            }
          } else {
            console.log('ℹ️ Restocarea pentru această comandă de producție în avans există deja');
          }
        }
        
        console.log('✅ Validare trecută - comanda poate fi finalizată');
      }
      
      const { data, error } = await supabase
        .from('productie_comenzi')
        .update(updates)
        .eq('id', id)
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

      if (error) {
        console.error('❌ EROARE UPDATE:', error);
        throw error;
      }
      
      console.log('✅ COMANDĂ ACTUALIZATĂ CU SUCCES:', {
        id: data.id,
        status: data.status,
        cantitate_comandata: data.cantitate,
        cantitate_reala: data.cantitate_reala_produsa
      });

      return data;
    },
    onSuccess: () => {
      console.log('🎯 Invalidez cache-urile după actualizarea comenzii...');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['productie-comenzi'] });
      queryClient.invalidateQueries({ queryKey: ['restockings'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata-istoric'] });
      toast({
        title: "Succes",
        description: "Comanda actualizată cu succes!"
      });
    },
    onError: (error) => {
      console.error('❌ EROARE LA ACTUALIZARE COMANDĂ:', error);
      toast({
        variant: "destructive",
        title: "Eroare",
        description: error.message
      });
    }
  });
};

// Hook pentru ștergerea unei comenzi
export const useDeleteOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productie_comenzi')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    }
  });
};

// Hook pentru sesiunile de lucru
export const useWorkSessions = () => {
  return useQuery({
    queryKey: ['work-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_sesiuni_lucru')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ProductieSesiuneLucru[];
    }
  });
};

// Hook pentru crearea unei sesiuni de lucru
export const useCreateWorkSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sessionData: {
      comanda_id: string;
      linie_id: string;
      nume_operator: string;
      numar_angajati: number;
    }) => {
      const { data, error } = await supabase
        .from('productie_sesiuni_lucru')
        .insert([sessionData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });
};

// Hook pentru finalizarea unei sesiuni de lucru - cu logging îmbunătățit
export const useFinishWorkSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      cantitate_produsa, 
      status,
      comanda_id
    }: { 
      id: string; 
      cantitate_produsa: number; 
      status: 'finalizata' | 'partial';
      comanda_id: string;
    }) => {
      console.log('🔄 ÎNCEPE finalizarea sesiunii:', { id, cantitate_produsa, status, comanda_id });
      
      // Finalizez sesiunea de lucru
      const { data: sessionData, error: sessionError } = await supabase
        .from('productie_sesiuni_lucru')
        .update({
          cantitate_produsa,
          status,
          ora_sfarsit: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (sessionError) {
        console.error('❌ Eroare la finalizarea sesiunii:', sessionError);
        throw sessionError;
      }

      console.log('✅ Sesiunea finalizată cu succes:', sessionData);

      // Obțin detaliile comenzii pentru a verifica surplus-ul
      const { data: comanda, error: comandaError } = await supabase
        .from('productie_comenzi')
        .select('*')
        .eq('id', comanda_id)
        .single();
      
      if (comandaError) {
        console.error('❌ Eroare la încărcarea comenzii:', comandaError);
        throw comandaError;
      }

      console.log('📋 Detalii comandă:', {
        numar_comanda: comanda.numar_comanda,
        magazin: comanda.magazin,
        cantitate_necesara: comanda.cantitate,
        cantitate_produsa_acum: cantitate_produsa,
        cantitate_din_restock: comanda.cantitate_din_restock
      });

      const esteComandeAvans = comanda.magazin === 'PRODUCTIE_AVANS' || comanda.tip_comanda === 'PRODUCTIE_AVANS';

      // ALOCĂ AUTOMAT DIN RESTOCĂRI LA FINALIZARE pentru a acoperi comanda
      // Producția în avans nu trebuie să se acopere singură din restocări.
      // 1) Calculez totalul produs până acum pentru această comandă
      const { data: sesiuniLucru, error: sesiuniErr } = await supabase
        .from('productie_sesiuni_lucru')
        .select('cantitate_produsa, status')
        .eq('comanda_id', comanda_id)
        .in('status', ['finalizata', 'partial']);

      if (sesiuniErr) {
        console.error('❌ Eroare la citirea sesiunilor pentru comandă:', sesiuniErr);
      }

      const totalProdus = (sesiuniLucru || []).reduce((acc, s) => acc + Number(s.cantitate_produsa || 0), 0);
      const restockDejaAlocat = Number(comanda.cantitate_din_restock || 0);
      // FIX: scădem și restocările deja alocate ca să nu alocăm dublu
      let necesarDinRestocari = Math.max(0, Number(comanda.cantitate || 0) - totalProdus - restockDejaAlocat);
      let alocatDinRestocari = 0;

      if (!esteComandeAvans && necesarDinRestocari > 0) {
        console.log('📦 Trebuie alocat din restocări:', necesarDinRestocari);
        // 2) Ia restocările disponibile FIFO
        const { data: restocariDisponibile, error: restocariError } = await supabase
          .from('productie_restocari')
          .select('*')
          .eq('produs_id', comanda.produs_id)
          .eq('status', 'disponibil')
          .gt('cantitate_surplus', 0)
          .order('data_productie', { ascending: true });

        if (restocariError) {
          console.error('❌ Eroare la încărcarea restocărilor:', restocariError);
        } else if (!restocariDisponibile || restocariDisponibile.length === 0) {
          console.warn('⚠️ Nu există restocări disponibile pentru acest produs.');
        } else {
          for (const restocata of restocariDisponibile) {
            if (necesarDinRestocari <= 0) break;

            const folosesc = Math.min(necesarDinRestocari, Number(restocata.cantitate_surplus || 0));
            if (folosesc <= 0) continue;

            if (folosesc === restocata.cantitate_surplus) {
              // Consum total lotul de restocare
               await supabase
                 .from('productie_restocari')
                 .update({ status: 'folosit', cantitate_surplus: 0 })
                 .eq('id', restocata.id);
            } else {
              // Consum parțial lotul
              await supabase
                .from('productie_restocari')
                .update({ cantitate_surplus: Number(restocata.cantitate_surplus) - folosesc })
                .eq('id', restocata.id);
            }

            alocatDinRestocari += folosesc;
            necesarDinRestocari -= folosesc;
          }

          // 3) Actualizez comanda cu cantitatea alocată din restocări
          if (alocatDinRestocari > 0) {
            const cantRestockVeche = Number(comanda.cantitate_din_restock || 0);
            const acoperireFinala = totalProdus + cantRestockVeche + alocatDinRestocari;
            const esteComplet = acoperireFinala >= Number(comanda.cantitate || 0);

            const { error: updErr } = await supabase
              .from('productie_comenzi')
              .update({
                cantitate_din_restock: cantRestockVeche + alocatDinRestocari,
                status: esteComplet ? 'completed' : comanda.status,
                updated_at: new Date().toISOString()
              })
              .eq('id', comanda_id);

            if (updErr) {
              console.error('❌ Eroare la actualizarea comenzii cu restocări:', updErr);
            } else {
              console.log(`✅ Alocat ${alocatDinRestocari} din restocări pentru comanda ${comanda.numar_comanda}`);
            }
          }

          if (necesarDinRestocari > 0) {
            console.warn('⚠️ Restocări insuficiente: a mai rămas neacoperit', necesarDinRestocari);
          }
        }
      }

      // Recalculez corect acoperirea comenzii: producția contează doar până la necesarul rămas după restocări
      // Cantitatea din restocări folosită după alocarea de mai sus
      const restockFolositFinal = Number(comanda.cantitate_din_restock || 0) + alocatDinRestocari;
      const necesarDinProductie = Math.max(0, Number(comanda.cantitate || 0) - restockFolositFinal);

      // Producția totală (toate sesiunile) care poate fi luată în considerare pentru această comandă
      const produsConsideratPentruComanda = Math.min(totalProdus, necesarDinProductie);

      // Actualizez cantitatea reală produsă în comanda (clamped)
      const { error: updProdErr } = await supabase
        .from('productie_comenzi')
        .update({
          cantitate_reala_produsa: produsConsideratPentruComanda,
          updated_at: new Date().toISOString()
        })
        .eq('id', comanda_id);
      if (updProdErr) {
        console.error('❌ Eroare la setarea cantității reale produse:', updProdErr);
      }

      // Calculez surplusul acestei sesiuni (ce nu încape în comandă)
      // Pentru REAMBALARE: toată cantitatea produsă devine restocare nouă (revine ca surplus disponibil)
      const esteReambalareCom = (comanda as any).magazin === 'REAMBALARE' || (comanda as any).tip_comanda === 'REAMBALARE';
      const produsAnteriorPentruComanda = Number(comanda.cantitate_reala_produsa || 0);
      const alocatDinAceastaSesiuneLaComanda = Math.max(0, produsConsideratPentruComanda - produsAnteriorPentruComanda);
      const surplusDinAceastaSesiune = (esteComandeAvans || esteReambalareCom)
        ? Number(cantitate_produsa || 0)
        : Math.max(0, Number(cantitate_produsa || 0) - alocatDinAceastaSesiuneLaComanda);

      if (surplusDinAceastaSesiune > 0) {
        const restockingData = {
          comanda_originala_id: comanda_id,
          produs_id: comanda.produs_id,
          cantitate_surplus: surplusDinAceastaSesiune,
          data_productie: new Date().toISOString().split('T')[0],
          status: 'disponibil'
        };
        console.log('📦 Creez restocare pentru surplusul sesiunii:', restockingData);
        const { error: restockingError } = await supabase
          .from('productie_restocari')
          .insert([restockingData]);
        if (restockingError) {
          console.error('❌ EROARE la crearea restocării:', restockingError);
        }
      }

      // Actualizez statusul comenzii în funcție de acoperire totală (producție considerată + restocări)
      const totalAcoperit = produsConsideratPentruComanda + restockFolositFinal;
      const esteCompletAcoperita = totalAcoperit >= Number(comanda.cantitate || 0);

      if (esteCompletAcoperita) {
        const { error: updateError } = await supabase
          .from('productie_comenzi')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', comanda_id);
        if (updateError) {
          console.error('❌ Eroare la actualizarea statusului comenzii:', updateError);
        } else {
          console.log('✅ Comanda marcată ca finalizată în baza de date');
        }
      } else if (status === 'partial') {
        const { error: updateError } = await supabase
          .from('productie_comenzi')
          .update({ status: 'partial', updated_at: new Date().toISOString() })
          .eq('id', comanda_id);
        if (updateError) {
          console.error('❌ Eroare la actualizarea statusului comenzii la partial:', updateError);
        } else {
          console.log('✅ Comanda marcată ca parțială în baza de date');
        }
      }
      
      console.log('🏁 Finalizarea sesiunii s-a completat cu succes');
      return sessionData;
    },
    onSuccess: () => {
      console.log('🔄 Invalidez cache-urile...');
      queryClient.invalidateQueries({ queryKey: ['work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-for-reports'] });
      queryClient.invalidateQueries({ queryKey: ['restockings'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata-istoric'] });
      console.log('✅ Cache-urile au fost invalidate');
    }
  });
};

// Hook pentru încărcarea regulilor de distribuire
export const useDistributionRules = () => {
  return useQuery({
    queryKey: ['distribution-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_reguli_distribuire')
        .select('*')
        .order('prioritate');
      
      if (error) throw error;
      return data;
    }
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

// Hook pentru actualizarea unei reguli de distribuire
export const useUpdateDistributionRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('productie_reguli_distribuire')
        .update(updates)
        .eq('id', id)
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

// Hook pentru ștergerea unei reguli de distribuire
export const useDeleteDistributionRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productie_reguli_distribuire')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-rules'] });
    }
  });
};

// Hook pentru încărcarea zonelor de livrare
export const useDeliveryZones = () => {
  return useQuery({
    queryKey: ['delivery-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_zone_livrare')
        .select('*')
        .order('prioritate');
      
      if (error) throw error;
      return data as ProductieZonaLivrare[];
    }
  });
};

// Hook pentru crearea unei zone de livrare
export const useCreateDeliveryZone = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (zoneData: {
      nume_zona: string;
      descriere?: string;
      prioritate: number;
      culoare?: string;
    }) => {
      const { data, error } = await supabase
        .from('productie_zone_livrare')
        .insert([zoneData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-zones'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });
};

// Hook pentru actualizarea unei zone de livrare
export const useUpdateDeliveryZone = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductieZonaLivrare> }) => {
      const { data, error } = await supabase
        .from('productie_zone_livrare')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-zones'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });
};

// Hook pentru ștergerea unei zone de livrare
export const useDeleteDeliveryZone = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productie_zone_livrare')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-zones'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });
};

// Hook pentru încărcarea stocurilor
export const useInventoryStock = () => {
  return useQuery({
    queryKey: ['inventory-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });
};

// Hook pentru detectarea surplus-ului de producție și crearea restocărilor
export const useCreateSurplusRestocking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      comandaId, 
      cantitateRealizata, 
      cantitateComanda 
    }: { 
      comandaId: string; 
      cantitateRealizata: number; 
      cantitateComanda: number; 
    }) => {
      if (cantitateRealizata <= cantitateComanda) {
        return null; // Nu există surplus
      }
      
      const surplus = cantitateRealizata - cantitateComanda;
      
      // Obține detaliile comenzii
      const { data: comanda, error: comandaError } = await supabase
        .from('productie_comenzi')
        .select('produs_id')
        .eq('id', comandaId)
        .single();
      
      if (comandaError) throw comandaError;
      
      // Creează restocarea
      const { data, error } = await supabase
        .from('productie_restocari')
        .insert([{
          comanda_originala_id: comandaId,
          produs_id: comanda.produs_id,
          cantitate_surplus: surplus,
          data_productie: new Date().toISOString().split('T')[0],
          status: 'disponibil'
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Redistribuire automată dezactivată - restocarea rămâne disponibilă
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restockings'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata-istoric'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });
};

// Funcție pentru redistribuirea automată - actualizată să includă comenzile assigned
const tryAutoRedistribution = async (restockingId: string, produsId: string, cantitateDisponibila: number) => {
  console.log('🔄 Încep redistribuirea automată pentru:', { restockingId, produsId, cantitateDisponibila });
  
  // Caută comenzi pending ȘI assigned pentru același produs - ACTUALIZAT
  const { data: comenziDisponibile } = await supabase
    .from('productie_comenzi')
    .select('*')
    .eq('produs_id', produsId)
    .in('status', ['pending', 'assigned'])
    .order('created_at');
  
  if (!comenziDisponibile || comenziDisponibile.length === 0) {
    console.log('ℹ️ Nu există comenzi pending sau assigned pentru redistribuire - restocarea rămâne disponibilă');
    return;
  }
  
  let cantitateRamasa = cantitateDisponibila;
  let comenziModificate = 0;
  
  for (const comanda of comenziDisponibile) {
    if (cantitateRamasa <= 0) break;
    
    const cantitateNecesara = comanda.cantitate - (comanda.cantitate_din_restock || 0);
    
    if (cantitateNecesara <= cantitateRamasa) {
      // Poate fi satisfăcută complet din restock
      await supabase
        .from('productie_comenzi')
        .update({ 
          status: 'completed',
          cantitate_din_restock: (comanda.cantitate_din_restock || 0) + cantitateNecesara
        })
        .eq('id', comanda.id);
      
      cantitateRamasa -= cantitateNecesara;
      comenziModificate++;
      console.log('✅ Comandă completată din restock:', comanda.id, 'Status anterior:', comanda.status, 'Cantitate folosită:', cantitateNecesara);
    } else if (cantitateRamasa > 0) {
      // Poate fi satisfăcută parțial
      await supabase
        .from('productie_comenzi')
        .update({ 
          cantitate_din_restock: (comanda.cantitate_din_restock || 0) + cantitateRamasa
        })
        .eq('id', comanda.id);
      
      comenziModificate++;
      console.log('✅ Comandă parțial completată din restock:', comanda.id, 'Status anterior:', comanda.status, 'Cantitate folosită:', cantitateRamasa);
      cantitateRamasa = 0;
    }
  }
  
  // Actualizează statusul restocării doar dacă s-au redistribuit produse
  if (comenziModificate > 0) {
    if (cantitateRamasa === 0) {
      await supabase
        .from('productie_restocari')
        .update({ status: 'redistribuit' })
        .eq('id', restockingId);
      console.log('✅ Restocarea a fost complet redistribuită');
    } else {
      // Actualizează cantitatea rămasă
      await supabase
        .from('productie_restocari')
        .update({ cantitate_surplus: cantitateRamasa })
        .eq('id', restockingId);
      console.log('ℹ️ Restocarea parțial redistribuită, rămân:', cantitateRamasa, 'bucăți');
    }
  } else {
    console.log('ℹ️ Nu s-au putut redistribui produse - restocarea rămâne disponibilă');
  }
};
