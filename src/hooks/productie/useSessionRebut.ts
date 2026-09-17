import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";

export interface SessionRebutRow {
  id: string;
  sesiune_id: string;
  comanda_id: string | null;
  linie_id: string | null;
  linie_nume: string | null;
  cantitate: number;
  motiv: string | null;
  created_at: string;
}

// Rebutul e stocat în baza Cloud (baza operațională nu permite coloane noi).
export const useSessionRebut = () => {
  return useQuery({
    queryKey: ["productie-sesiuni-rebut"],
    queryFn: async () => {
      const rows: SessionRebutRow[] = [];
      const pageSize = 1000;
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabaseCloud
          .from("productie_sesiuni_rebut")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as any[];
        rows.push(
          ...batch.map((r) => ({ ...r, cantitate: Number(r.cantitate || 0) })),
        );
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      return rows;
    },
  });
};

export const useAddSessionRebut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      sesiune_id: string;
      comanda_id?: string | null;
      linie_id?: string | null;
      linie_nume?: string | null;
      cantitate: number;
      motiv?: string | null;
      created_by_email?: string | null;
    }) => {
      const { error } = await supabaseCloud
        .from("productie_sesiuni_rebut")
        .insert({
          sesiune_id: payload.sesiune_id,
          comanda_id: payload.comanda_id ?? null,
          linie_id: payload.linie_id ?? null,
          linie_nume: payload.linie_nume ?? null,
          cantitate: payload.cantitate,
          motiv: payload.motiv ?? null,
          created_by_email: payload.created_by_email ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productie-sesiuni-rebut"] });
    },
  });
};
