import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, FileDown, Truck } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, addDays } from "date-fns";
import { ro } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import CreateSupplierOrderDialog, { OrderLineInput } from "./CreateSupplierOrderDialog";

interface Props {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
  searchTerm?: string;
}

// 0 = Luni ... 6 = Duminică
const WEEKDAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];
const isoDay = (d: Date) => (d.getDay() + 6) % 7;

interface Row {
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit: string;
  total: number;
  perDayTotals: number[];
  perDayAvg: number[];
  stock: number;
  avgDaily: number;
  coverDays: number | null;
  coverDate: Date | null;
  leadTime: number;
  suggestedQty: number;
}


const WeekdayConsumption: React.FC<Props> = ({ inventoryType, searchTerm = "" }) => {
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [dayCounts, setDayCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [loading, setLoading] = useState(false);

  const getTableNames = () => {
    switch (inventoryType) {
      case "ambalaje":
        return {
          products: "ambalaje_products" as const,
          transfers: "ambalaje_stock_transfer_items" as const,
          transfersMain: "ambalaje_stock_transfers" as const,
          inventory: "ambalaje_inventory" as const,
        };
      case "etichete":
        return {
          products: "etichete_products" as const,
          transfers: "etichete_stock_transfer_items" as const,
          transfersMain: "etichete_stock_transfers" as const,
          inventory: "etichete_inventory" as const,
        };
      default:
        return {
          products: "products" as const,
          transfers: "stock_transfer_items" as const,
          transfersMain: "stock_transfers" as const,
          inventory: "inventory" as const,
        };
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const tables = getTableNames();
      const tz = "Europe/Bucharest";
      const isTimestampRange = inventoryType === "etichete";
      const from = startOfDay(fromDate);
      const to = endOfDay(toDate);
      const fromStr = isTimestampRange
        ? formatInTimeZone(from, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(from, "yyyy-MM-dd");
      const toStr = isTimestampRange
        ? formatInTimeZone(to, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
        : format(to, "yyyy-MM-dd");

      // count occurrences of each weekday in period
      const counts = [0, 0, 0, 0, 0, 0, 0];
      eachDayOfInterval({ start: from, end: startOfDay(toDate) }).forEach((d) => {
        counts[isoDay(d)] += 1;
      });
      setDayCounts(counts);

      const { data: productsData, error: productsError } = await supabase
        .from(tables.products)
        .select("id, name, cod_produs, default_unit");
      if (productsError) throw productsError;

      let allTransfersMain: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from(tables.transfersMain)
          .select("id, transfer_date, destination")
          .gte("transfer_date", fromStr)
          .lte("transfer_date", toStr)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (pageError) throw pageError;
        if (pageData && pageData.length > 0) {
          allTransfersMain = [...allTransfersMain, ...pageData];
          hasMore = pageData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      const productionTransfers = allTransfersMain.filter((t) => {
        const dest = (t.destination || "").toLowerCase();
        return dest.includes("produc");
      });

      if (productionTransfers.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const transferDateMap = new Map<string, string>();
      productionTransfers.forEach((t) => transferDateMap.set(t.id, t.transfer_date));

      const batchSize = 50;
      const ids = productionTransfers.map((t) => t.id);
      let allItems: any[] = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        const { data: batchData, error: batchError } = await supabase
          .from(tables.transfers)
          .select("quantity, inventory_item_id, transfer_id")
          .in("transfer_id", ids.slice(i, i + batchSize));
        if (batchError) throw batchError;
        if (batchData) allItems = [...allItems, ...batchData];
      }

      const invIds = [...new Set(allItems.map((t) => t.inventory_item_id))];
      const invToProduct = new Map<string, string>();
      for (let i = 0; i < invIds.length; i += batchSize) {
        const { data: invData } = await supabase
          .from(tables.inventory)
          .select("id, product_id")
          .in("id", invIds.slice(i, i + batchSize));
        (invData || []).forEach((it: any) => {
          if (it.product_id) invToProduct.set(it.id, it.product_id);
        });
      }

      const perProduct = new Map<string, number[]>();
      allItems.forEach((item) => {
        const productId = invToProduct.get(item.inventory_item_id);
        if (!productId) return;
        const dateStr = transferDateMap.get(item.transfer_id);
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return;
        if (!perProduct.has(productId)) perProduct.set(productId, [0, 0, 0, 0, 0, 0, 0]);
        const arr = perProduct.get(productId)!;
        arr[isoDay(d)] += Number(item.quantity) || 0;
      });

      // stoc curent per produs
      const stockByProduct = new Map<string, number>();
      {
        let sp = 0;
        let more = true;
        while (more) {
          const { data: invRows } = await supabase
            .from(tables.inventory)
            .select("product_id, quantity")
            .gt("quantity", 0)
            .range(sp * 1000, (sp + 1) * 1000 - 1);
          (invRows || []).forEach((i: any) => {
            if (!i.product_id) return;
            stockByProduct.set(i.product_id, (stockByProduct.get(i.product_id) || 0) + (Number(i.quantity) || 0));
          });
          more = (invRows || []).length === 1000;
          sp++;
        }
      }

      const settingsTable =
        inventoryType === "ambalaje"
          ? "ambalaje_product_order_settings"
          : inventoryType === "etichete"
          ? "etichete_product_order_settings"
          : "product_order_settings";
      const { data: settingsRows } = await supabase.from(settingsTable).select("product_id, lead_time_days");
      const leadByProduct = new Map<string, number>();
      (settingsRows || []).forEach((s2: any) => {
        if (s2.product_id) leadByProduct.set(s2.product_id, Number(s2.lead_time_days) || 7);
      });

      const totalDays = counts.reduce((a, b) => a + b, 0) || 1;

      const result: Row[] = (productsData || [])
        .map((p: any) => {
          const perDayTotals = perProduct.get(p.id) || [0, 0, 0, 0, 0, 0, 0];
          const total = perDayTotals.reduce((a, b) => a + b, 0);
          const stock = stockByProduct.get(p.id) || 0;
          const avgDaily = total / totalDays;
          const coverDays = avgDaily > 0 ? stock / avgDaily : null;
          const leadTime = leadByProduct.get(p.id) ?? 7;
          const suggestedQty = Math.max(avgDaily * leadTime - stock, 0);
          return {
            product_id: p.id,
            product_name: p.name,
            product_code: p.cod_produs,
            unit: p.default_unit,
            total,
            perDayTotals,
            perDayAvg: perDayTotals.map((v, i) => (counts[i] > 0 ? v / counts[i] : 0)),
            stock,
            avgDaily,
            coverDays,
            coverDate: coverDays !== null ? addDays(new Date(), Math.floor(coverDays)) : null,
            leadTime,
            suggestedQty,
          };
        })
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total);


      setRows(result);
    } catch (e) {
      console.error("[WeekdayConsumption]", e);
      toast({ title: "Eroare la generarea raportului", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orderOpen, setOrderOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!searchTerm) return rows;
    const s = searchTerm.toLowerCase();
    return rows.filter(
      (r) => r.product_name.toLowerCase().includes(s) || (r.product_code || "").toLowerCase().includes(s)
    );
  }, [rows, searchTerm]);

  const orderLines: OrderLineInput[] = useMemo(
    () =>
      filtered
        .filter((r) => selected.has(r.product_id))
        .map((r) => ({
          key: r.product_id,
          productId: r.product_id,
          name: r.product_name,
          code: r.product_code,
          unit: r.unit,
          // sugestie: necesar până la următoarea livrare (termen livrare produs) minus stoc
          qty: r.suggestedQty,
        })),
    [filtered, selected]
  );


  const exportExcel = () => {
    const data = filtered.map((r) => {
      const base: Record<string, any> = {
        "Cod Produs": r.product_code || "-",
        "Nume Produs": r.product_name,
        Unitate: r.unit,
        "Total Perioadă": Math.round(r.total * 100) / 100,
      };
      WEEKDAYS.forEach((w, i) => {
        base[`${w} - total`] = Math.round(r.perDayTotals[i] * 100) / 100;
        base[`${w} - medie`] = Math.round(r.perDayAvg[i] * 100) / 100;
      });
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consum pe zile");
    XLSX.writeFile(wb, `ConsumZileSaptamana_${format(fromDate, "yyyyMMdd")}_${format(toDate, "yyyyMMdd")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">De la</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(fromDate, "dd MMM yyyy", { locale: ro })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={fromDate} onSelect={(d) => d && setFromDate(d)} initialFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Până la</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(toDate, "dd MMM yyyy", { locale: ro })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={toDate} onSelect={(d) => d && setToDate(d)} initialFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Generează
        </Button>
        <Button variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
          <FileDown className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
        <Button onClick={() => setOrderOpen(true)} disabled={selected.size === 0}>
          <Truck className="h-4 w-4 mr-2" />
          Comandă furnizor ({selected.size})
        </Button>

      </div>

      <p className="text-xs text-muted-foreground">
        Consum din transferurile către producție, defalcat pe zilele săptămânii din perioada selectată. „Medie” = total pe acea zi a
        săptămânii / numărul de apariții ale zilei în perioadă.
      </p>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nu există date de consum pentru perioada selectată.</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.product_id))}
                    onCheckedChange={(v) => setSelected(v ? new Set(filtered.map((r) => r.product_id)) : new Set())}
                  />
                </TableHead>
                <TableHead className="min-w-[220px]">Produs</TableHead>
                <TableHead>UM</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Stoc curent</TableHead>
                <TableHead className="text-right whitespace-nowrap">Termen livrare</TableHead>
                <TableHead className="text-right whitespace-nowrap">Cant. recomandată</TableHead>
                <TableHead className="text-right whitespace-nowrap">Zile acoperire</TableHead>
                <TableHead className="text-right whitespace-nowrap">Ajunge până la</TableHead>
                {WEEKDAYS.map((w, i) => (
                  <TableHead key={w} className="text-right whitespace-nowrap">
                    {w}
                    <span className="block text-[10px] font-normal text-muted-foreground">{dayCounts[i]} zile</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.product_id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.product_id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(r.product_id);
                          else next.delete(r.product_id);
                          return next;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.product_name}
                    {r.product_code ? <span className="block text-xs text-muted-foreground font-mono">{r.product_code}</span> : null}
                  </TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {r.total.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">{r.stock.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold",
                      r.coverDays === null
                        ? "text-muted-foreground"
                        : r.coverDays < 3
                        ? "text-destructive"
                        : r.coverDays < 7
                        ? "text-amber-600"
                        : "text-emerald-600"
                    )}
                  >
                    {r.coverDays === null ? "—" : `${r.coverDays.toLocaleString("ro-RO", { maximumFractionDigits: 1 })} zile`}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {r.coverDate ? format(r.coverDate, "dd MMM yyyy", { locale: ro }) : "—"}
                  </TableCell>
                  {WEEKDAYS.map((w, i) => (
                    <TableCell key={w} className="text-right">
                      <span className="font-medium">
                        {r.perDayTotals[i].toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                      </span>
                      <span className="block text-[11px] text-primary">
                        ø {r.perDayAvg[i].toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateSupplierOrderDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        inventoryType={inventoryType}
        lines={orderLines}
        onCreated={() => setSelected(new Set())}
      />

    </div>
  );
};

export default WeekdayConsumption;
