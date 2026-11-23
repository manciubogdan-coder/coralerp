import type { MissingLine } from "../../supabase/functions/_shared/prereceptieMissing";
import { missingNote } from "../../supabase/functions/_shared/prereceptieMissing";

type HistoryRow = {
  id: string;
  receipt_date: string;
  document_number?: string | null;
  supplier_id?: string | null;
  suppliers?: { name: string } | null;
  [k: string]: any;
};

const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase().replace(/\s+/g, "");
const dayOf = (d: string) => (d || "").slice(0, 10);

/** Reception-history row for goods on the documents that never arrived. */
export function missingHistoryRow(m: MissingLine) {
  const unit = m.unit || "kg";
  return {
    id: `missing-${m.lineId}`,
    entry_number: 0,
    receipt_date: m.day,
    name: m.product_name,
    quantity: 0,
    unit,
    document_number: m.document_number,
    lot_number: "",
    supplier_id: m.supplier_id ?? undefined,
    manufacturer_id: m.manufacturer_id ?? undefined,
    product_id: m.product_id ?? undefined,
    suppliers: { name: m.supplier_name || "" },
    manufacturers: { name: m.manufacturer_name || "" },
    obs: `LIPSĂ — ${missingNote(m.missing_reason)} (pe acte ${m.cantitate_document} ${unit})`,
    operator: m.missing_by_email || "",
    consider_quantity: 0,
    nonconform_percent: 0,
    is_missing: true,
    missing_doc_qty: m.cantitate_document,
  };
}

/**
 * Inserts missing-goods rows right after the receipts of the same document (newest-first list);
 * documents with nothing received go at their day.
 */
export function withMissingGoods<T extends HistoryRow>(rows: T[], missing: MissingLine[]): (T | ReturnType<typeof missingHistoryRow>)[] {
  const out: (T | ReturnType<typeof missingHistoryRow>)[] = [...rows];
  for (const m of missing) {
    const row = missingHistoryRow(m);
    const ids = new Set(m.receivedInventoryIds);
    const doc = norm(m.document_number);
    const sameDoc = (r: HistoryRow) => !(r as any).is_missing && (ids.has(r.id) || (!!doc && norm(r.document_number) === doc &&
      ((m.supplier_id && r.supplier_id === m.supplier_id) || norm(r.suppliers?.name) === norm(m.supplier_name))));
    let last = -1;
    out.forEach((r, i) => { if (sameDoc(r as HistoryRow)) last = i; });
    if (last >= 0) {
      // keep after other missing rows already attached to this document
      let at = last + 1;
      while (at < out.length && (out[at] as any).is_missing && norm(out[at].document_number) === doc) at++;
      out.splice(at, 0, row);
      continue;
    }
    const at = out.findIndex((r) => dayOf(r.receipt_date) < m.day);
    if (at < 0) out.push(row); else out.splice(at, 0, row);
  }
  return out;
}
