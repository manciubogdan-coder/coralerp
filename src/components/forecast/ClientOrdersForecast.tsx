import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, FileDown, Truck, Activity, History } from "lucide-react";
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
  group: string;
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
  leadTime: number;
  suggestedQty: number;
  coverAfterOrder: number | null;
  coverDateAfterOrder: Date | null;
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

const SALATE_KEYS = [
  "salata", "salate", "lollo", "rucola", "rukola", "spanac", "valeriana", "babyleaf", "baby",
  "iceberg", "batavia", "frisee", "radicchio", "romana", "mix", "mesclun", "andive", "creta",
];
const AROMATE_KEYS = [
  "menta", "busuioc", "patrunjel", "marar", "cimbru", "cimbrisor", "rozmarin", "oregano",
  "leustean", "tarhon", "coriandru", "arpagic", "ceapaverde", "salvie", "melisa", "roinita",
  "lavanda", "sovarv", "aromat",
];

const groupOf = (name: string): string => {
  const n = norm(name);
  if (AROMATE_KEYS.some((k) => n.includes(k))) return "Aromate";
  if (SALATE_KEYS.some((k) => n.includes(k))) return "Salate";
  return "Altele";
};
const GROUP_ORDER = ["Salate", "Aromate", "Altele"];

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
  const [mode, setMode] = useState<"live" | "istoric">("live");
  const [preset, setPreset] = useState<string>("7");
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordersCount, setOrdersCount] = useState(0);
  const [missingRecipes, setMissingRecipes] = useState<string[]>([]);
  const [dayCounts, setDayCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [view, setView] = useState<"total" | "weekday" | "proiectie">("weekday");
  // Perioada de proiecție (viitor) — independentă de perioada de referință
  const [projFrom, setProjFrom] = useState<Date>(startOfDay(new Date()));
  const [projTo, setProjTo] = useState<Date>(startOfDay(addDays(new Date(), 6)));


  const getTableNames = () => {
    switch (inventoryType) {
      case "ambalaje":
        return { products: "ambalaje_products" as const, inventory: "ambalaje_inventory" as const, settings: "ambalaje_product_order_settings" as const };
      case "etichete":
        return { products: "etichete_products" as const, inventory: "etichete_inventory" as const, settings: "etichete_product_order_settings" as const };
      default:
        return { products: "products" as const, inventory: "inventory" as const, settings: "product_order_settings" as const };
    }
  };

  const fetchData = async (
    rangeFrom: Date = fromDate,
    rangeTo: Date = toDate,
    m: "live" | "istoric" = mode
  ) => {
    setLoading(true);
    try {
      const tables = getTableNames();
      // Live = doar comenzile existente de azi înainte.
      // Istoric = doar comenzile din perioada de referință selectată (trecut).
      const effFrom = m === "live" ? startOfDay(new Date()) : startOfDay(rangeFrom);
      const effTo = m === "live" ? startOfDay(addDays(new Date(), 60)) : startOfDay(rangeTo);
      const fromStr = format(effFrom, "yyyy-MM-dd");
      const toStr = format(effTo, "yyyy-MM-dd");
      const fromTs = effFrom.toISOString();
      const toTs = endOfDay(effTo).toISOString();

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

      // Numărul de zile din perioada analizată (pentru medii zilnice).
      // Live: de azi până la ultima dată de producție existentă în comenzi.
      const counts = [0, 0, 0, 0, 0, 0, 0];
      let spanEnd = effTo;
      if (m === "live") {
        const dates = orders
          .map((o: any) => new Date(o.data_productie || o.created_at))
          .filter((d) => !isNaN(d.getTime()));
        spanEnd = dates.length
          ? startOfDay(new Date(Math.max(...dates.map((d) => d.getTime()))))
          : effFrom;
        if (spanEnd < effFrom) spanEnd = effFrom;
      }
      eachDayOfInterval({ start: effFrom, end: spanEnd }).forEach((d) => {
        counts[isoDay(d)] += 1;
      });
      setDayCounts(counts);

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
      const today0 = startOfDay(new Date());
      const orderedByProduct = new Map<string, { qty: number; eta: Date | null }>();
      (pendingOrders || []).filter((o: any) => {
        // ignorăm comenzile vechi (data estimată de livrare a trecut) — sunt reziduale
        if (!o.expected_delivery_date) return false;
        return new Date(o.expected_delivery_date) >= today0;
      }).forEach((o: any) => {
        if (!o.product_id) return;
        const cur = orderedByProduct.get(o.product_id) || { qty: 0, eta: null as Date | null };
        cur.qty += Number(o.quantity_ordered) || 0;
        if (o.expected_delivery_date) {
          const d = new Date(o.expected_delivery_date);
          if (!cur.eta || d < cur.eta) cur.eta = d;
        }
        orderedByProduct.set(o.product_id, cur);
      });

      // 5c. Termen de livrare per produs
      const { data: settingsRows } = await supabase.from(tables.settings).select("product_id, lead_time_days");
      const leadByProduct = new Map<string, number>();
      (settingsRows || []).forEach((s2: any) => {
        if (s2.product_id) leadByProduct.set(s2.product_id, Number(s2.lead_time_days) || 7);
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
        const leadTime = p ? leadByProduct.get(p.id) ?? 7 : 7;
        const orderedQty = ord?.qty || 0;
        const suggestedQty = Math.max(avgDaily * leadTime - stock - orderedQty, 0);
        const totalAfterOrder = stock + orderedQty + suggestedQty;
        const coverAfterOrder = avgDaily > 0 ? totalAfterOrder / avgDaily : null;
        const name = p?.name || v.name;
        return {
          perDayBrut,
          perDayAvg: perDayBrut.map((q, i) => (counts[i] > 0 ? q / counts[i] : 0)),
          key,
          productId: p?.id || null,
          name,
          group: groupOf(name),
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
          leadTime,
          suggestedQty,
          coverAfterOrder,
          coverDateAfterOrder: coverAfterOrder !== null ? addDays(new Date(), Math.floor(coverAfterOrder)) : null,
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

  const applyPreset = (days: string) => {
    setPreset(days);
    if (days === "custom") return;
    const n = Number(days);
    const to = subDays(new Date(), 1);
    const from = subDays(to, n - 1);
    setFromDate(from);
    setToDate(to);
    fetchData(from, to, "istoric");
  };

  const switchMode = (m: "live" | "istoric") => {
    setMode(m);
    if (m === "istoric") {
      applyPreset(preset === "custom" ? "7" : preset);
    } else {
      fetchData(fromDate, toDate, "live");
    }
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orderOpen, setOrderOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!searchTerm) return rows;
    const s = searchTerm.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(s));
  }, [rows, searchTerm]);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((g) => ({ group: g, items: filtered.filter((r) => r.group === g) })).filter(
      (g) => g.items.length > 0
    );
  }, [filtered]);

  // ==== Proiecție viitoare: descărcarea stocului zi de zi ====
  const projDays = useMemo(() => {
    const start = startOfDay(projFrom);
    const end = startOfDay(projTo);
    if (end < start) return [start];
    const list = eachDayOfInterval({ start, end });
    return list.slice(0, 60);
  }, [projFrom, projTo]);

  const projection = useMemo(() => {
    const map = new Map<string, { remaining: number[]; consum: number[]; outDate: Date | null }>();
    filtered.forEach((r) => {
      let running = r.stock;
      let incomingLeft = r.ordered;
      const remaining: number[] = [];
      const consum: number[] = [];
      let outDate: Date | null = null;
      projDays.forEach((d) => {
        if (incomingLeft > 0 && r.orderedEta && startOfDay(r.orderedEta) <= d) {
          running += incomingLeft;
          incomingLeft = 0;
        }
        const need = r.perDayAvg[isoDay(d)] || 0;
        running -= need;
        consum.push(need);
        remaining.push(running);
        if (running < 0 && !outDate) outDate = d;
      });
      map.set(r.key, { remaining, consum, outDate });
    });
    return map;
  }, [filtered, projDays]);



  const orderLines: OrderLineInput[] = useMemo(
    () =>
      filtered
        .filter((r) => selected.has(r.key))
        .map((r) => ({
          key: r.key,
          productId: r.productId,
          name: r.name,
          unit: r.unit,
          qty: r.suggestedQty,
        })),
    [filtered, selected]
  );

  const exportExcel = () => {
    const data = filtered.map((r) => {
      const base: Record<string, any> = {
        Grupă: r.group,
        Materie: r.name,
        UM: r.unit,
        "Necesar net": Math.round(r.net * 100) / 100,
        "% PT": r.pt,
        "Necesar cu PT": Math.round(r.brut * 100) / 100,
        "Stoc curent": Math.round(r.stock * 100) / 100,
        Comandat: Math.round(r.ordered * 100) / 100,
        "Termen livrare": r.leadTime,
        "Cant. recomandată": Math.round(r.suggestedQty * 100) / 100,
        "Zile acoperire": r.coverDays === null ? "-" : Math.round(r.coverDays * 10) / 10,
        "Ajunge până la": r.coverDate ? format(r.coverDate, "yyyy-MM-dd") : "-",
        "Zile după comandă": r.coverAfterOrder === null ? "-" : Math.round(r.coverAfterOrder * 10) / 10,
        "Ajunge după comandă": r.coverDateAfterOrder ? format(r.coverDateAfterOrder, "yyyy-MM-dd") : "-",
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

  const stickyHead = "sticky top-0 z-20 bg-background h-8 px-2 border-b text-muted-foreground font-medium";
  const cornerHead = "sticky top-0 left-0 z-30 bg-background h-8 px-2 border-b";
  const nameHead = "sticky top-0 left-[40px] z-30 bg-background h-8 px-2 border-b text-left min-w-[180px]";
  const cellCheck = "sticky left-0 z-10 bg-background p-2";
  const cellName = "sticky left-[40px] z-10 bg-background p-2 font-medium min-w-[180px]";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex gap-1">
          <Button size="sm" variant={mode === "live" ? "default" : "outline"} onClick={() => switchMode("live")}>
            <Activity className="h-4 w-4 mr-1" /> Live
          </Button>
          <Button size="sm" variant={mode === "istoric" ? "default" : "outline"} onClick={() => switchMode("istoric")}>
            <History className="h-4 w-4 mr-1" /> Istoric
          </Button>
        </div>

        {mode === "istoric" && (
          <div className="flex gap-1">
            {[
              { v: "7", l: "1 săpt." },
              { v: "14", l: "2 săpt." },
              { v: "21", l: "3 săpt." },
              { v: "28", l: "4 săpt." },
              { v: "custom", l: "Personalizat" },
            ].map((p) => (
              <Button
                key={p.v}
                size="sm"
                variant={preset === p.v ? "secondary" : "outline"}
                onClick={() => applyPreset(p.v)}
              >
                {p.l}
              </Button>
            ))}
          </div>
        )}

        {mode === "istoric" && (
        <>
        <div className="space-y-1">
          <label className="text-sm font-medium">De la</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(fromDate, "dd MMM yyyy", { locale: ro })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(d) => {
                  if (!d) return;
                  setFromDate(d);
                  setPreset("custom");
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Până la</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(toDate, "dd MMM yyyy", { locale: ro })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(d) => {
                  if (!d) return;
                  setToDate(d);
                  setPreset("custom");
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        </>
        )}
        <Button onClick={() => fetchData()} disabled={loading}>
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
          <Button size="sm" variant={view === "proiectie" ? "default" : "outline"} onClick={() => setView("proiectie")}>
            Proiecție zi cu zi
          </Button>
        </div>
      </div>

      {view === "proiectie" && (
        <div className="flex flex-wrap gap-3 items-end border rounded-md p-3 bg-muted/30">
          <div className="text-sm font-medium w-full">
            Perioada de proiecție (viitor) — cât și până când îmi ajunge marfa
          </div>
          <div className="flex gap-1">
            {[
              { v: 7, l: "Următoarea săpt." },
              { v: 14, l: "2 săpt." },
              { v: 30, l: "30 zile" },
            ].map((p) => (
              <Button
                key={p.v}
                size="sm"
                variant="outline"
                onClick={() => {
                  setProjFrom(startOfDay(new Date()));
                  setProjTo(startOfDay(addDays(new Date(), p.v - 1)));
                }}
              >
                {p.l}
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium block">Proiecție de la</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[150px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(projFrom, "dd MMM yyyy", { locale: ro })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={projFrom} onSelect={(d) => d && setProjFrom(startOfDay(d))} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium block">Proiecție până la</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[150px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(projTo, "dd MMM yyyy", { locale: ro })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={projTo} onSelect={(d) => d && setProjTo(startOfDay(d))} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {mode === "live"
          ? `Live: necesar din comenzile de client deja existente, de azi înainte (${ordersCount} comenzi) × rețete active + pierdere tehnologică (%PT).`
          : `Istoric: media zilnică se calculează din comenzile din ${format(fromDate, "dd MMM", { locale: ro })} – ${format(
              toDate,
              "dd MMM yyyy",
              { locale: ro }
            )} (${ordersCount} comenzi) și este proiectată în viitor pentru a estima necesarul și pe câte zile ajunge stocul.`}
        {view === "proiectie" &&
          ` Proiecție: stoc curent (+ comenzi furnizor cu ETA în interval) minus consumul mediu pe fiecare zi din ${format(
            projFrom,
            "dd MMM",
            { locale: ro }
          )} – ${format(projTo, "dd MMM yyyy", { locale: ro })}.`}
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
        <div className="border rounded-lg overflow-auto max-h-[70vh] text-xs relative">
          <table className="w-full caption-bottom border-collapse">
            <thead>
              <tr>
                <th className={cornerHead}>
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.key))}
                    onCheckedChange={(v) => setSelected(v ? new Set(filtered.map((r) => r.key)) : new Set())}
                  />
                </th>
                <th className={nameHead}>Materie primă</th>
                <th className={stickyHead}>UM</th>
                <th className={cn(stickyHead, "text-right")}>Necesar net</th>
                <th className={cn(stickyHead, "text-right")}>% PT</th>
                <th className={cn(stickyHead, "text-right")}>Necesar cu PT</th>
                <th className={cn(stickyHead, "text-right")}>Stoc curent</th>
                <th className={cn(stickyHead, "text-right whitespace-nowrap")}>Comandat</th>
                <th className={cn(stickyHead, "text-right whitespace-nowrap")}>Termen livrare</th>
                <th className={cn(stickyHead, "text-right whitespace-nowrap")}>Cant. recomandată</th>
                <th className={cn(stickyHead, "text-right whitespace-nowrap")}>Zile acoperire</th>
                <th className={cn(stickyHead, "text-right whitespace-nowrap")}>Ajunge până la</th>
                <th className={cn(stickyHead, "text-right whitespace-nowrap")}>Zile după comandă</th>
                {view === "weekday" ? (
                  WEEKDAYS.map((w, i) => (
                    <th key={w} className={cn(stickyHead, "text-right whitespace-nowrap")}>
                      {w}
                      <span className="block text-[10px] font-normal text-muted-foreground">{dayCounts[i]} zile</span>
                    </th>
                  ))
                ) : view === "proiectie" ? (
                  <>
                    <th className={cn(stickyHead, "text-right whitespace-nowrap")}>Rămâne fără stoc</th>
                    {projDays.map((d) => (
                      <th key={d.toISOString()} className={cn(stickyHead, "text-right whitespace-nowrap")}>
                        {format(d, "dd MMM", { locale: ro })}
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          {WEEKDAYS[isoDay(d)].slice(0, 3)}
                        </span>
                      </th>
                    ))}
                  </>
                ) : (
                  <th className={cn(stickyHead, "text-right")}>Diferență</th>
                )}

              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <React.Fragment key={g.group}>
                  <tr className="bg-muted/60">
                    <td className="sticky left-0 z-10 bg-muted/60 p-2" />
                    <td
                      className="sticky left-[40px] z-10 bg-muted/60 p-2 font-semibold uppercase tracking-wide text-[11px]"
                      colSpan={1}
                    >
                      {g.group} ({g.items.length})
                    </td>
                    <td
                      colSpan={view === "weekday" ? 18 : view === "proiectie" ? 12 + projDays.length : 12}
                      className="p-2"
                    />

                  </tr>
                  {g.items.map((r) => (
                    <tr key={r.key} className="border-b hover:bg-muted/40">
                      <td className={cellCheck}>
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
                      </td>
                      <td className={cellName}>
                        {r.name}
                        {!r.matched && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            fără corespondent în stoc
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">{r.unit}</td>
                      <td className="p-2 text-right">{r.net.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right">{r.pt.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}%</td>
                      <td className="p-2 text-right font-semibold text-primary">
                        {r.brut.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-right">{r.stock.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {r.ordered > 0 ? (
                          <>
                            <Badge className="bg-blue-500 hover:bg-blue-600">
                              <Truck className="h-3 w-3 mr-1" />
                              {r.ordered.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                            </Badge>
                            {r.orderedEta && (
                              <span className="block text-[10px] text-muted-foreground mt-0.5">
                                {format(r.orderedEta, "dd MMM", { locale: ro })}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap text-muted-foreground">{r.leadTime} zile</td>
                      <td className="p-2 text-right font-semibold">
                        {r.suggestedQty > 0 ? r.suggestedQty.toLocaleString("ro-RO", { maximumFractionDigits: 2 }) : "—"}
                      </td>
                      <td
                        className={cn(
                          "p-2 text-right font-semibold",
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
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {r.coverDate ? format(r.coverDate, "dd MMM yyyy", { locale: ro }) : "—"}
                      </td>
                      <td
                        className={cn(
                          "p-2 text-right font-semibold whitespace-nowrap",
                          r.coverAfterOrder === null
                            ? "text-muted-foreground"
                            : r.coverAfterOrder < 3
                            ? "text-destructive"
                            : r.coverAfterOrder < 7
                            ? "text-amber-600"
                            : "text-emerald-600"
                        )}
                      >
                        {r.coverAfterOrder === null
                          ? "—"
                          : `${r.coverAfterOrder.toLocaleString("ro-RO", { maximumFractionDigits: 1 })} zile`}
                      </td>
                      {view === "weekday" ? (
                        WEEKDAYS.map((w, i) => (
                          <td key={w} className="p-2 text-right">
                            <span className="font-medium">
                              {r.perDayBrut[i].toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                            </span>
                            <span className="block text-[11px] text-primary">
                              ø {r.perDayAvg[i].toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                            </span>
                          </td>
                        ))
                      ) : (
                        <td className={cn("p-2 text-right font-semibold", r.diff < 0 ? "text-destructive" : "text-emerald-600")}>
                          {r.diff.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                        </td>
                      )}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateSupplierOrderDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        inventoryType={inventoryType}
        lines={orderLines}
        onCreated={() => {
          setSelected(new Set());
          fetchData();
        }}
      />
    </div>
  );
};

export default ClientOrdersForecast;
