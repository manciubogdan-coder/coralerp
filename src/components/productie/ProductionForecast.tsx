import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProductionLines } from "@/hooks/productie/useProductionData";
import { Calendar, Clock, Package, TrendingUp } from "lucide-react";

const WEEKDAYS = [
  { idx: 1, short: "Lu", long: "Luni" },
  { idx: 2, short: "Ma", long: "Marți" },
  { idx: 3, short: "Mi", long: "Miercuri" },
  { idx: 4, short: "Jo", long: "Joi" },
  { idx: 5, short: "Vi", long: "Vineri" },
  { idx: 6, short: "Sâ", long: "Sâmbătă" },
  { idx: 0, short: "Du", long: "Duminică" },
];

const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatTime = (hours: number) => {
  if (!hours || !isFinite(hours) || hours <= 0) return "-";
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const ProductionForecast: React.FC = () => {
  const today = new Date();
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(today.getDate() - 28);

  const [startDate, setStartDate] = useState(fmtDate(fourWeeksAgo));
  const [endDate, setEndDate] = useState(fmtDate(today));
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const { data: lines = [] } = useProductionLines();
  const selectedLine = lines.find((l) => l.id === selectedLineId);

  const { data: lineProducts = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["forecast-line-products", selectedLineId, startDate, endDate],
    enabled: !!selectedLineId,
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("productie_comenzi")
          .select("cantitate, data_productie, productie_produse(nume, unitate_masura)")
          .eq("linie_id", selectedLineId as string)
          .gte("data_productie", startDate)
          .lte("data_productie", endDate)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const productBreakdown = useMemo(() => {
    const map = new Map<string, { nume: string; unitate: string; total: number; comenzi: number }>();
    for (const o of lineProducts as any[]) {
      const nume = o.productie_produse?.nume || "—";
      const unitate = o.productie_produse?.unitate_masura || "buc";
      const existing = map.get(nume);
      const qty = Number(o.cantitate) || 0;
      if (existing) {
        existing.total += qty;
        existing.comenzi += 1;
      } else {
        map.set(nume, { nume, unitate, total: qty, comenzi: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [lineProducts]);


  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["forecast-orders", startDate, endDate],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("productie_comenzi")
          .select("id, linie_id, cantitate, data_productie")
          .gte("data_productie", startDate)
          .lte("data_productie", endDate)
          .not("linie_id", "is", null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  // For each line + weekday: sum cantitate, and count distinct dates observed
  const stats = useMemo(() => {
    // key: `${linie_id}::${weekday}` -> { total, dateSet }
    const map = new Map<string, { total: number; dates: Set<string> }>();
    for (const o of orders) {
      if (!o.linie_id || !o.data_productie) continue;
      const dateStr = String(o.data_productie).split("T")[0];
      // parse manually to avoid TZ shift
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, (m || 1) - 1, d || 1);
      const wd = dt.getDay();
      const key = `${o.linie_id}::${wd}`;
      const entry = map.get(key) || { total: 0, dates: new Set<string>() };
      entry.total += Number(o.cantitate) || 0;
      entry.dates.add(dateStr);
      map.set(key, entry);
    }
    return map;
  }, [orders]);

  const getCell = (lineId: string, wd: number) => {
    const entry = stats.get(`${lineId}::${wd}`);
    if (!entry || entry.dates.size === 0) return null;
    const avg = entry.total / entry.dates.size;
    return { avg, occurrences: entry.dates.size, total: entry.total };
  };

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(fmtDate(start));
    setEndDate(fmtDate(end));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Forecast Producție pe Linii
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Media bucăților produse pe fiecare zi a săptămânii și timpul estimat pe baza capacității liniei, calculată din istoricul comenzilor din perioada selectată.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">De la</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
            </div>
            <div>
              <Label className="text-xs">Până la</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreset(7)}>Ultima săpt.</Button>
              <Button size="sm" variant="outline" onClick={() => setPreset(28)}>Ultimele 4 săpt.</Button>
              <Button size="sm" variant="outline" onClick={() => setPreset(90)}>Ultimele 3 luni</Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Se încarcă...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Linie</TableHead>
                    <TableHead className="text-center">Capacitate/h</TableHead>
                    {WEEKDAYS.map((w) => (
                      <TableHead key={w.idx} className="text-center min-w-[110px]">{w.long}</TableHead>
                    ))}
                    <TableHead className="text-center bg-muted/40">Total/săpt.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => {
                    const cells = WEEKDAYS.map((w) => ({ w, data: getCell(line.id, w.idx) }));
                    const weekTotal = cells.reduce((s, c) => s + (c.data?.avg || 0), 0);
                    const weekTime = line.capacitate_ora > 0 ? weekTotal / line.capacitate_ora : 0;
                    return (
                      <TableRow
                        key={line.id}
                        onClick={() => setSelectedLineId(line.id === selectedLineId ? null : line.id)}
                        className={`cursor-pointer hover:bg-muted/40 ${selectedLineId === line.id ? "bg-muted/60" : ""}`}
                      >
                        <TableCell className="font-medium">{line.nume}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {line.capacitate_ora} buc/h
                        </TableCell>
                        {cells.map(({ w, data }) => {
                          if (!data) {
                            return (
                              <TableCell key={w.idx} className="text-center text-muted-foreground text-xs">
                                —
                              </TableCell>
                            );
                          }
                          const time = line.capacitate_ora > 0 ? data.avg / line.capacitate_ora : 0;
                          return (
                            <TableCell key={w.idx} className="text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-1 font-semibold">
                                  <Package className="h-3 w-3 text-blue-600" />
                                  {Math.round(data.avg).toLocaleString()}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-amber-700">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(time)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {data.occurrences}× • Σ{Math.round(data.total).toLocaleString()}
                                </div>
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center bg-muted/30">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="font-semibold">{Math.round(weekTotal).toLocaleString()} buc</div>
                            <div className="text-xs text-amber-700 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(weekTime)}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={WEEKDAYS.length + 3} className="text-center text-muted-foreground py-8">
                        Nicio linie configurată
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-2 border-t">
            <Badge variant="outline" className="flex items-center gap-1">
              <Package className="h-3 w-3" /> media buc/zi
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> timp estimat = media / capacitate
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> N× = câte zile de acel tip s-au observat
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionForecast;
