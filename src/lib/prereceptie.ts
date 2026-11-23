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
  missing_at?: string | null;
  missing_by_email?: string | null;
  missing_reason?: string | null;
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

type StatusLine = Pick<PrereceptieLinie, "received_at"> & { missing_at?: string | null };

/** A line is closed when it was received or marked as goods that never arrived. */
export const isLineClosed = (l: StatusLine) => !!l.received_at || !!l.missing_at;
export const isLineMissing = (l: StatusLine) => !l.received_at && !!l.missing_at;

/** Statuses that need no more unloading (closed documents). */
export const CLOSED_STATUSES = ["receptionata", "lipsa"] as const;
export const isClosedStatus = (s: string) => (CLOSED_STATUSES as readonly string[]).includes(s);

export const computeStatus = (linii: StatusLine[]) => {
  if (!linii.length) return "asteptare";
  const done = linii.filter(isLineClosed).length;
  if (done === 0) return "asteptare";
  if (done < linii.length) return "partial";
  return linii.some(isLineMissing) ? "lipsa" : "receptionata";
};

export async function currentEmail() {
  try {
    return (await supabase.auth.getUser()).data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function fetchPrereceptii(inventoryType: string, onlyOpen = false, signal?: AbortSignal): Promise<Prereceptie[]> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 20000);
  const rows: any[] = [];
  try {
  while (true) {
  let q = supabaseCloud
    .from("prereceptii")
    .select("*, linii:prereceptie_linii(*)")
    .eq("inventory_type", inventoryType)
    .order("expected_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(rows.length, rows.length + 499)
    .abortSignal(controller.signal);
  if (onlyOpen) q = q.not("status", "in", `(${CLOSED_STATUSES.join(",")})`);
  const { data, error } = await q;
  if (error) throw error;
  const page = (data as any[]) || [];
  rows.push(...page);
  if (page.length < 500) break;
  }
  return rows.map((p) => ({
    ...p,
    linii: ((p.linii || []) as PrereceptieLinie[]).sort((a, b) => a.position - b.position),
  }));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
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

/** Mark a not-yet-received line as goods that appear on the documents but never arrived. */
export async function markLineMissing(lineId: string, prereceptieId: string, reason: string | null) {
  const email = await currentEmail();
  const { error } = await supabaseCloud
    .from("prereceptie_linii")
    .update({ missing_at: new Date().toISOString(), missing_by_email: email, missing_reason: reason?.trim() || null })
    .eq("id", lineId)
    .is("received_at", null);
  if (error) throw error;
  await refreshPrereceptieStatus(prereceptieId);
}

export async function undoLineMissing(lineId: string, prereceptieId: string) {
  const { error } = await supabaseCloud
    .from("prereceptie_linii")
    .update({ missing_at: null, missing_by_email: null, missing_reason: null })
    .eq("id", lineId);
  if (error) throw error;
  await refreshPrereceptieStatus(prereceptieId);
}

export interface MissingGoodsRow {
  lineId: string;
  prereceptieId: string;
  document_number: string;
  supplier_name: string | null;
  expected_date: string | null;
  product_name: string;
  manufacturer_name: string | null;
  cantitate_document: number;
  unit: string | null;
  missing_at: string;
  missing_by_email: string | null;
  missing_reason: string | null;
}

/** Goods announced on documents that were marked as not arrived, by expected date (fallback: marking day). */
export async function fetchMissingGoods(inventoryType: string, from: string, to: string): Promise<MissingGoodsRow[]> {
  const out: MissingGoodsRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseCloud
      .from("prereceptie_linii")
      .select("id, prereceptie_id, product_name, manufacturer_name, cantitate_document, unit, missing_at, missing_by_email, missing_reason, received_at, p:prereceptii!inner(document_number, supplier_name, expected_date, inventory_type)")
      .eq("p.inventory_type", inventoryType)
      .not("missing_at", "is", null)
      .is("received_at", null)
      .order("missing_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    const page = (data as any[]) || [];
    for (const r of page) {
      const day = r.p?.expected_date || String(r.missing_at).slice(0, 10);
      if ((from && day < from) || (to && day > to)) continue;
      out.push({
        lineId: r.id, prereceptieId: r.prereceptie_id, document_number: r.p?.document_number || "",
        supplier_name: r.p?.supplier_name ?? null, expected_date: r.p?.expected_date ?? null,
        product_name: r.product_name, manufacturer_name: r.manufacturer_name, cantitate_document: Number(r.cantitate_document) || 0,
        unit: r.unit, missing_at: r.missing_at, missing_by_email: r.missing_by_email, missing_reason: r.missing_reason,
      });
    }
    if (page.length < 500) break;
    offset += 500;
  }
  return out;
}

export const STATUS_LABEL: Record<string, string> = {
  asteptare: "În așteptare",
  partial: "Parțial recepționată",
  receptionata: "Recepționată",
  lipsa: "Închisă cu lipsă marfă",
};
