import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrders, useProductionLines } from "@/hooks/productie/useProductionData";
import { useUtilajIds } from "@/hooks/productie/useUtilaje";
import { bucharestToday, buildLines, readyByStore, stockByProduct, type VOrder, type VSession } from "@/lib/viziune/factoryState";

const REFRESH = 30_000;

async function readAllRows(build: (from: number, to: number) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function useFactoryData() {
  const today = bucharestToday();
  const linesQ = useProductionLines();
  const ordersQ = useOrders(today);
  const { utilajIds } = useUtilajIds();

  const sessionsQ = useQuery({
    queryKey: ["viziune-sessions"],
    refetchInterval: REFRESH,
    queryFn: async () => {
      const { data, error } = await supabase.from("productie_sesiuni_lucru").select("id, comanda_id, linie_id, nume_operator, numar_angajati, ora_start").eq("status", "activa");
      if (error) throw error;
      return (data || []) as VSession[];
    },
  });

  const stockQ = useQuery({
    queryKey: ["viziune-stock"],
    refetchInterval: REFRESH * 4,
    queryFn: () => readAllRows((a, b) => supabase.from("inventory").select("id, name, quantity, unit, receipt_date, suppliers:supplier_id (name)").gt("quantity", 0).order("id").range(a, b)),
  });

  const receptionsQ = useQuery({
    queryKey: ["viziune-receptions", today],
    refetchInterval: REFRESH * 2,
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory").select("id, name, quantity, unit, receipt_date, document_number, suppliers:supplier_id (name)").gte("receipt_date", today).order("receipt_date", { ascending: false }).limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const orders = ((ordersQ.data as any[]) || []).filter((o: VOrder) => String(o.data_productie || "").slice(0, 10) === today) as VOrder[];
  const lines = ((linesQ.data as any[]) || []).filter((l) => !utilajIds.has(l.id) || /sp[ăa]lat/i.test(l.nume));
  const lineViews = buildLines(lines, orders, sessionsQ.data || []);
  const ready = readyByStore(orders);
  const stock = stockByProduct(stockQ.data || []);
  const receptionsBySupplier = new Map<string, { supplier: string; kg: number; lots: number; products: Set<string> }>();
  for (const r of receptionsQ.data || []) {
    const s = r.suppliers?.name || "Furnizor necunoscut";
    const e = receptionsBySupplier.get(s) ?? { supplier: s, kg: 0, lots: 0, products: new Set<string>() };
    e.kg += Number(r.quantity) || 0; e.lots += 1; if (r.name) e.products.add(r.name);
    receptionsBySupplier.set(s, e);
  }
  const unassigned = orders.filter((o) => !o.linie_id && o.status !== "completed");

  return {
    today,
    loading: linesQ.isLoading || ordersQ.isLoading,
    error: (linesQ.error || ordersQ.error || sessionsQ.error) as Error | null,
    updatedAt: Math.max(ordersQ.dataUpdatedAt || 0, sessionsQ.dataUpdatedAt || 0),
    orders, lineViews, ready, stock, unassigned,
    receptions: [...receptionsBySupplier.values()].sort((a, b) => b.kg - a.kg),
    refetch: () => { ordersQ.refetch(); sessionsQ.refetch(); stockQ.refetch(); receptionsQ.refetch(); },
  };
}
export type FactoryData = ReturnType<typeof useFactoryData>;
