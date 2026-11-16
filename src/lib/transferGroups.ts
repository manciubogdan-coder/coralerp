/**
 * Un bon de transfer scade un lot din toate intrările lui în stoc (FIFO), așa că în baza de date
 * același produs+lot poate avea mai multe rânduri. Pentru om e o singură scoatere: le unim la afișare.
 */
export interface TransferPart {
  transfer_id: string;
  inventory_item_id: string;
  product_name: string;
  lot_number?: string;
  supplier_name?: string;
  manufacturer_name?: string;
  document_number?: string;
  unit: string;
  quantity: number;
  net_quantity?: number;
  created_at?: string;
}

export type GroupedTransfer<T extends TransferPart> = T & { parts: T[] };

const round = (n: number) => Math.round(n * 1000) / 1000;

export function groupTransferParts<T extends TransferPart>(rows: T[]): GroupedTransfer<T>[] {
  const groups = new Map<string, GroupedTransfer<T>>();
  for (const r of rows) {
    const key = [r.transfer_id, r.product_name, r.lot_number || "", r.supplier_name || "", r.manufacturer_name || "", r.unit].join("|");
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { ...r, parts: [r] });
      continue;
    }
    g.parts.push(r);
    g.quantity = round(Number(g.quantity || 0) + Number(r.quantity || 0));
    if (g.net_quantity != null || r.net_quantity != null) {
      g.net_quantity = round(Number(g.net_quantity ?? 0) + Number(r.net_quantity ?? r.quantity ?? 0));
    }
    const docs = new Set((g.document_number || "").split(", ").filter(Boolean));
    if (r.document_number) docs.add(r.document_number);
    g.document_number = [...docs].join(", ");
  }
  return [...groups.values()];
}

/**
 * Împarte o cantitate returnată pe rândurile unui transfer unit: întâi pe cel scos ultimul,
 * ca intrările cele mai vechi să rămână consumate (bonul scade FIFO).
 */
export function splitReturn<T extends TransferPart>(parts: T[], returned: number): { part: T; qty: number }[] {
  const out: { part: T; qty: number }[] = [];
  let left = round(returned);
  for (const part of [...parts].reverse()) {
    if (left <= 0) break;
    const has = Number(part.net_quantity ?? part.quantity ?? 0);
    const qty = round(Math.min(has, left));
    if (qty <= 0) continue;
    out.push({ part, qty });
    left = round(left - qty);
  }
  return out;
}
