import { useQuery } from "@tanstack/react-query";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";

export interface GrupareRow {
  produs_id: string;
  grup_nume: string;
}

export const useGrupareAmbalare = () => {
  return useQuery({
    queryKey: ["productie_grupare_ambalare"],
    queryFn: async () => {
      const map: Record<string, string> = {};
      let from = 0;
      while (true) {
        const { data, error } = await supabaseCloud.from("productie_grupare_ambalare")
          .select("produs_id, grup_nume").order('produs_id').range(from, from + 999);
        if (error) throw error;
        (data || []).forEach((r: any) => { map[r.produs_id] = r.grup_nume; });
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return map;
    },
    staleTime: 60_000,
  });
};
