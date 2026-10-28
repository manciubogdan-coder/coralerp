import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { POOL_MODE, fetchPoolRows, fetchPoolTotals, consumaDinPool } from '@/lib/productie/stockPool';

import { useOrders } from './useProductionData';
import { pickingDay, pickingReadiness } from '@/lib/productie/pickingReadiness';

// Tipuri
export interface ComenziDisponibile {
  magazin: string;
  punct_livrare: string;
  data: string; // YYYY-MM-DD
  total_produse: number;
  produse_gata: number;
  produse_in_productie: number;
  produse: {
    sesiune_lucru_id: string;
    produs_id: string;
    nume_produs: string;
    cantitate_produsa: number;
    cantitate_realizata: number;
    gata: boolean;
    unitate_masura: string;
  }[];
}


export interface PickingSesiune {
  id: string;
  magazin: string;
  punct_livrare: string;
  operator_nume: string;
  status: string;
  data_sesiune: string;
  created_at: string;
  updated_at: string;
}

export interface PickingProdus {
  id: string;
  sesiune_id: string;
  sesiune_lucru_id: string;
  produs_id: string;
  nume_produs: string;
  cantitate_comandata: number;
  cantitate_numarata: number;
  cantitate_lipsa: number;
  unitate_masura: string;
  status: string;
  observatii?: string;
  created_at: string;
  updated_at: string;
}

