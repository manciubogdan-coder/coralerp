// Goods on a pre-reception's documents that were marked as never arrived ("lipsă marfă").
// Shared by the reception report, reception history and the supplier quality emails,
// so a missing line lands on the same day and the same document everywhere.

export interface MissingSibling { received_at: string | null; received_inventory_id: string | null }

export interface MissingLine {
  lineId: string;
  prereceptieId: string;
  document_number: string;
  supplier_id: string | null;
  supplier_name: string | null;
  expected_date: string | null;
  product_id: string | null;
  product_name: string;
  manufacturer_id: string | null;
  manufacturer_name: string | null;
  cantitate_document: number;
  unit: string | null;
  missing_at: string;
  missing_by_email: string | null;
  missing_reason: string | null;
  /** Reception records created from the other lines of the same pre-reception. */
  receivedInventoryIds: string[];
  /** Bucharest day the missing goods belong to (see missingGoodsDay). */
  day: string;
}

/** Select for prereceptie_linii returning everything toMissingLine needs. */
export const MISSING_LINE_SELECT =
  "id, prereceptie_id, product_id, product_name, manufacturer_id, manufacturer_name, cantitate_document, unit, missing_at, missing_by_email, missing_reason, received_at, " +
  "p:prereceptii!inner(document_number, supplier_id, supplier_name, expected_date, inventory_type, linii:prereceptie_linii(received_at, received_inventory_id))";

export const bucharestDay = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });

/**
 * The day the missing goods belong to: the day the rest of that document was received
 * (latest receipt), else the announced delivery day, else the day it was marked missing.
 */
export function missingGoodsDay(expectedDate: string | null, missingAt: string, siblings: MissingSibling[]): string {
  const received = siblings.map((s) => s.received_at).filter((v): v is string => !!v).map(bucharestDay).sort();
  if (received.length) return received[received.length - 1];
  if (expectedDate) return expectedDate.slice(0, 10);
  return bucharestDay(missingAt);
}

export function toMissingLine(r: any): MissingLine {
  const siblings: MissingSibling[] = (r.p?.linii || []).filter((s: any) => s && s.received_at);
  return {
    lineId: r.id, prereceptieId: r.prereceptie_id, document_number: r.p?.document_number || "",
    supplier_id: r.p?.supplier_id ?? null, supplier_name: r.p?.supplier_name ?? null, expected_date: r.p?.expected_date ?? null,
    product_id: r.product_id ?? null, product_name: r.product_name, manufacturer_id: r.manufacturer_id ?? null,
    manufacturer_name: r.manufacturer_name ?? null, cantitate_document: Number(r.cantitate_document) || 0, unit: r.unit ?? null,
    missing_at: r.missing_at, missing_by_email: r.missing_by_email ?? null, missing_reason: r.missing_reason ?? null,
    receivedInventoryIds: siblings.map((s) => s.received_inventory_id).filter((v): v is string => !!v),
    day: missingGoodsDay(r.p?.expected_date ?? null, r.missing_at, siblings),
  };
}

/** Wide window on missing_at around the wanted days (goods may be marked days before/after the truck). */
export const missingWindow = (from: string, to: string, days = 60) => {
  const shift = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  return { from: from ? shift(from, -days) : "", to: to ? shift(to, days + 1) : "" };
};

/** Text shown with the line (also sent to the supplier): never internal e-mails. */
export const missingNote = (reason: string | null | undefined) => {
  const r = (reason || "").trim();
  return r ? `Nu a venit: ${r}` : "Nu a venit";
};

const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase().replace(/\s+/g, "");

type GroupLike = { supplierId: string | null; supplierName: string; documentNumber: string; rows: { inventory_id: string }[] };

/**
 * The reception document a missing line belongs to: the document that holds the receipts of the
 * same pre-reception; else the same document number (same supplier, or the only such document).
 */
export function matchMissingGroup<G extends GroupLike>(groups: G[], line: Pick<MissingLine, "receivedInventoryIds" | "document_number" | "supplier_id" | "supplier_name">): G | null {
  const ids = new Set(line.receivedInventoryIds);
  if (ids.size) {
    const byReceipt = groups.find((g) => g.rows.some((r) => ids.has(r.inventory_id)));
    if (byReceipt) return byReceipt;
  }
  const doc = norm(line.document_number);
  if (!doc) return null;
  const sameDoc = groups.filter((g) => norm(g.documentNumber) === doc);
  const sameSupplier = sameDoc.find((g) =>
    (line.supplier_id && g.supplierId === line.supplier_id) || (line.supplier_name && norm(g.supplierName) === norm(line.supplier_name)));
  if (sameSupplier) return sameSupplier;
  return sameDoc.length === 1 ? sameDoc[0] : null;
}
