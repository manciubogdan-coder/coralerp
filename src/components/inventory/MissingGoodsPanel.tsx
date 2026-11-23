import React, { useEffect, useMemo, useState } from "react";
import { PackageX } from "lucide-react";
import { fetchMissingGoods, type MissingGoodsRow } from "@/lib/prereceptie";

interface Props { inventoryType: string; dateFrom: string; dateTo: string; productFilter: string; refreshKey?: unknown }

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" }); };

/** Goods that were on the supplier documents (pre-reception) but were marked as never arrived. */
export const MissingGoodsPanel: React.FC<Props> = ({ inventoryType, dateFrom, dateTo, productFilter, refreshKey }) => {
  const [rows, setRows] = useState<MissingGoodsRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const from = dateFrom || (!dateTo ? daysAgo(30) : "");
    fetchMissingGoods(inventoryType, from, dateTo)
      .then((r) => { if (active) { setRows(r); setError(null); } })
      .catch((e) => { if (active) setError(e?.message || String(e)); });
    return () => { active = false; };
  }, [inventoryType, dateFrom, dateTo, refreshKey]);

  const shown = useMemo(() => {
    const f = productFilter.trim().toLowerCase();
    return f ? rows.filter((r) => r.product_name.toLowerCase().includes(f)) : rows;
  }, [rows, productFilter]);

  if (error) return <p className="text-sm text-destructive">Lipsurile de marfă nu au putut fi încărcate: {error}</p>;
  if (!shown.length) return null;

  const fmt = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2 print:break-inside-avoid">
      <div className="flex items-center gap-2 font-semibold text-destructive">
        <PackageX className="h-4 w-4" />Trebuia să vină, dar nu a venit ({shown.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-destructive/20">
              <th className="text-left py-1 pr-2">Data</th>
              <th className="text-left py-1 pr-2">Furnizor</th>
              <th className="text-left py-1 pr-2">Doc.</th>
              <th className="text-left py-1 pr-2">Produs</th>
              <th className="text-right py-1 pr-2">Cant. pe acte</th>
              <th className="text-left py-1">Marcat de / motiv</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.lineId} className="border-b border-destructive/10 last:border-0 align-top">
                <td className="py-1 pr-2 whitespace-nowrap">{new Date(r.expected_date || r.missing_at).toLocaleDateString("ro-RO")}</td>
                <td className="py-1 pr-2">{r.supplier_name || "—"}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{r.document_number}</td>
                <td className="py-1 pr-2 font-medium">{r.product_name}{r.manufacturer_name ? ` · ${r.manufacturer_name}` : ""}</td>
                <td className="py-1 pr-2 text-right whitespace-nowrap font-semibold text-destructive">{fmt(r.cantitate_document)} {r.unit || ""}</td>
                <td className="py-1">
                  <span className="text-muted-foreground">{r.missing_by_email || "—"}</span>
                  {r.missing_reason && <span className="block italic">{r.missing_reason}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
