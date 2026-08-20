import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  return useQuery({
    queryKey: ['comenzi-disponibile-picking'],
    queryFn: async () => {
      // Iau comenzile de CLIENT (NU avans) care au ajuns cel puțin în producție.
      // Paginez ca să nu mă lovesc de limita de 1000 de rânduri.
      const comenzi: any[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('productie_comenzi')
          .select('id, magazin, punct_livrare, status, numar_comanda, produs_id, cantitate, cantitate_din_restock, data_productie, created_at')
          .neq('magazin', 'Producție în avans')
          .neq('magazin', 'Productie in avans')
          .neq('magazin', 'AVANS')
          .neq('magazin', 'PRODUCTIE_AVANS')
          .neq('magazin', 'PRODUCȚIE_AVANS')
          .in('status', ['assigned', 'in_progress', 'partial', 'completed'])
          .gt('cantitate', 0)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        comenzi.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }

      if (comenzi.length === 0) return [] as ComenziDisponibile[];

      // Verific pentru fiecare comandă cantitatea produsă efectiv (batch-uri de 50 ID-uri)
      const comenziIds = comenzi.map((c: any) => c.id);
      const sesiuniLucru: any[] = [];
      for (const ids of chunk(comenziIds)) {
        const { data, error } = await supabase
          .from('productie_sesiuni_lucru')
          .select('comanda_id, cantitate_produsa')
          .in('comanda_id', ids)
          .in('status', ['finalizata', 'partial']);
        if (error) throw error;
        sesiuniLucru.push(...(data || []));
      }

      // Calculez cantitatea produsă pentru fiecare comandă
      const cantitateProdusaMap = new Map<string, number>();
      sesiuniLucru.forEach((s: any) => {
        const current = cantitateProdusaMap.get(s.comanda_id) || 0;
        cantitateProdusaMap.set(s.comanda_id, current + Number(s.cantitate_produsa || 0));
      });

      // Nu mai filtrez comenzile neproduse: le arăt pe toate, dar marcate ca „în producție”
      const comenziProduse = comenzi.filter((com: any) => Number(com.cantitate || 0) > 0);

      if (comenziProduse.length === 0) return [] as ComenziDisponibile[];

      // Exclud comenzile deja preluate în picking
      const comenziProduseIds = comenziProduse.map((c: any) => c.id);
      const pickingRows: any[] = [];
      for (const ids of chunk(comenziProduseIds)) {
        const { data, error } = await supabase
          .from('picking_produse')
          .select('sesiune_lucru_id')
          .in('sesiune_lucru_id', ids);
        if (error) throw error;
        pickingRows.push(...(data || []));
      }

      const pickedSet = new Set((pickingRows || []).map((r: any) => r.sesiune_lucru_id));
      const comenziDisponibile = comenziProduse.filter((c: any) => !pickedSet.has(c.id));

      if (comenziDisponibile.length === 0) return [] as ComenziDisponibile[];

      // Încarc detalii de produs separat (nu avem FK declarat)
      const productIds = Array.from(new Set(
        comenziDisponibile.map((c: any) => c.produs_id).filter(Boolean)
      ));
      const produseDetalii: any[] = [];
      for (const ids of chunk(productIds as string[])) {
        const { data, error } = await supabase
          .from('productie_produse')
          .select('id, nume, unitate_masura')
          .in('id', ids);
        if (error) throw error;
        produseDetalii.push(...(data || []));
      }

      const produseMap = new Map<string, { nume: string; unitate_masura: string }>();
      (produseDetalii || []).forEach((p: any) => {
        produseMap.set(p.id, { nume: p.nume, unitate_masura: p.unitate_masura });
      });

      // Grupare pe magazin|punct_livrare (fiecare comandă rămâne separată)
      const grouped = new Map<string, ComenziDisponibile>();
      comenziDisponibile.forEach((com: any) => {
        const zi = (com.data_productie || com.created_at || '').toString().slice(0, 10);
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
        const entry = grouped.get(key)!;
        const det = produseMap.get(com.produs_id) || { nume: 'Produs', unitate_masura: '' };

        const cantitateComanda = Number(com.cantitate || 0);
        const realizat = (cantitateProdusaMap.get(com.id) || 0) + Number(com.cantitate_din_restock || 0);
        const gata = realizat >= cantitateComanda - 1e-6;

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

      const { data, error } = await query;
      if (error) throw error;
      return data as PickingSesiune[];
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
  return useQuery({
    queryKey: ['picking-produse', sesiuneId],
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

      const { data: comenziDetalii, error: comenziErr } = await supabase
        .from('productie_comenzi')
        .select('id, cantitate, cantitate_din_restock')
        .in('id', comandaIds);

      if (comenziErr) throw comenziErr;

      // Cantitatea efectiv produsă pe linie (sesiuni de lucru)
      const sesiuniLucru: any[] = [];
      for (const ids of chunk(comandaIds)) {
        const { data: s, error: sErr } = await supabase
          .from('productie_sesiuni_lucru')
          .select('comanda_id, cantitate_produsa')
          .in('comanda_id', ids)
          .in('status', ['finalizata', 'partial']);
        if (sErr) throw sErr;
        sesiuniLucru.push(...(s || []));
      }
      const produsMap = new Map<string, number>();
      sesiuniLucru.forEach((s: any) => {
        produsMap.set(s.comanda_id, (produsMap.get(s.comanda_id) || 0) + Number(s.cantitate_produsa || 0));
      });

      const map = new Map((comenziDetalii || []).map((c: any) => [c.id, c]));
      const enriched = (data || []).map((p: any) => {
        const c = map.get(p.sesiune_lucru_id);
        const total = Number(c?.cantitate ?? p.cantitate_comandata ?? 0);
        const realizat = (produsMap.get(p.sesiune_lucru_id) || 0) + Number(c?.cantitate_din_restock || 0);
        return {
          ...p,
          cantitate_totala_comanda: c?.cantitate ?? p.cantitate_comandata,
          cantitate_din_restock: c?.cantitate_din_restock ?? 0,
          cantitate_realizata: Math.min(realizat, total),
          gata_productie: realizat >= total - 1e-6,
        };
      });

      return enriched as any[];

    },
    enabled: !!sesiuneId
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
    }) => {
      const { error } = await supabase
        .from('picking_produse')
        .update(params)
        .eq('id', params.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['picking-produse'] });
      toast.success('Produs actualizat');
    },
    onError: (error: Error) => {
      toast.error(`Eroare: ${error.message}`);
    }
  });
};

// Hook pentru finalizarea sesiunii
export const useFinalizareSesiune = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sesiuneId: string) => {
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
      toast.success('Comandă finalizată cu succes! Marfa este pregătită pentru expediere.');
    },
    onError: (error: Error) => {
      toast.error(`Eroare la finalizare: ${error.message}`);
    }
  });
};
