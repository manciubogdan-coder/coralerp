import React, { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";
import { useInventoryType } from "@/context/inventory-type";
import { persistDateKey, readStoredDateKey, yesterdayKey } from "@/lib/persistentDate";

interface LotRow {
  product_name: string;
  product_code: string;
  lot_number: string;
  unit: string;
  manufacturer_id: string | null;
  manufacturer_name: string;
  pt_percent: number;
  initial_stock: number;
  outbound_quantity: number;
  received_quantity: number;
  final_stock: number;
  current_remaining: number;
}

interface ManualEntry {
  rebut: number;
  pt_real: number;
  cantar: number;
  notes?: string;
}

const emptyEntry: ManualEntry = { rebut: 0, pt_real: 0, cantar: 0, notes: "" };

const storageKeyFor = (invType: string, date: string) =>
  `evidenta-andrada.${invType}.${date}`;

const loadManual = (invType: string, date: string): Record<string, ManualEntry> => {
  try {
    const raw = localStorage.getItem(storageKeyFor(invType, date));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveManual = (invType: string, date: string, data: Record<string, ManualEntry>) => {
  try {
    localStorage.setItem(storageKeyFor(invType, date), JSON.stringify(data));
  } catch {}
};

export const EvidentaAndrada: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const [rows, setRows] = useState<LotRow[]>([]);
  const [manufacturers, setManufacturers] = useState<{ id: string; name: string }[]>([]);
  const [manufacturerFilter, setManufacturerFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState<Record<string, ManualEntry>>({});

  const dateKey = `evidenta-andrada.date.${inventoryType}`;
  const [selectedDate, setSelectedDateState] = useState(() =>
    readStoredDateKey(dateKey, yesterdayKey())
  );

  const setSelectedDate = (v: string) => {
    setSelectedDateState(v);
    persistDateKey(dateKey, v);
  };

  useEffect(() => {
    setManual(loadManual(inventoryType, selectedDate));
  }, [inventoryType, selectedDate]);

  const updateEntry = (lotKey: string, patch: Partial<ManualEntry>) => {
    setManual((prev) => {
      const next = { ...prev, [lotKey]: { ...emptyEntry, ...prev[lotKey], ...patch } };
      saveManual(inventoryType, selectedDate, next);
      return next;
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      if (inventoryType === "ambalaje") {
        setRows([]);
        setLoading(false);
        return;
      }

      const snapshotTable =
        inventoryType === "etichete" ? "etichete_daily_stock_snapshots" : "daily_stock_snapshots";
      const inventoryTable =
        inventoryType === "etichete" ? "etichete_inventory" : "inventory";
      const receptionTable =
        inventoryType === "etichete" ? "etichete_reception_records" : "reception_records";
      const transfersTable =
        inventoryType === "etichete" ? "etichete_stock_transfers" : "stock_transfers";
      const transferItemsTable =
        inventoryType === "etichete" ? "etichete_stock_transfer_items" : "stock_transfer_items";
      const manufacturersTable =
        inventoryType === "etichete" ? "etichete_manufacturers" : "manufacturers";

      // Manufacturers list for filter
      const { data: mfrs } = await supabase
        .from(manufacturersTable)
        .select("id, name")
        .order("name");
      setManufacturers((mfrs || []) as any);

      // Initial stock snapshot
      const { data: initialStock } = await supabase
        .from(snapshotTable)
        .select(`name, lot_number, quantity, unit, product_id, manufacturer_id,
                 products:product_id (name, cod_produs, pt_percent),
                 manufacturers:manufacturer_id (name)`)
        .eq("snapshot_date", selectedDate);

      // Current inventory (final + current remaining)
      const { data: currentInv } = await supabase
        .from(inventoryTable)
        .select(`name, lot_number, quantity, unit, product_id, manufacturer_id,
                 products:product_id (name, cod_produs, pt_percent),
                 manufacturers:manufacturer_id (name)`);

      // Receptions on date
      const { data: receptionRecords } = await supabase
        .from(receptionTable)
        .select("name, lot_number, original_quantity, manufacturer_id")
        .gte("receipt_date", selectedDate)
        .lt("receipt_date", `${selectedDate}T23:59:59`);

      // Transfers on date
      const { data: transfersForDate } = await supabase
        .from(transfersTable)
        .select("id")
        .eq("transfer_date", selectedDate);
      const transferIds = (transfersForDate ?? []).map((t: any) => t.id).filter(Boolean);

      let transferItems: any[] = [];
      if (transferIds.length > 0) {
        const { data: items } = await supabase
          .from(transferItemsTable)
          .select("quantity, inventory_item_id")
          .in("transfer_id", transferIds);
        const invIds = Array.from(
          new Set(((items ?? []) as any[]).map((i: any) => i.inventory_item_id).filter(Boolean))
        );
        const invMap = new Map<string, { name: string; lot_number: string | null }>();
        if (invIds.length > 0) {
          const { data: invRows } = await supabase
            .from(inventoryTable)
            .select("id, name, lot_number")
            .in("id", invIds);
          (invRows ?? []).forEach((r: any) =>
            invMap.set(r.id, { name: r.name, lot_number: r.lot_number ?? null })
          );
        }
        transferItems = ((items ?? []) as any[]).map((it: any) => ({
          ...it,
          inv: invMap.get(it.inventory_item_id) ?? null,
        }));
      }

      const initialMap = new Map<string, number>();
      const finalMap = new Map<string, number>();
      const currentRemainingMap = new Map<string, number>();
      const receiptsMap = new Map<string, number>();
      const outboundMap = new Map<string, number>();
      const meta = new Map<
        string,
        { product_name: string; product_code: string; unit: string; pt_percent: number; manufacturer_id: string | null; manufacturer_name: string }
      >();

      const setMeta = (item: any) => {
        const key = `${item.name}_${item.lot_number || "Fără lot"}`;
        if (!meta.has(key)) {
          meta.set(key, {
            product_name: item.name,
            product_code: item.products?.cod_produs || "",
            unit: item.unit,
            pt_percent: Number(item.products?.pt_percent ?? 0),
            manufacturer_id: item.manufacturer_id ?? null,
            manufacturer_name: item.manufacturers?.name ?? "—",
          });
        } else if (item.manufacturer_id) {
          // Ensure manufacturer info is filled if missing
          const m = meta.get(key)!;
          if (!m.manufacturer_id) {
            m.manufacturer_id = item.manufacturer_id;
            m.manufacturer_name = item.manufacturers?.name ?? m.manufacturer_name;
          }
        }
      };

      (initialStock || []).forEach((it: any) => {
        const key = `${it.name}_${it.lot_number || "Fără lot"}`;
        initialMap.set(key, (initialMap.get(key) || 0) + Number(it.quantity || 0));
        setMeta(it);
      });
      (currentInv || []).forEach((it: any) => {
        const key = `${it.name}_${it.lot_number || "Fără lot"}`;
        const q = Number(it.quantity || 0);
        currentRemainingMap.set(key, (currentRemainingMap.get(key) || 0) + q);
        if (q > 0) finalMap.set(key, (finalMap.get(key) || 0) + q);
        setMeta(it);
      });
      (receptionRecords || []).forEach((r: any) => {
        const key = `${r.name}_${r.lot_number || "Fără lot"}`;
        receiptsMap.set(key, (receiptsMap.get(key) || 0) + Number(r.original_quantity || 0));
      });
      transferItems.forEach((t: any) => {
        if (t.inv?.name) {
          const key = `${t.inv.name}_${t.inv.lot_number || "Fără lot"}`;
          outboundMap.set(key, (outboundMap.get(key) || 0) + Number(t.quantity || 0));
        }
      });

      const allKeys = new Set<string>([
        ...initialMap.keys(),
        ...outboundMap.keys(),
        ...receiptsMap.keys(),
      ]);

      const result: LotRow[] = [];
      allKeys.forEach((key) => {
        const m = meta.get(key);
        if (!m) return;
        const outbound = outboundMap.get(key) || 0;
        const received = receiptsMap.get(key) || 0;
        if (outbound === 0 && received === 0) return;
        const [productName, lotNumber] = key.split("_");
        result.push({
          product_name: productName,
          product_code: m.product_code,
          lot_number: lotNumber,
          unit: m.unit,
          manufacturer_id: m.manufacturer_id,
          manufacturer_name: m.manufacturer_name,
          pt_percent: m.pt_percent,
          initial_stock: initialMap.get(key) || 0,
          outbound_quantity: outbound,
          received_quantity: received,
          final_stock: finalMap.get(key) || 0,
          current_remaining: currentRemainingMap.get(key) || 0,
        });
      });

      result.sort(
        (a, b) =>
          a.product_name.localeCompare(b.product_name) ||
          a.lot_number.localeCompare(b.lot_number)
      );
      setRows(result);
    } catch (err) {
      console.error(err);
      toast({ title: "Eroare", description: "Nu s-au putut încărca datele", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, inventoryType]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (manufacturerFilter !== "all" && (r.manufacturer_id || "none") !== manufacturerFilter)
        return false;
      if (productFilter.trim()) {
        const q = productFilter.toLowerCase();
        if (
          !r.product_name.toLowerCase().includes(q) &&
          !r.product_code.toLowerCase().includes(q) &&
          !r.lot_number.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rows, manufacturerFilter, productFilter]);

  const rowKey = (r: LotRow) => `${r.product_name}||${r.lot_number}`;

  const calc = (r: LotRow) => {
    const entry = manual[rowKey(r)] || emptyEntry;
    const estimated = (r.outbound_quantity * r.pt_percent) / 100;
    const realTotal = (entry.rebut || 0) + (entry.pt_real || 0) + (entry.cantar || 0);
    const diff = realTotal - estimated;
    return { entry, estimated, realTotal, diff };
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast({ title: "Nu există date", variant: "destructive" });
      return;
    }
    const data = filtered.map((r) => {
      const { entry, estimated, realTotal, diff } = calc(r);
      return {
        Produs: r.product_name,
        Cod: r.product_code,
        Lot: r.lot_number,
        Producător: r.manufacturer_name,
        Unitate: r.unit,
        "Stoc Inițial": r.initial_stock,
        "Cant. Ieșită": r.outbound_quantity,
        "Cant. Primită": r.received_quantity,
        "Stoc Final": r.final_stock,
        "Stoc Rămas (real)": r.current_remaining,
        "% PT recepție": r.pt_percent,
        "Pierdere estimată (kg)": estimated,
        Rebut: entry.rebut || 0,
        "Pierdere tehnologică": entry.pt_real || 0,
        "Diferență cântar (±)": entry.cantar || 0,
        "Pierdere reală total": realTotal,
        Diferență: diff,
        Note: entry.notes || "",
      };
    });
    exportToExcel(data, `Evidenta_Andrada_${selectedDate}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Se încarcă evidența...
      </div>
    );
  }

  if (inventoryType === "ambalaje") {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Evidența Andrada nu este disponibilă pentru ambalaje
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          />
        </div>
        <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Producător" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toți producătorii</SelectItem>
            {manufacturers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Caută produs / lot..."
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="w-full sm:w-64"
        />
        <Button onClick={handleExport} variant="outline" size="sm">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
        <div className="text-xs text-muted-foreground ml-auto">
          Datele manuale (rebut / PT / cântar) se salvează local pe zi.
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          Nu există date pentru filtrele selectate
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Produs</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Producător</TableHead>
                <TableHead className="text-right">Stoc Inițial</TableHead>
                <TableHead className="text-right">Ieșit</TableHead>
                <TableHead className="text-right">Primit</TableHead>
                <TableHead className="text-right">Stoc Final</TableHead>
                <TableHead className="text-right">Rămas real</TableHead>
                <TableHead className="text-right">% PT</TableHead>
                <TableHead className="text-right">Est. pierdere</TableHead>
                <TableHead className="text-right w-24">Rebut</TableHead>
                <TableHead className="text-right w-24">PT real</TableHead>
                <TableHead className="text-right w-24">± Cântar</TableHead>
                <TableHead className="text-right">Real total</TableHead>
                <TableHead className="text-right">Diferență</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const key = rowKey(r);
                const { entry, estimated, realTotal, diff } = calc(r);
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <div className="font-medium">{r.product_name}</div>
                      <div className="text-xs text-muted-foreground">{r.product_code}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.lot_number}</TableCell>
                    <TableCell className="text-sm">{r.manufacturer_name}</TableCell>
                    <TableCell className="text-right">{r.initial_stock.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{r.outbound_quantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{r.received_quantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{r.final_stock.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {r.current_remaining.toFixed(2)} {r.unit}
                    </TableCell>
                    <TableCell className="text-right">{r.pt_percent.toFixed(1)}%</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {estimated.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={entry.rebut || ""}
                        onChange={(e) =>
                          updateEntry(key, { rebut: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 text-right w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={entry.pt_real || ""}
                        onChange={(e) =>
                          updateEntry(key, { pt_real: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 text-right w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={entry.cantar || ""}
                        onChange={(e) =>
                          updateEntry(key, { cantar: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 text-right w-20"
                        placeholder="+/-"
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {realTotal.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        Math.abs(diff) < 0.01
                          ? "text-muted-foreground"
                          : diff > 0
                          ? "text-destructive"
                          : "text-green-600"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default EvidentaAndrada;
