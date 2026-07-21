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
      const { data, error } = await supabaseCloud
        .from("productie_grupare_ambalare")
        .select("produs_id, grup_nume");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.produs_id] = r.grup_nume; });
      return map;
    },
    staleTime: 60_000,
  });
};
