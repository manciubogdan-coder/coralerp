import React, { useEffect, useMemo, useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ro } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { CalendarIcon, Download, GripVertical, Eye, EyeOff, Loader2 } from "lucide-react";
import * as XLSX from "xlsx-js-style";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useInventoryType } from "@/context/inventory-type";

const getInventoryTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_reception_records";
  if (t === "etichete") return "etichete_reception_records";
  return "reception_records";
};
const getSupplierTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_suppliers";
  if (t === "etichete") return "etichete_suppliers";
  return "suppliers";
};

type ColumnKey =
  | "produs"
  | "unit"
  | "nr_lazi"
  | "lazi_pe_tip"
  | "nr_paleti"
  | "cantitate_receptionata"
  | "cantitate_document"
  | "pierdere_cantitativa"
  | "pierdere_calitativa_pct"
  | "pierdere_calitativa_kg"
  | "nr_documente"
  | "nr_receptii";

const ALL_COLUMNS: { key: ColumnKey; label: string; align?: "left" | "right"; numeric?: boolean; format?: (n: number) => string }[] = [
  { key: "produs", label: "Produs", align: "left" },
  { key: "unit", label: "UM", align: "left" },
  { key: "nr_lazi", label: "Nr. lăzi", align: "right", numeric: true, format: (n) => n.toString() },
  { key: "lazi_pe_tip", label: "Lăzi pe tip", align: "left" },
  { key: "nr_paleti", label: "Nr. paleți", align: "right", numeric: true, format: (n) => n.toString() },
  { key: "cantitate_receptionata", label: "Cant. recepționată", align: "right", numeric: true, format: (n) => n.toFixed(2) },
  { key: "cantitate_document", label: "Cant. document", align: "right", numeric: true, format: (n) => n.toFixed(2) },
  { key: "pierdere_cantitativa", label: "Pierdere cant. (doc − rec)", align: "right", numeric: true, format: (n) => n.toFixed(2) },
  { key: "pierdere_calitativa_pct", label: "Pierdere calit. % (medie pond.)", align: "right", numeric: true, format: (n) => `${n.toFixed(2)}%` },
  { key: "pierdere_calitativa_kg", label: "Pierdere calit. (kg)", align: "right", numeric: true, format: (n) => n.toFixed(2) },
  { key: "nr_documente", label: "Nr. documente", align: "right", numeric: true, format: (n) => n.toString() },
  { key: "nr_receptii", label: "Nr. recepții", align: "right", numeric: true, format: (n) => n.toString() },
];

const DEFAULT_ORDER: ColumnKey[] = ALL_COLUMNS.map((c) => c.key);
const DEFAULT_VISIBLE: ColumnKey[] = ["produs", "unit", "nr_lazi", "lazi_pe_tip", "nr_paleti", "cantitate_receptionata", "cantitate_document", "pierdere_cantitativa", "pierdere_calitativa_pct", "pierdere_calitativa_kg", "nr_documente"];

type Aggregated = {
  product_key: string;
  produs: string;
  unit: string;
  nr_lazi: number;
  lazi_pe_tip: string;
  nr_paleti: number;
  cantitate_receptionata: number;
  cantitate_document: number;
  pierdere_cantitativa: number;
  pierdere_calitativa_pct: number;
  pierdere_calitativa_kg: number;
  nr_documente: number;
  nr_receptii: number;
};

