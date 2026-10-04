import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { supabase } from "@/integrations/supabase/client";
import type { BreakdownEntry } from "@/lib/receptionBreakdown";

export interface PrereceptieLinie {
  id: string;
  prereceptie_id: string;
  position: number;
  product_id: string | null;
  product_name: string;
  manufacturer_id: string | null;
  manufacturer_name: string | null;
  cantitate_document: number;
  unit: string | null;
  pallets: BreakdownEntry[];
  crates: BreakdownEntry[];
  received_quantity: number | null;
  received_inventory_id: string | null;
  received_at: string | null;
  received_by_email: string | null;
}

export interface Prereceptie {
  id: string;
  inventory_type: string;
  document_number: string;
  expected_date: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  status: string;
  notes: string | null;
  created_by_email: string | null;
  created_at: string;
  linii: PrereceptieLinie[];
}

export const breakdownText = (rows: BreakdownEntry[] | null | undefined) =>
  (rows || []).filter((r) => r && Number(r.count) > 0).map((r) => `${r.count} ${r.name}`).join(" + ");

export const computeStatus = (linii: PrereceptieLinie[]) => {
  if (!linii.length) return "asteptare";
  const done = linii.filter((l) => l.received_at).length;
  if (done === 0) return "asteptare";
  return done === linii.length ? "receptionata" : "partial";
};

export async function currentEmail() {
  try {
    return (await supabase.auth.getUser()).data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function fetchPrereceptii(inventoryType: string, onlyOpen = false): Promise<Prereceptie[]> {
  let q = supabaseCloud
    .from("prereceptii")
    .select("*, linii:prereceptie_linii(*)")
    .eq("inventory_type", inventoryType)
    .order("expected_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (onlyOpen) q = q.neq("status", "receptionata");
  const { data, error } = await q;
  if (error) throw error;
  return ((data as any[]) || []).map((p) => ({
    ...p,
    linii: ((p.linii || []) as PrereceptieLinie[]).sort((a, b) => a.position - b.position),
  }));
}

export async function refreshPrereceptieStatus(prereceptieId: string) {
  const { data } = await supabaseCloud.from("prereceptie_linii").select("*").eq("prereceptie_id", prereceptieId);
  const status = computeStatus((data as PrereceptieLinie[]) || []);
  await supabaseCloud.from("prereceptii").update({ status }).eq("id", prereceptieId);
}

export async function markLineReceived(lineId: string, prereceptieId: string, quantity: number, inventoryId: string | null) {
  const email = await currentEmail();
  const { error } = await supabaseCloud
    .from("prereceptie_linii")
    .update({
      received_quantity: quantity,
      received_inventory_id: inventoryId,
      received_at: new Date().toISOString(),
      received_by_email: email,
    })
    .eq("id", lineId);
  if (error) throw error;
  await refreshPrereceptieStatus(prereceptieId);
}

export const STATUS_LABEL: Record<string, string> = {
  asteptare: "În așteptare",
  partial: "Parțial recepționată",
  receptionata: "Recepționată",
};
