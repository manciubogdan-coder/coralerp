import { supabaseCloud } from "@/integrations/supabase/cloudClient";

export const isFolie = (name?: string | null) => /folie|folii/i.test(name || "");

export type TubTip = "receptie" | "transfer" | "retur";

export async function addTubMiscare(row: {
  produs_nume: string;
  product_id?: string | null;
  tip: TubTip;
  role?: number;
  tuburi?: number;
  lot?: string | null;
  document?: string | null;
  furnizor?: string | null;
  observatii?: string | null;
}) {
  let email: string | null = null;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    email = (await supabase.auth.getUser()).data.user?.email ?? null;
  } catch { /* ignore */ }
  const { error } = await supabaseCloud.from("ambalaje_tuburi_miscari").insert({
    ...row,
    role: row.role || 0,
    tuburi: row.tuburi || 0,
    created_by_email: email,
  });
  if (error) throw error;
}

export async function fetchTubMiscari() {
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseCloud
      .from("ambalaje_tuburi_miscari")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}
