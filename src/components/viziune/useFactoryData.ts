import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { argusFetch } from "@/lib/argusApi";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useOrders, useProductionLines } from "@/hooks/productie/useProductionData";
import { useUtilajIds } from "@/hooks/productie/useUtilaje";
import { bucharestToday, buildLines, isOpenSession, pendingPrereceptions, readyByStore, stockByProduct, type VOrder, type VSession } from "@/lib/viziune/factoryState";
import { defaultLayout, placementOf, validateHallLayout, type HallStation, type StationOverrides } from "@/lib/viziune/hallLayout";

// Old per-browser choices, used only until someone saves the hall layout for everyone.
const LAYOUT_KEY = "viziune-hala-linii";
const readOverrides = (): StationOverrides => { try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}") || {}; } catch { return {}; } };

const REFRESH = 30_000;
const shiftDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

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

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const cache = useQueryClient();
  const layoutQ = useQuery({
    queryKey: ["viziune-hala-layout"],
    queryFn: async () => {
      const { data, error } = await supabaseCloud.from("viziune_hala_layout").select("stations, updated_by, updated_at").maybeSingle();
      if (error) throw error;
      return data as { stations: unknown; updated_by: string | null; updated_at: string } | null;
    },
  });
  const saveLayoutM = useMutation({
    mutationFn: (stations: HallStation[]) => argusFetch<{ stations: HallStation[] }>("viziune_layout_save", {}, { stations }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["viziune-hala-layout"] }),
  });

  // Open sessions (whatever day they started) plus everything started since yesterday, so worked time
  // of orders paused and resumed today is counted.
  const sessionsQ = useQuery({
    queryKey: ["viziune-sessions", today],
    refetchInterval: REFRESH,
    queryFn: () => readAllRows((a, b) => supabase.from("productie_sesiuni_lucru")
      .select("id, comanda_id, linie_id, nume_operator, numar_angajati, ora_start, ora_sfarsit, cantitate_produsa, status")
      .or(`status.eq.activa,ora_start.gte.${shiftDays(today, -1)}T00:00:00Z`).order("id").range(a, b)) as Promise<VSession[]>,
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

  const preQ = useQuery({
    queryKey: ["viziune-prereceptii", today],
    refetchInterval: REFRESH * 2,
    queryFn: async () => {
      const { data, error } = await supabaseCloud.from("prereceptii")
        .select("id, document_number, supplier_name, expected_date, status, linii:prereceptie_linii(product_name, cantitate_document, unit, received_at)")
        .eq("inventory_type", "materii-prime").neq("status", "receptionata").lte("expected_date", today).gte("expected_date", shiftDays(today, -7)).limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const sessions = sessionsQ.data || [];
  const openOrderIds = new Set(sessions.filter(isOpenSession).map((s) => s.comanda_id));
  // Today's orders, plus any order still being worked on even if it was planned for another day.
  const orders = ((ordersQ.data as any[]) || []).filter((o: VOrder) => String(o.data_productie || "").slice(0, 10) === today || openOrderIds.has(o.id)) as VOrder[];
  const lines = ((linesQ.data as any[]) || []).filter((l) => !utilajIds.has(l.id) || /sp[ăa]lat/i.test(l.nume));
  const lineViews = buildLines(lines, orders, sessions, now);
  let saved: HallStation[] | null = null;
  try { saved = layoutQ.data ? validateHallLayout(layoutQ.data.stations) : null; } catch { saved = null; }
  const layout = saved ?? defaultLayout(lines, readOverrides());
  const placement = placementOf(layout, lines);
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
    now, orders, lineViews, ready, stock, unassigned, layout, placement,
    lines: lines as { id: string; nume: string }[],
    layoutLoading: layoutQ.isLoading,
    layoutInfo: saved && layoutQ.data ? { by: layoutQ.data.updated_by, at: layoutQ.data.updated_at } : null,
    saveLayout: saveLayoutM.mutateAsync, savingLayout: saveLayoutM.isPending,
    prereceptions: pendingPrereceptions(preQ.data || [], today),
    receptions: [...receptionsBySupplier.values()].sort((a, b) => b.kg - a.kg),
    refetch: () => { ordersQ.refetch(); sessionsQ.refetch(); stockQ.refetch(); receptionsQ.refetch(); preQ.refetch(); },
  };
}
export type FactoryData = ReturnType<typeof useFactoryData>;
