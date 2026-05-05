import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SablonItem {
  id: string;
  sablon_id: string;
  produs_id: string;
  observatie_default: string | null;
  cantitate_default: number | null;
  linie_id: string | null;
  pozitie: number;
  productie_produse?: { id: string; nume: string; unitate_masura: string };
}

export interface Sablon {
  id: string;
  nume: string;
  descriere: string | null;
  created_at: string;
  productie_sabloane_items?: SablonItem[];
}

export const useSabloane = () => {
  return useQuery({
    queryKey: ["productie-sabloane"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("productie_sabloane")
        .select(
          `*, productie_sabloane_items(*, productie_produse(id, nume, unitate_masura))`
        )
        .order("nume");
      if (error) throw error;
      // sortează items după pozitie
      return (data || []).map((s: any) => ({
        ...s,
        productie_sabloane_items: (s.productie_sabloane_items || []).sort(
          (a: any, b: any) => (a.pozitie || 0) - (b.pozitie || 0)
        ),
      })) as Sablon[];
    },
  });
};

export const useCreateSablon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nume: string; descriere?: string }) => {
      const { data, error } = await (supabase as any)
        .from("productie_sabloane")
        .insert([{ nume: input.nume, descriere: input.descriere || null }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productie-sabloane"] }),
  });
};

export const useUpdateSablon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; nume?: string; descriere?: string }) => {
      const { error } = await (supabase as any)
        .from("productie_sabloane")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productie-sabloane"] }),
  });
};

export const useDeleteSablon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("productie_sabloane")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productie-sabloane"] }),
  });
};

export const useUpsertSablonItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      id?: string;
      sablon_id: string;
      produs_id: string;
      observatie_default?: string | null;
      cantitate_default?: number | null;
      linie_id?: string | null;
      pozitie?: number;
    }) => {
      if (item.id) {
        const { error } = await (supabase as any)
          .from("productie_sabloane_items")
          .update({
            observatie_default: item.observatie_default ?? null,
            cantitate_default: item.cantitate_default ?? null,
            linie_id: item.linie_id ?? null,
            pozitie: item.pozitie ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("productie_sabloane_items")
          .upsert(
            [
              {
                sablon_id: item.sablon_id,
                produs_id: item.produs_id,
                observatie_default: item.observatie_default ?? null,
                cantitate_default: item.cantitate_default ?? null,
                linie_id: item.linie_id ?? null,
                pozitie: item.pozitie ?? 0,
              },
            ],
            { onConflict: "sablon_id,produs_id" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productie-sabloane"] }),
  });
};

export const useDeleteSablonItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("productie_sabloane_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productie-sabloane"] }),
  });
};
