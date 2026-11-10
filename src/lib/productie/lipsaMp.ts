import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";

/** Comenzi încheiate din lipsă de materie primă: marcaj păstrat în jurnalul comenzilor (Cloud). */
export const LIPSA_MP_ACTION = "lipsa_mp";

export const markLipsaMp = async (ids: string[]) => {
  if (!ids.length) return;
  await supabaseCloud.from("productie_comenzi_audit").insert({
    table_name: "productie_comenzi", action: LIPSA_MP_ACTION,
    record_ids: ids, comanda_ids: ids, changes: { motiv: "Lipsă materie primă" },
    page_path: typeof window !== "undefined" ? window.location.pathname : null,
  } as any);
};

export const useLipsaMpIds = () =>
  useQuery({
    queryKey: ["lipsa-mp"],
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const since = new Date(Date.now() - 10 * 86400_000).toISOString();
      const ids = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabaseCloud.from("productie_comenzi_audit")
          .select("comanda_ids").eq("action", LIPSA_MP_ACTION).gte("created_at", since)
          .order("id").range(from, from + 999);
        if (error) throw error;
        (data || []).forEach((r: any) => (r.comanda_ids || []).forEach((id: string) => ids.add(String(id))));
        if (!data || data.length < 1000) break;
      }
      return ids;
    },
  });

/** Ore lucrate efectiv: sesiuni închise, suprapunerile de pe aceeași linie contopite. */
export const workedHours = (sessions: { linie_id?: string | null; ora_start: string; ora_sfarsit?: string | null }[]) => {
  const byLine = new Map<string, [number, number][]>();
  for (const s of sessions) {
    if (!s.ora_start || !s.ora_sfarsit) continue;
    const a = new Date(s.ora_start).getTime(), b = new Date(s.ora_sfarsit).getTime();
    if (!(b > a)) continue;
    const k = s.linie_id || "-";
    byLine.set(k, [...(byLine.get(k) || []), [a, b]]);
  }
  let ms = 0;
  for (const list of byLine.values()) {
    list.sort((x, y) => x[0] - y[0]);
    let [cs, ce] = list[0];
    for (const [a, b] of list.slice(1)) {
      if (a <= ce) ce = Math.max(ce, b); else { ms += ce - cs; cs = a; ce = b; }
    }
    ms += ce - cs;
  }
  return ms / 3600_000;
};

export const useOrdersWorkTime = (ids: string[], enabled = true) =>
  useQuery({
    queryKey: ["orders-work-time", [...ids].sort().join(",")],
    enabled: enabled && ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const rows: any[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const { data, error } = await supabase.from("productie_sesiuni_lucru")
          .select("linie_id, ora_start, ora_sfarsit, cantitate_produsa").in("comanda_id", ids.slice(i, i + 50));
        if (error) throw error;
        rows.push(...(data || []));
      }
      const closed = rows.filter(r => r.ora_start && r.ora_sfarsit);
      return { hours: workedHours(closed), pieces: closed.reduce((s, r) => s + Number(r.cantitate_produsa || 0), 0) };
    },
  });
