import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";

export interface LineGroupRow {
  linie_id: string;
  grup_nume: string;
}

// Grupele de linii de producție (ex: „Aromate", „Salate") se configurează
// manual din pagina de Linii și sunt stocate în baza Cloud.
export const useLineGroups = () => {
  return useQuery({
    queryKey: ["productie-linii-grupe"],
    queryFn: async () => {
      const { data, error } = await (supabaseCloud as any)
        .from("productie_linii_grupe")
        .select("linie_id, grup_nume");
      if (error) throw error;
      return (data || []) as LineGroupRow[];
    },
  });
};

export const useLineGroupMap = () => {
  const q = useLineGroups();
  const map: Record<string, string> = {};
  (q.data || []).forEach((r) => {
    if (r.grup_nume && r.grup_nume.trim()) map[r.linie_id] = r.grup_nume.trim();
  });
  return { ...q, map };
};

export const useSetLineGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ linieId, grup }: { linieId: string; grup: string }) => {
      const value = (grup || "").trim();
      if (!value) {
        const { error } = await (supabaseCloud as any)
          .from("productie_linii_grupe")
          .delete()
          .eq("linie_id", linieId);
        if (error) throw error;
        return;
      }
      const { error } = await (supabaseCloud as any)
        .from("productie_linii_grupe")
        .upsert({ linie_id: linieId, grup_nume: value }, { onConflict: "linie_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productie-linii-grupe"] });
    },
  });
};