// Hook pentru comenzile disponibile - toate comenzile de client (inclusiv cele din restocări)
const chunk = <T,>(arr: T[], size = 50): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const useComenziDisponibile = () => {
  const production = useOrders();
  return useQuery({
    enabled: !!production.data,
    queryKey: ['comenzi-disponibile-picking', production.dataUpdatedAt],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Reuse the exact session-derived, same-day advance projection shown in Production.
      // Include pending firm demand, but never advance/repack orders as Picking deliveries.
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 14);
      const fromKey = pickingDay({ created_at: lookback.toISOString() });
      const comenzi = (production.data || []).filter((order: any) =>
        !['producție în avans', 'productie in avans', 'avans', 'productie_avans', 'producție_avans', 'reambalare'].includes(String(order.magazin || '').trim().toLowerCase()) &&
        !['PRODUCTIE_AVANS', 'REAMBALARE'].includes(String(order.tip_comanda || '').toUpperCase()) &&
        ['pending', 'assigned', 'in_progress', 'partial', 'completed'].includes(order.status) &&
        pickingDay(order) >= fromKey && Number(order.cantitate || 0) > 0);
      if (!comenzi.length) return [] as ComenziDisponibile[];

      // Nu mai filtrez comenzile neproduse: le arăt pe toate, dar marcate ca „în producție”
      const comenziProduse = comenzi.filter((com: any) => Number(com.cantitate || 0) > 0);

      if (comenziProduse.length === 0) return [] as ComenziDisponibile[];

      // Exclud comenzile deja preluate în picking (batch-uri paralele)
      const comenziProduseIds = comenziProduse.map((c: any) => c.id);
      const pickingBatches = await Promise.all(
        chunk(comenziProduseIds, 100).map(async (ids) => {
          const rows: any[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase.from('picking_produse')
              .select('id, sesiune_lucru_id').in('sesiune_lucru_id', ids).order('id').range(from, from + 999);
            if (error) throw error;
            rows.push(...(data || []));
            if (!data || data.length < 1000) break;
          }
          return rows;
        })
      );
      const pickingRows: any[] = pickingBatches.flat();

      const pickedSet = new Set((pickingRows || []).map((r: any) => r.sesiune_lucru_id));
      const comenziDisponibile = comenziProduse.filter((c: any) => !pickedSet.has(c.id));

      if (comenziDisponibile.length === 0) return [] as ComenziDisponibile[];

      // Încarc detalii de produs separat (nu avem FK declarat)
      const productIds = Array.from(new Set(
        comenziDisponibile.map((c: any) => c.produs_id).filter(Boolean)
      )) as string[];
      const produseBatches = await Promise.all(
        chunk(productIds, 100).map(async (ids) => {
          const { data, error } = await supabase
            .from('productie_produse')
            .select('id, nume, unitate_masura')
            .in('id', ids);
          if (error) throw error;
          return data || [];
        })
      );
      const produseDetalii: any[] = produseBatches.flat();


      const produseMap = new Map<string, { nume: string; unitate_masura: string }>();
      (produseDetalii || []).forEach((p: any) => {
        produseMap.set(p.id, { nume: p.nume, unitate_masura: p.unitate_masura });
      });

      // POOL_MODE: disponibilul real vine din pool-ul de marfă produsă (restocări),
      // plus ce e deja alocat comenzii (cantitate_din_restock).
      const ownPool = new Map<string, number>();
      if (POOL_MODE) for (const lot of await fetchPoolRows(productIds)) {
        if (lot.comanda_originala_id) ownPool.set(lot.comanda_originala_id, (ownPool.get(lot.comanda_originala_id) || 0) + Number(lot.cantitate_surplus));
      }

      // Grupare pe magazin|punct_livrare (fiecare comandă rămâne separată)
      const grouped = new Map<string, ComenziDisponibile>();
      comenziDisponibile.forEach((com: any) => {
        const zi = pickingDay(com);
        const key = `${com.magazin}|${com.punct_livrare}|${zi}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            magazin: com.magazin,
            punct_livrare: com.punct_livrare,
            data: zi,
            total_produse: 0,
            produse_gata: 0,
            produse_in_productie: 0,
            produse: []
          });
        }
        const entry = grouped.get(key);
        if (!entry) return;
        const det = produseMap.get(com.produs_id) || { nume: 'Produs', unitate_masura: '' };

        const cantitateComanda = Number(com.cantitate || 0);
        const alocat = Number(com.cantitate_din_restock || 0);
        const { realized: realizat, ready: gata } = pickingReadiness(
          cantitateComanda, Number(com.cantitate_reala_produsa || 0), alocat, ownPool.get(com.id) || 0,
        );

        // Adaug fiecare comandă ca un produs separat (nu mai agreghez)
        entry.total_produse += 1;
        if (gata) entry.produse_gata += 1; else entry.produse_in_productie += 1;
        entry.produse.push({
          sesiune_lucru_id: com.id, // folosim id-ul comenzii
          produs_id: com.produs_id,
          nume_produs: `${det.nume} (${com.numar_comanda})`, // adaug și numărul comenzii pentru claritate
          cantitate_produsa: cantitateComanda,
          cantitate_realizata: Math.min(realizat, cantitateComanda),
          gata,
          unitate_masura: det.unitate_masura
        });
      });



      // Returnez toate grupările (comenzile individuale deja excluse mai sus)
      const rezultat = Array.from(grouped.values()).sort((a, b) => b.data.localeCompare(a.data));
      return rezultat;
    }
  });
};

// Hook pentru sesiunile de picking
export const usePickingSesiuni = (status?: string) => {
  return useQuery({
    queryKey: ['picking-sesiuni', status],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let query = supabase
        .from('picking_sesiuni')
        .select('*')
        .neq('magazin', 'PRODUCTIE_AVANS')
        .neq('magazin', 'PRODUCȚIE_AVANS')
        .neq('magazin', 'Producție în avans')
        .neq('magazin', 'Productie in avans')
        .neq('magazin', 'AVANS')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const rows: PickingSesiune[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await query.range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return rows;
    }
  });
};

// Hook pentru crearea sesiunii de picking
export const useCreatePickingSesiune = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      magazin: string;
      punct_livrare: string;
      data_sesiune: string;
      operator_nume: string;
      produse: {
        sesiune_lucru_id: string;
        produs_id: string;
        nume_produs: string;
        cantitate_comandata: number;
        unitate_masura: string;
      }[];
    }) => {
      // Creez sesiunea
      const { data: sesiune, error: sesiuneError } = await supabase
        .from('picking_sesiuni')
        .insert({
          magazin: params.magazin,
          punct_livrare: params.punct_livrare,
          data_sesiune: params.data_sesiune,
          operator_nume: params.operator_nume,
          status: 'in_lucru'
        })
        .select()
        .single();

      if (sesiuneError) throw sesiuneError;

      // Construiesc produsele strict cu coloanele existente în picking_produse
      const produse = params.produse.map(p => ({
        sesiune_id: sesiune.id,
        sesiune_lucru_id: p.sesiune_lucru_id,
        produs_id: p.produs_id,
        nume_produs: p.nume_produs,
        cantitate_comandata: p.cantitate_comandata,
        unitate_masura: p.unitate_masura,
        status: 'asteptare'
      }));

      const { error: produseError } = await supabase
        .from('picking_produse')
        .insert(produse);

      if (produseError) throw produseError;

      return sesiune;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-sesiuni'] });
      queryClient.invalidateQueries({ queryKey: ['comenzi-disponibile-picking'] });
      toast.success('Sesiune de picking creată cu succes');
    },
    onError: (error: Error) => {
      toast.error(`Eroare la crearea sesiunii: ${error.message}`);
    }
  });
};

// Hook pentru produsele din sesiune
export const usePickingProduse = (sesiuneId?: string) => {
  const production = useOrders();
  return useQuery({
    queryKey: ['picking-produse', sesiuneId, production.dataUpdatedAt],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!sesiuneId) return [];

      const { data, error } = await supabase
        .from('picking_produse')
        .select('*')
        .eq('sesiune_id', sesiuneId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Îmbogățesc cu detalii din comanda originală (total comandat + din restocări)
      const comandaIds = (data || []).map((p: any) => p.sesiune_lucru_id).filter(Boolean);
      if (comandaIds.length === 0) return data as any[];

      const ids = new Set(comandaIds);
      const comenziDetalii = (production.data || []).filter(c => ids.has(c.id));

      const poolTotals = POOL_MODE
        ? await fetchPoolTotals((comenziDetalii || []).map((c: any) => c.produs_id))
        : new Map<string, number>();
      const ownPool = new Map<string, number>();
      if (POOL_MODE) for (const lot of await fetchPoolRows((comenziDetalii || []).map((c: any) => c.produs_id))) {
        if (lot.comanda_originala_id) ownPool.set(lot.comanda_originala_id, (ownPool.get(lot.comanda_originala_id) || 0) + Number(lot.cantitate_surplus));
      }

      const map = new Map((comenziDetalii || []).map((c: any) => [c.id, c]));
      const enriched = (data || []).map((p: any) => {
        const c = map.get(p.sesiune_lucru_id);
        const total = Number(c?.cantitate ?? p.cantitate_comandata ?? 0);
        const alocat = Number(c?.cantitate_din_restock || 0);
        const produsId = c?.produs_id || p.produs_id;
        const reserved = Math.min(Math.max(0, total - alocat), ownPool.get(p.sesiune_lucru_id) || 0);
        const free = POOL_MODE ? Number(poolTotals.get(produsId) || 0) : 0;
        const poolDisponibil = POOL_MODE ? reserved + free : 0;
        if (POOL_MODE) poolTotals.set(produsId, Math.max(0, free - Math.max(0, total - alocat - reserved)));
        const { realized: realizat, ready } = pickingReadiness(
          total, Number(c?.cantitate_reala_produsa || 0), alocat, reserved,
        );
        return {
          ...p,
          comanda_id: p.sesiune_lucru_id,
          produs_id: produsId,
          cantitate_totala_comanda: c?.cantitate ?? p.cantitate_comandata,
          cantitate_din_restock: alocat,
          cantitate_alocata: alocat,
          pool_disponibil: poolDisponibil,
          cantitate_realizata: Math.min(realizat, total),
          gata_productie: ready,
        };
      });

      return enriched as any[];

    },
    enabled: !!sesiuneId && !!production.data
  });
};

// Hook pentru actualizarea produsului
export const useUpdatePickingProdus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      cantitate_numarata?: number;
      cantitate_lipsa?: number;
      status?: string;
      observatii?: string;
      comanda_id?: string;
      produs_id?: string;
      cantitate_alocata?: number;
    }) => {
      const { comanda_id, produs_id, cantitate_alocata, ...updates } = params;

      const { error } = await supabase
        .from('picking_produse')
        .update(updates)
        .eq('id', params.id);

      if (error) throw error;

      // POOL_MODE: cantitatea numărată consumă automat FIFO din pool-ul de marfă produsă.
      if (POOL_MODE && comanda_id && produs_id) {
        const numarat = Number(params.cantitate_numarata || 0);
        const dejaAlocat = Number(cantitate_alocata || 0);
        const necesar = numarat - dejaAlocat;
        if (necesar > 0) {
          const luat = await consumaDinPool(produs_id, necesar, {}, comanda_id);
          if (luat > 0) {
            await supabase
              .from('productie_comenzi')
              .update({
                cantitate_din_restock: dejaAlocat + luat,
                updated_at: new Date().toISOString(),
              })
              .eq('id', comanda_id);
          }
          if (luat < necesar - 1e-6) {
            toast.warning(
              `Pool insuficient: alocat ${luat} din ${necesar} necesare. Verifică marfa restocată.`
            );
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-produse'] });
      queryClient.invalidateQueries({ queryKey: ['comenzi-disponibile-picking'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata'] });
      toast.success('Produs actualizat');
    },
    onError: (error: Error) => {
      toast.error(`Eroare: ${error.message}`);
    }
  });
};

// Hook pentru finalizarea sesiunii — comenzile se închid cu „livrat parțial” unde e cazul
export const useFinalizareSesiune = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sesiuneId: string) => {
      const { data: produse, error: prodErr } = await supabase
        .from('picking_produse')
        .select('id, sesiune_lucru_id, cantitate_comandata, cantitate_numarata, observatii')
        .eq('sesiune_id', sesiuneId);
      if (prodErr) throw prodErr;

      const writes: Promise<any>[] = [];
      for (const p of produse || []) {
        const comandaId = (p as any).sesiune_lucru_id;
        if (!comandaId) continue;
        const comandat = Number((p as any).cantitate_comandata || 0);
        const numarat = Number((p as any).cantitate_numarata || 0);
        const partial = numarat < comandat - 1e-6;

        writes.push(
          supabase
            .from('productie_comenzi')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', comandaId) as any
        );

        if (partial) {
          const nota = `Livrat parțial: ${numarat}/${comandat}`;
          const obsVechi = ((p as any).observatii || '').toString();
          if (!obsVechi.includes('Livrat parțial')) {
            writes.push(
              supabase
                .from('picking_produse')
                .update({ observatii: obsVechi ? `${obsVechi} • ${nota}` : nota })
                .eq('id', (p as any).id) as any
            );
          }
        }
      }
      if (writes.length > 0) await Promise.all(writes);

      const { error } = await supabase
        .from('picking_sesiuni')
        .update({ status: 'finalizata' })
        .eq('id', sesiuneId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-sesiuni'] });
      queryClient.invalidateQueries({ queryKey: ['picking-produse'] });
      queryClient.invalidateQueries({ queryKey: ['comenzi-disponibile-picking'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Comandă finalizată! Diferențele au fost marcate ca „livrat parțial”.');
    },
    onError: (error: Error) => {
      toast.error(`Eroare la finalizare: ${error.message}`);

    }
  });
};

// Alocare manuală din pool-ul de marfă produsă („Ia din restocări")
export const useAlocaDinPool = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      comanda_id: string;
      produs_id: string;
      cantitate_alocata: number;
      cantitate: number;
    }) => {
      const luat = await consumaDinPool(params.produs_id, params.cantitate, {}, params.comanda_id);
      if (luat > 0) {
        const { error } = await supabase
          .from('productie_comenzi')
          .update({
            cantitate_din_restock: Number(params.cantitate_alocata || 0) + luat,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.comanda_id);
        if (error) throw error;
      }
      return luat;
    },
    onSuccess: (luat) => {
      queryClient.invalidateQueries({ queryKey: ['picking-produse'] });
      queryClient.invalidateQueries({ queryKey: ['comenzi-disponibile-picking'] });
      queryClient.invalidateQueries({ queryKey: ['marfa-restocata'] });
      queryClient.invalidateQueries({ queryKey: ['pool-redistribuire'] });
      if (luat > 0) toast.success(`Alocat ${luat} din restocări`);
      else toast.error('Nu există marfă disponibilă în restocări');
    },
    onError: (error: Error) => toast.error(`Eroare: ${error.message}`),
  });
};
