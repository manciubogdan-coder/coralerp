import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, FileDown, Truck } from "lucide-react";
import { format, startOfDay, endOfDay, eachDayOfInterval, subDays, addDays } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import CreateSupplierOrderDialog, { OrderLineInput } from "./CreateSupplierOrderDialog";

interface Props {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
  searchTerm?: string;
}

interface Row {
  key: string;
  productId: string | null;
  name: string;
  unit: string;
  net: number;
  pt: number;
  brut: number;
  stock: number;
  ordered: number;
  orderedEta: Date | null;
  diff: number;
  matched: boolean;
  perDayBrut: number[];
  perDayAvg: number[];
  avgDaily: number;
  coverDays: number | null;
  coverDate: Date | null;
}


// 0 = Luni ... 6 = Duminică
const WEEKDAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];
const isoDay = (d: Date) => (d.getDay() + 6) % 7;

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const toKg = (q: number, u?: string) => {
  switch ((u || "").toLowerCase()) {
    case "g":
    case "gr":
    case "grame":
      return q / 1000;
    case "t":
    case "tone":
      return q * 1000;
    default:
      return q;
  }
};

const ClientOrdersForecast: React.FC<Props> = ({ inventoryType, searchTerm = "" }) => {
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordersCount, setOrdersCount] = useState(0);
  const [missingRecipes, setMissingRecipes] = useState<string[]>([]);
  const [dayCounts, setDayCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [view, setView] = useState<"total" | "weekday">("weekday");

  const getTableNames = () => {
    switch (inventoryType) {
      case "ambalaje":
        return { products: "ambalaje_products" as const, inventory: "ambalaje_inventory" as const };
      case "etichete":
        return { products: "etichete_products" as const, inventory: "etichete_inventory" as const };
      default:
        return { products: "products" as const, inventory: "inventory" as const };
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const tables = getTableNames();
      const fromStr = format(startOfDay(fromDate), "yyyy-MM-dd");
      const toStr = format(startOfDay(toDate), "yyyy-MM-dd");
      const fromTs = startOfDay(fromDate).toISOString();
      const counts = [0, 0, 0, 0, 0, 0, 0];
      eachDayOfInterval({ start: startOfDay(fromDate), end: startOfDay(toDate) }).forEach((d) => {
        counts[isoDay(d)] += 1;
      });
      setDayCounts(counts);
      const toTs = endOfDay(toDate).toISOString();

      // 1. Comenzi de client din perioada selectată (data producție sau, dacă lipsește, data creării)
      const fetchAll = async (build: () => any) => {
        const all: any[] = [];
        const step = 1000;
        for (let from = 0; ; from += step) {
          const { data, error } = await build().range(from, from + step - 1);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < step) break;
        }
        return all;
      };

      const byProdDate = await fetchAll(() =>
        supabase
          .from("productie_comenzi")
          .select("id, produs_id, cantitate, data_productie, created_at, status")
          .gte("data_productie", fromStr)
          .lte("data_productie", toStr)
          .order("id")
      );

      const byCreated = await fetchAll(() =>
        supabase
          .from("productie_comenzi")
          .select("id, produs_id, cantitate, data_productie, created_at, status")
          .is("data_productie", null)
          .gte("created_at", fromTs)
          .lte("created_at", toTs)
          .order("id")
      );

      const orders = [...(byProdDate || []), ...(byCreated || [])].filter(
        (o: any) => o.status !== "canceled_by_erp"
      );
      setOrdersCount(orders.length);

      if (orders.length === 0) {
        setRows([]);
        setMissingRecipes([]);
        setLoading(false);
        return;
      }

      // 2. Rețete active
      const { data: recipes, error: e3 } = await supabase
        .from("productie_retete")
        .select(
          `produs_id, activa,
           productie_retete_ingrediente(ingredient_id, cantitate_necesara, unitate_masura,
             productie_ingrediente(id, nume, unitate_masura))`
        )
        .eq("activa", true);
      if (e3) throw e3;

      const recipeByProduct = new Map<string, any>();
      (recipes || []).forEach((r: any) => {
        if (r.produs_id && !recipeByProduct.has(r.produs_id)) recipeByProduct.set(r.produs_id, r);
      });

      // 3. Produse finite (pentru nume la produsele fără rețetă)
      const { data: finite } = await supabase.from("productie_produse").select("id, nume");
      const finiteMap = new Map<string, string>();
      (finite || []).forEach((p: any) => finiteMap.set(p.id, p.nume));

      // 4. Agregare necesar net pe ingredient
      const need = new Map<string, { name: string; qty: number; perDay: number[] }>();
      const missing = new Set<string>();

      orders.forEach((o: any) => {
        if (!o.produs_id) return;
        const refDate = new Date(o.data_productie || o.created_at);
        const dayIdx = isNaN(refDate.getTime()) ? null : isoDay(refDate);
        const recipe = recipeByProduct.get(o.produs_id);
        if (!recipe?.productie_retete_ingrediente?.length) {
          missing.add(finiteMap.get(o.produs_id) || o.produs_id);
          return;
        }
        recipe.productie_retete_ingrediente.forEach((ing: any) => {
          const name = ing.productie_ingrediente?.nume || "Necunoscut";
          const qty = toKg((Number(ing.cantitate_necesara) || 0) * (Number(o.cantitate) || 0), ing.unitate_masura);
          const key = norm(name);
          let entry = need.get(key);
          if (!entry) {
            entry = { name, qty: 0, perDay: [0, 0, 0, 0, 0, 0, 0] };
            need.set(key, entry);
          }
          entry.qty += qty;
          if (dayIdx !== null) entry.perDay[dayIdx] += qty;
        });
      });

      setMissingRecipes([...missing].slice(0, 30));

      // 5. Produse din depozit (PT + stoc)
      const { data: products } = await supabase.from(tables.products).select("*");
      const productByName = new Map<string, any>();
      (products || []).forEach((p: any) => productByName.set(norm(p.name), p));

      const { data: inv } = await supabase.from(tables.inventory).select("product_id, quantity").gt("quantity", 0);
      const stockByProduct = new Map<string, number>();
      (inv || []).forEach((i: any) => {
        if (!i.product_id) return;
        stockByProduct.set(i.product_id, (stockByProduct.get(i.product_id) || 0) + (Number(i.quantity) || 0));
      });

      // 5b. Comenzi către furnizor în curs (nelivrate)
      const ordersTable =
        inventoryType === "ambalaje"
          ? "ambalaje_product_orders"
          : inventoryType === "etichete"
          ? "etichete_product_orders"
          : "product_orders";
      const { data: pendingOrders } = await supabase
        .from(ordersTable)
        .select("product_id, quantity_ordered, expected_delivery_date, status")
        .in("status", ["pending", "ordered"]);
      const orderedByProduct = new Map<string, { qty: number; eta: Date | null }>();
      (pendingOrders || []).forEach((o: any) => {
        if (!o.product_id) return;
        const cur = orderedByProduct.get(o.product_id) || { qty: 0, eta: null as Date | null };
        cur.qty += Number(o.quantity_ordered) || 0;
        if (o.expected_delivery_date) {
          const d = new Date(o.expected_delivery_date);
          if (!cur.eta || d < cur.eta) cur.eta = d;
        }
        orderedByProduct.set(o.product_id, cur);
      });

      const totalDays = counts.reduce((a, b) => a + b, 0) || 1;

      const result: Row[] = [...need.entries()].map(([key, v]) => {
        const p = productByName.get(key);
        const pt = Number(p?.pt_percent) || 0;
        const brut = v.qty * (1 + pt / 100);
        const stock = p ? stockByProduct.get(p.id) || 0 : 0;
        const ord = p ? orderedByProduct.get(p.id) : undefined;
        const factor = 1 + pt / 100;
        const perDayBrut = v.perDay.map((q) => q * factor);
        const avgDaily = brut / totalDays;
        const coverDays = avgDaily > 0 ? stock / avgDaily : null;
        return {
          perDayBrut,
          perDayAvg: perDayBrut.map((q, i) => (counts[i] > 0 ? q / counts[i] : 0)),
          key,
          productId: p?.id || null,
          name: p?.name || v.name,
          unit: p?.default_unit || "kg",
          net: v.qty,
          pt,
          brut,
          stock,
          ordered: ord?.qty || 0,
          orderedEta: ord?.eta || null,
          diff: stock - brut,
          matched: !!p,
          avgDaily,
          coverDays,
          coverDate: coverDays !== null ? addDays(new Date(), Math.floor(coverDays)) : null,
        };
      });


      result.sort((a, b) => a.diff - b.diff);
      setRows(result);
    } catch (e) {
      console.error("[ClientOrdersForecast]", e);
      toast({ title: "Eroare la calculul necesarului", variant: "destructive" });
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
    return rows.filter((r) => r.name.toLowerCase().includes(s));
  }, [rows, searchTerm]);

  const orderLines: OrderLineInput[] = useMemo(
    () =>
      filtered
        .filter((r) => selected.has(r.key))
        .map((r) => ({
          key: r.key,
          productId: r.productId,
          name: r.name,
          unit: r.unit,
          qty: Math.max(r.brut - r.stock - r.ordered, 0),
        })),
    [filtered, selected]
  );


  const exportExcel = () => {
    const data = filtered.map((r) => {
      const base: Record<string, any> = {
        Materie: r.name,
        UM: r.unit,
        "Necesar net": Math.round(r.net * 100) / 100,
        "% PT": r.pt,
        "Necesar cu PT": Math.round(r.brut * 100) / 100,
        "Stoc curent": Math.round(r.stock * 100) / 100,
        Diferență: Math.round(r.diff * 100) / 100,
      };
      WEEKDAYS.forEach((w, i) => {
        base[`${w} - necesar`] = Math.round(r.perDayBrut[i] * 100) / 100;
        base[`${w} - medie`] = Math.round(r.perDayAvg[i] * 100) / 100;
      });
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Necesar comenzi");
    XLSX.writeFile(wb, `ForecastComenziClient_${format(fromDate, "yyyyMMdd")}_${format(toDate, "yyyyMMdd")}.xlsx`);
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
          Calculează
        </Button>
        <Button variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
          <FileDown className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
        <Button onClick={() => setOrderOpen(true)} disabled={selected.size === 0}>
          <Truck className="h-4 w-4 mr-2" />
          Comandă furnizor ({selected.size})
        </Button>

        <div className="flex gap-1">
          <Button size="sm" variant={view === "weekday" ? "default" : "outline"} onClick={() => setView("weekday")}>
            Pe zilele săptămânii
          </Button>
          <Button size="sm" variant={view === "total" ? "default" : "outline"} onClick={() => setView("total")}>
            Total perioadă
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Necesar calculat din comenzile de client introduse ({ordersCount} comenzi) × rețete active, la care se adaugă pierderea
        tehnologică (%PT din nomenclatorul de produse).
      </p>

      {missingRecipes.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          Produse din comenzi fără rețetă activă (neincluse în calcul): {missingRecipes.join(", ")}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nu există comenzi de client în perioada selectată.</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.key))}
                    onCheckedChange={(v) =>
                      setSelected(v ? new Set(filtered.map((r) => r.key)) : new Set())
                    }
                  />
                </TableHead>
                <TableHead className="min-w-[220px]">Materie primă</TableHead>
                <TableHead>UM</TableHead>
                <TableHead className="text-right">Necesar net</TableHead>
                <TableHead className="text-right">% PT</TableHead>
                <TableHead className="text-right">Necesar cu PT</TableHead>
                <TableHead className="text-right">Stoc curent</TableHead>
                <TableHead className="text-right whitespace-nowrap">Zile acoperire</TableHead>
                <TableHead className="text-right whitespace-nowrap">Ajunge până la</TableHead>
                {view === "weekday" ? (
                  WEEKDAYS.map((w, i) => (
                    <TableHead key={w} className="text-right whitespace-nowrap">
                      {w}
                      <span className="block text-[10px] font-normal text-muted-foreground">{dayCounts[i]} zile</span>
                    </TableHead>
                  ))
                ) : (
                  <TableHead className="text-right">Diferență</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.key)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(r.key);
                          else next.delete(r.key);
                          return next;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.name}
                    {!r.matched && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        fără corespondent în stoc
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell className="text-right">{r.net.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{r.pt.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}%</TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {r.brut.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
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
                  {view === "weekday" ? (
                    WEEKDAYS.map((w, i) => (
                      <TableCell key={w} className="text-right">
                        <span className="font-medium">
                          {r.perDayBrut[i].toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                        </span>
                        <span className="block text-[11px] text-primary">
                          ø {r.perDayAvg[i].toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                    ))
                  ) : (
                    <TableCell className={cn("text-right font-semibold", r.diff < 0 ? "text-destructive" : "text-emerald-600")}>
                      {r.diff.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                    </TableCell>
                  )}
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
      />

    </div>
  );
};

export default ClientOrdersForecast;