const ReceptionAnalyticsReport: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const { toast } = useToast();

  const dateKey = `receptionAnalytics.range.${inventoryType}`;
  const supplierKey = `receptionAnalytics.supplier.${inventoryType}`;
  const orderKey = `receptionAnalytics.colOrder`;
  const visibleKey = `receptionAnalytics.colVisible`;

  const [range, setRange] = useState<DateRange | undefined>(() => {
    try {
      const saved = localStorage.getItem(dateKey);
      if (saved) {
        const o = JSON.parse(saved);
        return {
          from: o.from ? new Date(o.from) : undefined,
          to: o.to ? new Date(o.to) : undefined,
        };
      }
    } catch {}
    return { from: subDays(new Date(), 30), to: new Date() };
  });
  useEffect(() => {
    try {
      localStorage.setItem(dateKey, JSON.stringify({
        from: range?.from?.toISOString() ?? null,
        to: range?.to?.toISOString() ?? null,
      }));
    } catch {}
  }, [range, dateKey]);

  const [supplierId, setSupplierId] = useState<string>(() => {
    try { return localStorage.getItem(supplierKey) || "__all__"; } catch { return "__all__"; }
  });
  useEffect(() => { try { localStorage.setItem(supplierKey, supplierId); } catch {} }, [supplierId, supplierKey]);

  const [colOrder, setColOrder] = useState<ColumnKey[]>(() => {
    try {
      const s = localStorage.getItem(orderKey);
      if (s) {
        const arr = JSON.parse(s) as ColumnKey[];
        const known = arr.filter((k) => DEFAULT_ORDER.includes(k));
        const missing = DEFAULT_ORDER.filter((k) => !known.includes(k));
        return [...known, ...missing];
      }
    } catch {}
    return DEFAULT_ORDER;
  });
  useEffect(() => { try { localStorage.setItem(orderKey, JSON.stringify(colOrder)); } catch {} }, [colOrder]);

  const [colVisible, setColVisible] = useState<Set<ColumnKey>>(() => {
    try {
      const s = localStorage.getItem(visibleKey);
      if (s) return new Set(JSON.parse(s) as ColumnKey[]);
    } catch {}
    return new Set(DEFAULT_VISIBLE);
  });
  useEffect(() => { try { localStorage.setItem(visibleKey, JSON.stringify(Array.from(colVisible))); } catch {} }, [colVisible]);

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Aggregated[]>([]);

  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);

  // Load suppliers
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from(getSupplierTable(inventoryType))
        .select("id, name")
        .order("name");
      setSuppliers((data as any[]) || []);
    })();
  }, [inventoryType]);

  const loadData = async () => {
    if (!range?.from || !range?.to) {
      toast({ title: "Selectează interval de timp", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const start = format(startOfDay(range.from), "yyyy-MM-dd");
      const end = format(endOfDay(range.to), "yyyy-MM-dd");

      let query = (supabase as any)
        .from(getInventoryTable(inventoryType))
        .select(`id, name, original_quantity, net_quantity, unit, receipt_date, document_number,
                 crate_count, pallet_count, supplier_id, supplier_name, product_id`)
        .gte("receipt_date", start)
        .lte("receipt_date", end);

      if (supplierId !== "__all__") query = query.eq("supplier_id", supplierId);

      // Paginate to bypass 1000-row limit
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        const chunk = (data as any[]) || [];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }

      // Fetch reception_report_data for these inventory_ids
      const invIds = all.map((r) => r.id);
      const reportMap = new Map<string, { cantitate_document: number | null; pierdere_calitativa_procent: number | null }>();
      for (let i = 0; i < invIds.length; i += 50) {
        const slice = invIds.slice(i, i + 50);
        if (slice.length === 0) break;
        const { data } = await (supabase as any)
          .from("reception_report_data")
          .select("inventory_id, cantitate_document, pierdere_calitativa_procent")
          .in("inventory_id", slice);
        ((data || []) as any[]).forEach((r) => reportMap.set(r.inventory_id, r));
      }

      // Aggregate by product (name + unit)
      type Acc = Aggregated & { _docSet: Set<string> };
      const map = new Map<string, Acc>();
      all.forEach((r) => {
        const key = `${r.name}__${r.unit || ""}`;
        let agg = map.get(key);
        if (!agg) {
          agg = {
            product_key: key,
            produs: r.name,
            unit: r.unit || "",
            nr_lazi: 0,
            nr_paleti: 0,
            cantitate_receptionata: 0,
            cantitate_document: 0,
            pierdere_cantitativa: 0,
            pierdere_calitativa_pct: 0,
            pierdere_calitativa_kg: 0,
            nr_documente: 0,
            nr_receptii: 0,
            _docSet: new Set<string>(),
          };
          map.set(key, agg);
        }
        const rec = Number(r.original_quantity ?? r.net_quantity ?? 0);
        agg.cantitate_receptionata += rec;
        agg.nr_lazi += Number(r.crate_count ?? 0);
        agg.nr_paleti += Number(r.pallet_count ?? 0);
        agg.nr_receptii += 1;
        if (r.document_number) agg._docSet.add(String(r.document_number));

        const rep = reportMap.get(r.id);
        const docQty = rep?.cantitate_document != null ? Number(rep.cantitate_document) : 0;
        agg.cantitate_document += docQty;

        const pct = rep?.pierdere_calitativa_procent != null ? Number(rep.pierdere_calitativa_procent) : 0;
        agg.pierdere_calitativa_kg += rec * pct / 100;
      });

      const result: Aggregated[] = [];
      map.forEach((a) => {
        a.nr_documente = a._docSet.size;
        a.pierdere_cantitativa = a.cantitate_document - a.cantitate_receptionata;
        a.pierdere_calitativa_pct = a.cantitate_receptionata > 0
          ? (a.pierdere_calitativa_kg / a.cantitate_receptionata) * 100
          : 0;
        const { _docSet, ...rest } = a;
        result.push(rest);
      });

      result.sort((x, y) => x.produs.localeCompare(y.produs));
      setRows(result);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Eroare la încărcare", description: e?.message || "—", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on filter change
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to, supplierId, inventoryType]);

  const visibleColumns = useMemo(
    () => colOrder.filter((k) => colVisible.has(k)).map((k) => ALL_COLUMNS.find((c) => c.key === k)!).filter(Boolean),
    [colOrder, colVisible]
  );

  const totals = useMemo(() => {
    const t = { nr_lazi: 0, nr_paleti: 0, cantitate_receptionata: 0, cantitate_document: 0, pierdere_cantitativa: 0, pierdere_calitativa_kg: 0, nr_documente: 0, nr_receptii: 0 };
    rows.forEach((r) => {
      t.nr_lazi += r.nr_lazi;
      t.nr_paleti += r.nr_paleti;
      t.cantitate_receptionata += r.cantitate_receptionata;
      t.cantitate_document += r.cantitate_document;
      t.pierdere_cantitativa += r.pierdere_cantitativa;
      t.pierdere_calitativa_kg += r.pierdere_calitativa_kg;
      t.nr_documente += r.nr_documente;
      t.nr_receptii += r.nr_receptii;
    });
    return t;
  }, [rows]);

  const handleDragStart = (key: ColumnKey) => setDragKey(key);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (overKey: ColumnKey) => {
    if (!dragKey || dragKey === overKey) return;
    setColOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragKey);
      const to = next.indexOf(overKey);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragKey);
      return next;
    });
    setDragKey(null);
  };

  const toggleVisible = (key: ColumnKey) => {
    setColVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const exportExcel = () => {
    const supplierName = supplierId === "__all__" ? "Toți furnizorii" : (suppliers.find((s) => s.id === supplierId)?.name || "");
    const header = visibleColumns.map((c) => c.label);
    const data = rows.map((r) => visibleColumns.map((c) => {
      const val = (r as any)[c.key];
      if (c.numeric && typeof val === "number") return Number(val.toFixed(4));
      return val ?? "";
    }));
    const ws = XLSX.utils.aoa_to_sheet([
      [`Raport recepții — ${supplierName}`],
      [`Interval: ${range?.from ? format(range.from, "dd.MM.yyyy") : ""} → ${range?.to ? format(range.to, "dd.MM.yyyy") : ""}`],
      [],
      header,
      ...data,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recepții");
    const fname = `raport-receptii-${inventoryType}-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  return (
    <div className="space-y-4">
      {/* Filtre */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Interval</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal w-[260px]", !range && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {range?.from ? (
                  range.to ? (
                    <>{format(range.from, "dd MMM yyyy", { locale: ro })} – {format(range.to, "dd MMM yyyy", { locale: ro })}</>
                  ) : format(range.from, "dd MMM yyyy", { locale: ro })
                ) : <span>Selectează interval</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={range?.from}
                selected={range}
                onSelect={setRange}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1 min-w-[220px]">
          <Label className="text-xs text-muted-foreground">Furnizor</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="Toți furnizorii" /></SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-y-auto">
              <SelectItem value="__all__">Toți furnizorii</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={loadData} disabled={loading} variant="default">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Reîncarcă
        </Button>
        <Button onClick={exportExcel} disabled={rows.length === 0} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
      </div>

      {/* Configurare coloane — drag & drop + toggle */}
      <Card className="p-3">
        <div className="text-xs font-medium mb-2 text-muted-foreground">
          Coloane (trage pentru a reordona, click pe ochi pentru a ascunde/afișa)
        </div>
        <div className="flex flex-wrap gap-1">
          {colOrder.map((k) => {
            const col = ALL_COLUMNS.find((c) => c.key === k)!;
            const visible = colVisible.has(k);
            return (
              <div
                key={k}
                draggable
                onDragStart={() => handleDragStart(k)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(k)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-move select-none",
                  visible ? "bg-primary/10 border-primary/30" : "bg-muted text-muted-foreground border-muted-foreground/20"
                )}
              >
                <GripVertical className="h-3 w-3 opacity-50" />
                <span>{col.label}</span>
                <button
                  type="button"
                  onClick={() => toggleVisible(k)}
                  className="ml-1 hover:opacity-70"
                  title={visible ? "Ascunde coloana" : "Afișează coloana"}
                >
                  {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Tabel */}
      <Card className="p-0 overflow-x-auto">
        <Table className="text-[12px]">
          <TableHeader>
            <TableRow>
              {visibleColumns.map((c) => (
                <TableHead key={c.key} className={cn("text-[11px]", c.align === "right" && "text-right")}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">
                  Nu există date pentru filtrele selectate.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.product_key}>
                  {visibleColumns.map((c) => {
                    const val = (r as any)[c.key];
                    const isLoss = c.key === "pierdere_cantitativa" || c.key === "pierdere_calitativa_kg" || c.key === "pierdere_calitativa_pct";
                    const negative = isLoss && typeof val === "number" && val < 0;
                    return (
                      <TableCell
                        key={c.key}
                        className={cn(
                          c.align === "right" && "text-right tabular-nums",
                          negative && "text-destructive font-medium"
                        )}
                      >
                        {c.numeric && typeof val === "number" ? c.format!(val) : String(val ?? "")}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                {visibleColumns.map((c, i) => {
                  if (i === 0) return <TableCell key={c.key} className="font-bold">TOTAL</TableCell>;
                  if (!c.numeric) return <TableCell key={c.key} />;
                  const val = (totals as any)[c.key];
                  if (val == null) return <TableCell key={c.key} />;
                  return (
                    <TableCell key={c.key} className={cn("text-right font-bold tabular-nums", c.align === "right" && "text-right")}>
                      {c.format!(val)}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
    </div>
  );
};

export default ReceptionAnalyticsReport;
