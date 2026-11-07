import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SpeedSession } from "@/lib/productie/lineSpeed";

const PAGE = 1000;
const ID_BATCH = 50;

/** Sesiunile pornite în interval (paginat) + numele produsului pe comandă. */
export const useLineSpeedData = (from?: Date, to?: Date) => {
  const start = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()) : undefined;
  const endDay = to ?? from;
  const end = endDay ? new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1) : undefined;

  return useQuery({
    queryKey: ["line-speed", start?.toISOString(), end?.toISOString()],
    enabled: !!start && !!end,
    queryFn: async () => {
      const sessions: SpeedSession[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await supabase
          .from("productie_sesiuni_lucru")
          .select("id, comanda_id, linie_id, nume_operator, numar_angajati, ora_start, ora_sfarsit, cantitate_produsa, status")
          .gte("ora_start", start!.toISOString())
          .lt("ora_start", end!.toISOString())
          .order("id")
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        sessions.push(...((data || []) as SpeedSession[]));
        if (!data || data.length < PAGE) break;
      }

      const ids = [...new Set(sessions.map(s => s.comanda_id).filter((x): x is string => !!x))];
      const products = new Map<string, string>();
      for (let i = 0; i < ids.length; i += ID_BATCH) {
        const { data, error } = await supabase
          .from("productie_comenzi")
          .select("id, productie_produse(nume)")
          .in("id", ids.slice(i, i + ID_BATCH));
        if (error) throw error;
        (data as any[] || []).forEach(o => products.set(o.id, o.productie_produse?.nume || "Produs necunoscut"));
      }
      return { sessions, products };
    },
  });
};
