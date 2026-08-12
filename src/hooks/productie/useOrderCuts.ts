import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";

export interface OrderCut {
  comanda_id: string;
  cantitate_taiata: number;
  motiv: string | null;
  produs_nume: string | null;
}

export const ORDER_CUTS_KEY = ["productie-order-cuts"];

/** Tăierile de cantitate aplicate comenzilor (stocate în Cloud DB). */
export const useOrderCuts = () => {
  return useQuery({
    queryKey: ORDER_CUTS_KEY,
    queryFn: async () => {
      const all: OrderCut[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabaseCloud
          .from("productie_order_cuts")
          .select("comanda_id, cantitate_taiata, motiv, produs_nume")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as any[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const map = new Map<string, OrderCut>();
      all.forEach((c) => map.set(c.comanda_id, { ...c, cantitate_taiata: Number(c.cantitate_taiata) || 0 }));
      return map;
    },
    staleTime: 30_000,
  });
};

export const useSetOrderCut = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      cuts: { comanda_id: string; cantitate_taiata: number; motiv?: string | null; produs_nume?: string | null }[]
    ) => {
      const toDelete = cuts.filter((c) => !c.cantitate_taiata || c.cantitate_taiata <= 0).map((c) => c.comanda_id);
      const toUpsert = cuts
        .filter((c) => c.cantitate_taiata > 0)
        .map((c) => ({
          comanda_id: c.comanda_id,
          cantitate_taiata: c.cantitate_taiata,
          motiv: c.motiv ?? null,
          produs_nume: c.produs_nume ?? null,
        }));
      if (toDelete.length) {
        const { error } = await supabaseCloud.from("productie_order_cuts").delete().in("comanda_id", toDelete);
        if (error) throw error;
      }
      if (toUpsert.length) {
        const { error } = await supabaseCloud
          .from("productie_order_cuts")
          .upsert(toUpsert as any, { onConflict: "comanda_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDER_CUTS_KEY });
      qc.invalidateQueries({ queryKey: ["consumption-analytics"] });
      qc.invalidateQueries({ queryKey: ["planner-orders"] });
    },
  });
};

/** Împarte proporțional o cantitate de tăiat peste mai multe comenzi. */
export const distributeCut = (
  orders: { id: string; cantitate: number }[],
  totalCut: number
): Record<string, number> => {
  const total = orders.reduce((s, o) => s + (Number(o.cantitate) || 0), 0);
  const result: Record<string, number> = {};
  if (total <= 0 || totalCut <= 0) {
    orders.forEach((o) => (result[o.id] = 0));
    return result;
  }
  const cut = Math.min(totalCut, total);
  let rest = cut;
  orders.forEach((o, i) => {
    const qty = Number(o.cantitate) || 0;
    let part = i === orders.length - 1 ? rest : Math.min(qty, Math.round((qty / total) * cut));
    part = Math.max(0, Math.min(part, qty, rest));
    result[o.id] = part;
    rest -= part;
  });
  // dacă a rămas rest nedistribuit (din rotunjiri), îl punem unde mai e loc
  if (rest > 0) {
    for (const o of orders) {
      const qty = Number(o.cantitate) || 0;
      const can = qty - (result[o.id] || 0);
      if (can <= 0) continue;
      const add = Math.min(can, rest);
      result[o.id] += add;
      rest -= add;
      if (rest <= 0) break;
    }
  }
  return result;
};
