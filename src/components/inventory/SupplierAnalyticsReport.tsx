import React, { useEffect, useMemo, useState } from "react";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { CalendarIcon, Download, Loader2, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useInventoryType } from "@/context/inventory-type";

const getInventoryTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_reception_records";
  if (t === "etichete") return "etichete_reception_records";
  return "reception_records";
};
const getManufacturerTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_manufacturers";
  if (t === "etichete") return "etichete_manufacturers";
  return "manufacturers";
};
const getSupplierTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_suppliers";
  if (t === "etichete") return "etichete_suppliers";
  return "suppliers";
};

type RawRec = {
  id: string;
  name: string;
  original_quantity: number | null;
  net_quantity: number | null;
  unit: string | null;
  receipt_date: string;
  supplier_id: string | null;
  supplier_name: string | null;
  manufacturer_id: string | null;
  product_id: string | null;
};

type ReportRow = {
  inventory_id: string;
  cantitate_document: number | null;
  pierdere_calitativa_procent: number | null;
};

type Aggregated = {
  key: string;
  name: string;
  cant_rec: number;
  cant_doc: number;
  pierdere_cant: number;
  pierdere_calit_kg: number;
  pierdere_calit_pct: number;
  nr_receptii: number;
};

type Mode = "supplier" | "manufacturer";

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const SupplierAnalyticsReport: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const { toast } = useToast();

  const dateKey = `supplierAnalytics.range.${inventoryType}`;
  const [range, setRange] = useState<DateRange | undefined>(() => {
    try {
      const s = localStorage.getItem(dateKey);
      if (s) {
        const o = JSON.parse(s);
        return { from: o.from ? new Date(o.from) : undefined, to: o.to ? new Date(o.to) : undefined };
      }
    } catch {}
    return { from: subDays(new Date(), 30), to: new Date() };
  });
  useEffect(() => {
    try {
      localStorage.setItem(dateKey, JSON.stringify({
        from: range?.from?.toISOString() ?? null, to: range?.to?.toISOString() ?? null,
      }));
    } catch {}
  }, [range, dateKey]);

  const [mode, setMode] = useState<Mode>("supplier");
  const [loading, setLoading] = useState(false);
  const [rawRecs, setRawRecs] = useState<RawRec[]>([]);
  const [reportMap, setReportMap] = useState<Map<string, ReportRow>>(new Map());
  const [supplierNames, setSupplierNames] = useState<Map<string, string>>(new Map());
  const [manufacturerNames, setManufacturerNames] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<{ key: string; name: string } | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const loadData = async () => {
    if (!range?.from || !range?.to) return;
    setLoading(true);
    try {
      const start = format(startOfDay(range.from), "yyyy-MM-dd");
      const end = format(endOfDay(range.to), "yyyy-MM-dd");

      const q = (supabase as any)
        .from(getInventoryTable(inventoryType))
        .select(`id, name, original_quantity, net_quantity, unit, receipt_date,
                 supplier_id, supplier_name, manufacturer_id, product_id`)
        .gte("receipt_date", start)
        .lte("receipt_date", end);

      const all: RawRec[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        const chunk = (data as RawRec[]) || [];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }

      const invIds = all.map((r) => r.id);
      const repMap = new Map<string, ReportRow>();
      for (let i = 0; i < invIds.length; i += 50) {
        const slice = invIds.slice(i, i + 50);
        if (slice.length === 0) break;
        const { data } = await (supabase as any)
          .from("reception_report_data")
          .select("inventory_id, cantitate_document, pierdere_calitativa_procent")
          .in("inventory_id", slice);
        ((data || []) as ReportRow[]).forEach((r) => repMap.set(r.inventory_id, r));
      }

      // Resolve supplier names (fallback if supplier_name missing)
      const supIds = Array.from(new Set(all.map((r) => r.supplier_id).filter(Boolean))) as string[];
      const supMap = new Map<string, string>();
      for (let i = 0; i < supIds.length; i += 50) {
        const slice = supIds.slice(i, i + 50);
        if (!slice.length) break;
        const { data } = await (supabase as any).from(getSupplierTable(inventoryType)).select("id, name").in("id", slice);
        ((data || []) as any[]).forEach((s) => supMap.set(s.id, s.name));
      }

      const manuIds = Array.from(new Set(all.map((r) => r.manufacturer_id).filter(Boolean))) as string[];
      const manuMap = new Map<string, string>();
      for (let i = 0; i < manuIds.length; i += 50) {
        const slice = manuIds.slice(i, i + 50);
        if (!slice.length) break;
        const { data } = await (supabase as any).from(getManufacturerTable(inventoryType)).select("id, name").in("id", slice);
        ((data || []) as any[]).forEach((m) => manuMap.set(m.id, m.name));
      }

      setRawRecs(all);
      setReportMap(repMap);
      setSupplierNames(supMap);
      setManufacturerNames(manuMap);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Eroare la încărcare", description: e?.message || "—", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to, inventoryType]);

  // Reset selection when mode or data changes
  useEffect(() => { setSelected(null); setExpandedProduct(null); }, [mode, inventoryType]);
  useEffect(() => { setExpandedProduct(null); }, [selected]);

  // Aggregate by supplier or manufacturer
  const aggregated = useMemo<Aggregated[]>(() => {
    const map = new Map<string, Aggregated>();
    rawRecs.forEach((r) => {
      const key = mode === "supplier"
        ? (r.supplier_id || `name:${r.supplier_name || "Fără furnizor"}`)
        : (r.manufacturer_id || "no-manufacturer");
      const name = mode === "supplier"
        ? (supplierNames.get(r.supplier_id || "") || r.supplier_name || "Fără furnizor")
        : (manufacturerNames.get(r.manufacturer_id || "") || "Fără producător");
      let agg = map.get(key);
      if (!agg) {
        agg = { key, name, cant_rec: 0, cant_doc: 0, pierdere_cant: 0, pierdere_calit_kg: 0, pierdere_calit_pct: 0, nr_receptii: 0 };
        map.set(key, agg);
      }
      const rec = Number(r.original_quantity ?? r.net_quantity ?? 0);
      agg.cant_rec += rec;
      agg.nr_receptii += 1;
      const rep = reportMap.get(r.id);
      const doc = rep?.cantitate_document != null ? Number(rep.cantitate_document) : 0;
      agg.cant_doc += doc;
      const pct = rep?.pierdere_calitativa_procent != null ? Number(rep.pierdere_calitativa_procent) : 0;
      agg.pierdere_calit_kg += rec * pct / 100;
    });
    const arr = Array.from(map.values());
    arr.forEach((a) => {
      a.pierdere_cant = a.cant_doc - a.cant_rec;
      a.pierdere_calit_pct = a.cant_rec > 0 ? (a.pierdere_calit_kg / a.cant_rec) * 100 : 0;
    });
    return arr;
  }, [rawRecs, reportMap, supplierNames, manufacturerNames, mode]);

  const totals = useMemo(() => {
    const t = { cant_rec: 0, cant_doc: 0, pierdere_cant: 0, pierdere_calit_kg: 0, nr_receptii: 0 };
    aggregated.forEach((a) => {
      t.cant_rec += a.cant_rec;
      t.cant_doc += a.cant_doc;
      t.pierdere_cant += a.pierdere_cant;
      t.pierdere_calit_kg += a.pierdere_calit_kg;
      t.nr_receptii += a.nr_receptii;
    });
    return { ...t, pierdere_calit_pct: t.cant_rec > 0 ? (t.pierdere_calit_kg / t.cant_rec) * 100 : 0 };
  }, [aggregated]);

  // Top by % and by kg
  const topByPct = useMemo(() => [...aggregated].sort((a, b) => b.pierdere_calit_pct - a.pierdere_calit_pct).slice(0, 10), [aggregated]);
  const topByKg = useMemo(() => [...aggregated].sort((a, b) => b.pierdere_calit_kg - a.pierdere_calit_kg).slice(0, 10), [aggregated]);

  // Drill-down: details for selected supplier/manufacturer
  const drilldown = useMemo(() => {
    if (!selected) return null;
    const recsForKey = rawRecs.filter((r) => {
      const key = mode === "supplier"
        ? (r.supplier_id || `name:${r.supplier_name || "Fără furnizor"}`)
        : (r.manufacturer_id || "no-manufacturer");
      return key === selected.key;
    });

    // by product
    const byProduct = new Map<string, Aggregated>();
    const receptionsByProduct = new Map<string, Array<{ id: string; date: string; cant_rec: number; cant_doc: number; pierdere_pct: number; pierdere_kg: number; unit: string }>>();
    recsForKey.forEach((r) => {
      const k = `${r.name}__${r.unit || ""}`;
      let a = byProduct.get(k);
      if (!a) {
        a = { key: k, name: `${r.name}${r.unit ? ` (${r.unit})` : ""}`, cant_rec: 0, cant_doc: 0, pierdere_cant: 0, pierdere_calit_kg: 0, pierdere_calit_pct: 0, nr_receptii: 0 };
        byProduct.set(k, a);
      }
      const rec = Number(r.original_quantity ?? r.net_quantity ?? 0);
      a.cant_rec += rec;
      a.nr_receptii += 1;
      const rep = reportMap.get(r.id);
      const doc = rep?.cantitate_document != null ? Number(rep.cantitate_document) : 0;
      a.cant_doc += doc;
      const pct = rep?.pierdere_calitativa_procent != null ? Number(rep.pierdere_calitativa_procent) : 0;
      a.pierdere_calit_kg += rec * pct / 100;

      const list = receptionsByProduct.get(k) || [];
      list.push({
        id: r.id,
        date: r.receipt_date,
        cant_rec: rec,
        cant_doc: doc,
        pierdere_pct: pct,
        pierdere_kg: rec * pct / 100,
        unit: r.unit || "",
      });
      receptionsByProduct.set(k, list);
    });
    receptionsByProduct.forEach((list) => list.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
    const products = Array.from(byProduct.values()).map((a) => ({
      ...a,
      pierdere_cant: a.cant_doc - a.cant_rec,
      pierdere_calit_pct: a.cant_rec > 0 ? (a.pierdere_calit_kg / a.cant_rec) * 100 : 0,
    })).sort((x, y) => y.pierdere_calit_kg - x.pierdere_calit_kg);

    // by day (evolution)
    const byDay = new Map<string, { date: string; cant_rec: number; pierdere_calit_kg: number; pierdere_calit_pct: number }>();
    recsForKey.forEach((r) => {
      const d = r.receipt_date?.slice(0, 10) || "";
      if (!d) return;
      let e = byDay.get(d);
      if (!e) { e = { date: d, cant_rec: 0, pierdere_calit_kg: 0, pierdere_calit_pct: 0 }; byDay.set(d, e); }
      const rec = Number(r.original_quantity ?? r.net_quantity ?? 0);
      e.cant_rec += rec;
      const rep = reportMap.get(r.id);
      const pct = rep?.pierdere_calitativa_procent != null ? Number(rep.pierdere_calitativa_procent) : 0;
      e.pierdere_calit_kg += rec * pct / 100;
    });
    const evolution = Array.from(byDay.values())
      .map((e) => ({ ...e, pierdere_calit_pct: e.cant_rec > 0 ? (e.pierdere_calit_kg / e.cant_rec) * 100 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ ...e, label: format(parseISO(e.date), "dd MMM", { locale: ro }) }));

    // trend: compare first vs last half
    let trend: "up" | "down" | "flat" = "flat";
    if (evolution.length >= 2) {
      const half = Math.floor(evolution.length / 2) || 1;
      const firstAvg = evolution.slice(0, half).reduce((s, e) => s + e.pierdere_calit_pct, 0) / half;
      const lastAvg = evolution.slice(-half).reduce((s, e) => s + e.pierdere_calit_pct, 0) / half;
      if (lastAvg > firstAvg + 0.1) trend = "up";
      else if (lastAvg < firstAvg - 0.1) trend = "down";
    }

    return { products, evolution, trend, receptionsByProduct };
  }, [selected, rawRecs, reportMap, mode]);

  const exportExcel = () => {
    const header = [mode === "supplier" ? "Furnizor" : "Producător", "Cant. recepționată", "Cant. document", "Pierdere cant.", "Pierdere calit. %", "Pierdere calit. (kg)", "Nr. recepții"];
    const data = aggregated
      .sort((a, b) => b.pierdere_calit_kg - a.pierdere_calit_kg)
      .map((a) => [a.name, +a.cant_rec.toFixed(2), +a.cant_doc.toFixed(2), +a.pierdere_cant.toFixed(2), +a.pierdere_calit_pct.toFixed(2), +a.pierdere_calit_kg.toFixed(2), a.nr_receptii]);
    const ws = XLSX.utils.aoa_to_sheet([
      [`Raport ${mode === "supplier" ? "furnizori" : "producători"} — pierderi calitative`],
      [`Interval: ${range?.from ? format(range.from, "dd.MM.yyyy") : ""} → ${range?.to ? format(range.to, "dd.MM.yyyy") : ""}`],
      [],
      header,
      ...data,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Raport");
    XLSX.writeFile(wb, `raport-${mode}-${inventoryType}-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
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
              <Calendar initialFocus mode="range" defaultMonth={range?.from} selected={range} onSelect={setRange} numberOfMonths={2} className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1 min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Grupare</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="supplier">Pe furnizor</SelectItem>
              <SelectItem value="manufacturer">Pe producător</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={loadData} disabled={loading} variant="default">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Reîncarcă
        </Button>
        <Button onClick={exportExcel} disabled={aggregated.length === 0} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
      </div>

      {selected ? (
        // ===== DRILL-DOWN VIEW =====
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Înapoi
              </Button>
              <h2 className="text-xl font-bold">{selected.name}</h2>
              {drilldown && (
                <Badge variant={drilldown.trend === "down" ? "default" : drilldown.trend === "up" ? "destructive" : "secondary"} className="ml-2">
                  {drilldown.trend === "down" ? <><TrendingDown className="h-3 w-3 mr-1" /> Evoluție pozitivă</>
                    : drilldown.trend === "up" ? <><TrendingUp className="h-3 w-3 mr-1" /> Înrăutățire</>
                    : "Stabil"}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Cant. recepționată</div><div className="text-2xl font-bold">{aggregated.find(a => a.key === selected.key)?.cant_rec.toFixed(2) || "0"}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pierdere calit. %</div><div className="text-2xl font-bold text-destructive">{(aggregated.find(a => a.key === selected.key)?.pierdere_calit_pct || 0).toFixed(2)}%</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pierdere calit. (kg)</div><div className="text-2xl font-bold text-destructive">{(aggregated.find(a => a.key === selected.key)?.pierdere_calit_kg || 0).toFixed(2)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Nr. recepții</div><div className="text-2xl font-bold">{aggregated.find(a => a.key === selected.key)?.nr_receptii || 0}</div></CardContent></Card>
          </div>

          {drilldown && drilldown.evolution.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Evoluție pierdere calitativă</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer>
                    <LineChart data={drilldown.evolution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis yAxisId="pct" orientation="left" label={{ value: "%", angle: -90, position: "insideLeft" }} />
                      <YAxis yAxisId="kg" orientation="right" label={{ value: "kg", angle: 90, position: "insideRight" }} />
                      <Tooltip formatter={(v: any) => Number(v).toFixed(2)} />
                      <Legend />
                      <Line yAxisId="pct" type="monotone" dataKey="pierdere_calit_pct" name="Pierdere %" stroke="#ef4444" strokeWidth={2} />
                      <Line yAxisId="kg" type="monotone" dataKey="pierdere_calit_kg" name="Pierdere kg" stroke="#f59e0b" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {drilldown && (
            <Card>
              <CardHeader><CardTitle className="text-base">Pierderi pe produse</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produs</TableHead>
                      <TableHead className="text-right">Cant. recepționată</TableHead>
                      <TableHead className="text-right">Cant. document</TableHead>
                      <TableHead className="text-right">Pierdere cant.</TableHead>
                      <TableHead className="text-right">Pierdere calit. %</TableHead>
                      <TableHead className="text-right">Pierdere calit. (kg)</TableHead>
                      <TableHead className="text-right">Nr. recepții</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drilldown.products.map((p) => (
                      <TableRow key={p.key}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{p.cant_rec.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{p.cant_doc.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{p.pierdere_cant.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-destructive">{p.pierdere_calit_pct.toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-semibold text-destructive">{p.pierdere_calit_kg.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{p.nr_receptii}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        // ===== OVERVIEW =====
        <Tabs defaultValue="tabel" className="w-full">
          <TabsList>
            <TabsTrigger value="tabel">Tabel</TabsTrigger>
            <TabsTrigger value="top-pct">Top % pierderi</TabsTrigger>
            <TabsTrigger value="top-kg">Top kg pierderi</TabsTrigger>
          </TabsList>

          <TabsContent value="tabel">
            <Card>
              <CardContent className="p-4 overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{mode === "supplier" ? "Furnizor" : "Producător"}</TableHead>
                        <TableHead className="text-right">Cant. recepționată</TableHead>
                        <TableHead className="text-right">Cant. document</TableHead>
                        <TableHead className="text-right">Pierdere cant.</TableHead>
                        <TableHead className="text-right">Pierdere calit. %</TableHead>
                        <TableHead className="text-right">Pierdere calit. (kg)</TableHead>
                        <TableHead className="text-right">Nr. recepții</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregated.sort((a, b) => b.pierdere_calit_kg - a.pierdere_calit_kg).map((a) => (
                        <TableRow key={a.key} className="cursor-pointer hover:bg-muted/60" onClick={() => setSelected({ key: a.key, name: a.name })}>
                          <TableCell className="font-medium text-primary underline-offset-4 hover:underline">{a.name}</TableCell>
                          <TableCell className="text-right">{a.cant_rec.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{a.cant_doc.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{a.pierdere_cant.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold text-destructive">{a.pierdere_calit_pct.toFixed(2)}%</TableCell>
                          <TableCell className="text-right font-semibold text-destructive">{a.pierdere_calit_kg.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{a.nr_receptii}</TableCell>
                        </TableRow>
                      ))}
                      {aggregated.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nu există date pentru intervalul selectat.</TableCell></TableRow>
                      )}
                    </TableBody>
                    {aggregated.length > 0 && (
                      <TableFooter>
                        <TableRow>
                          <TableCell className="font-bold">TOTAL</TableCell>
                          <TableCell className="text-right font-bold">{totals.cant_rec.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">{totals.cant_doc.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">{totals.pierdere_cant.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-destructive">{totals.pierdere_calit_pct.toFixed(2)}%</TableCell>
                          <TableCell className="text-right font-bold text-destructive">{totals.pierdere_calit_kg.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">{totals.nr_receptii}</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-pct">
            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 — pierderi calitative (%)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer>
                    <BarChart data={topByPct} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} />
                      <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                      <Bar dataKey="pierdere_calit_pct" name="Pierdere %" onClick={(d: any) => setSelected({ key: d.key, name: d.name })} cursor="pointer">
                        {topByPct.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-kg">
            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 — pierderi calitative (kg)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer>
                    <BarChart data={topByKg} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} kg`} />
                      <Bar dataKey="pierdere_calit_kg" name="Pierdere kg" onClick={(d: any) => setSelected({ key: d.key, name: d.name })} cursor="pointer">
                        {topByKg.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default SupplierAnalyticsReport;
