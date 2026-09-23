import { useQuery } from "@tanstack/react-query";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";

/**
 * Utilajele de mentenanță sunt intrări din `productie_linii` marcate ca utilaj
 * (nu linie de producție). Marcajul + detaliile extra stau în Cloud, în
 * `mentenanta_utilaje`. Utilajele nu apar în interfața de operator.
 */
export interface UtilajRow {
  linie_id: string;
  locatie?: string | null;
  observatii?: string | null;
}

export const fetchUtilaje = async (): Promise<UtilajRow[]> => {
  const { data, error } = await (supabaseCloud as any)
    .from("mentenanta_utilaje")
    .select("linie_id, locatie, observatii");
  if (error) throw error;
  return (data || []) as UtilajRow[];
};

export const setUtilaj = async (
  linieId: string,
  isUtilaj: boolean,
  extra?: { locatie?: string | null; observatii?: string | null },
) => {
  if (!isUtilaj) {
    const { error } = await (supabaseCloud as any)
      .from("mentenanta_utilaje")
      .delete()
      .eq("linie_id", linieId);
    if (error) throw error;
    return;
  }
  const { error } = await (supabaseCloud as any)
    .from("mentenanta_utilaje")
    .upsert(
      {
        linie_id: linieId,
        locatie: extra?.locatie ?? null,
        observatii: extra?.observatii ?? null,
      },
      { onConflict: "linie_id" },
    );
  if (error) throw error;
};

export const useUtilaje = () =>
  useQuery({ queryKey: ["mentenanta-utilaje"], queryFn: fetchUtilaje });

/** Set-ul de id-uri care sunt utilaje (de exclus din producție/operator). */
export const useUtilajIds = () => {
  const q = useUtilaje();
  const ids = new Set<string>((q.data || []).map((r) => r.linie_id));
  return { ...q, utilajIds: ids };
};
