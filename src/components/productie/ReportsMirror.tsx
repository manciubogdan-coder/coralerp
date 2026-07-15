import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProductionLines, useWorkSessions } from "@/hooks/productie/useProductionData";
import { useOrdersForReports } from "@/hooks/productie/useOrdersForReports";
import {
  Loader2, Download, Factory, Package, GitCompare, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import ReportsFilters, { DateFilter } from "./ReportsFilters";
import { format, eachDayOfInterval, startOfDay, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import * as XLSX from "xlsx";

const round1 = (n: number) => Math.round(n * 10) / 10;

const orderRefDate = (o: any): Date | null => {
  const s = o?.data_productie || o?.created_at;
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "În așteptare",
  assigned: "Asignată",
  in_progress: "În lucru",
  partial: "Parțială",
  completed: "Finalizată",
  canceled_by_erp: "Anulată ERP",
};

const diffBadge = (planned: number, actual: number) => {
  const diff = actual - planned;
  if (Math.abs(diff) < 0.5) {
    return <Badge variant="secondary" className="gap-1"><Minus className="h-3 w-3" />0</Badge>;
  }
  if (diff > 0) {
    return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><TrendingUp className="h-3 w-3" />+{diff.toLocaleString()}</Badge>;
  }
  return <Badge variant="destructive" className="gap-1"><TrendingDown className="h-3 w-3" />{diff.toLocaleString()}</Badge>;
};

const pctBadge = (planned: number, actual: number) => {
  if (planned <= 0) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round((actual / planned) * 100);
  const cls =
    pct >= 100 ? "bg-emerald-600 hover:bg-emerald-700" :
    pct >= 80 ? "bg-amber-500 hover:bg-amber-600" :
    "bg-red-500 hover:bg-red-600";
  return <Badge className={cls}>{pct}%</Badge>;
};

const ReportsMirror = () => {
  const { data: lines, isLoading: linesLoading } = useProductionLines();
  const { data: orders, isLoading: ordersLoading } = useOrdersForReports();
  const { data: workSessions, isLoading: sessionsLoading } = useWorkSessions();

  const [currentFilter, setCurrentFilter] = useState<DateFilter>({
    type: "today",
    dateRange: { from: new Date(), to: new Date() },
    label: "Astăzi",
  });

  const range = useMemo(() => {
    const from = currentFilter.dateRange?.from ? startOfDay(currentFilter.dateRange.from) : null;
    const to = currentFilter.dateRange?.to
      ? new Date(currentFilter.dateRange.to.getFullYear(), currentFilter.dateRange.to.getMonth(), currentFilter.dateRange.to.getDate(), 23, 59, 59)
      : from ? new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59) : null;
    return { from, to };
  }, [currentFilter]);

  // Comenzi filtrate (planul)
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o: any) => {
      const d = orderRefDate(o);
      if (!d) return false;
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
      return true;
    });
  }, [orders, range]);

  // Sesiuni de lucru din perioadă (realizarea)
  const filteredSessions = useMemo(() => {
    if (!workSessions) return [];
    return workSessions.filter((s: any) => {
      const ref = s.ora_start || s.created_at;
      if (!ref) return false;
      const d = new Date(ref);
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
      return true;
    });
  }, [workSessions, range]);

  // Sesiuni indexate după comanda_id (sumă cantitate_produsa)
  const producedByOrder = useMemo(() => {
    const m = new Map<string, number>();
    filteredSessions.forEach((s: any) => {
      if (!s.comanda_id) return;
      m.set(s.comanda_id, (m.get(s.comanda_id) || 0) + Number(s.cantitate_produsa || 0));
    });
    return m;
  }, [filteredSessions]);

  // Per Comandă — planificat vs realizat
  const perOrder = useMemo(() => {
    return filteredOrders.map((o: any) => {
      const line = lines?.find(l => l.id === o.linie_id);
      const planned = Number(o.cantitate || 0);
      const actual = producedByOrder.get(o.id) || Number(o.cantitate_reala_produsa || 0);
      const ref = orderRefDate(o);
      return {
        id: o.id,
        numar: o.numar_comanda,
        produs: o.productie_produse?.nume || "—",
        magazin: o.magazin,
        linie: line?.nume || "Neasignat",
        data: ref ? format(ref, "dd.MM.yyyy") : "—",
        dataSort: ref ? ref.getTime() : 0,
        planned,
        actual,
        diff: actual - planned,
        status: o.status,
      };
    }).sort((a, b) => b.dataSort - a.dataSort);
  }, [filteredOrders, lines, producedByOrder]);

  // Per Linie
  const perLine = useMemo(() => {
    if (!lines) return [];
    return lines.map(line => {
      const lineOrders = filteredOrders.filter((o: any) => o.linie_id === line.id);
      const planned = lineOrders.reduce((s, o: any) => s + Number(o.cantitate || 0), 0);
      const actualFromOrders = lineOrders.reduce((s, o: any) => s + (producedByOrder.get(o.id) || 0), 0);
      // Sesiunile de pe linie (poate cuprinde și cantități pe comenzi din afara perioadei)
      const lineSessions = filteredSessions.filter((s: any) => s.linie_id === line.id);
      const actualTotalSesiuni = lineSessions.reduce((s, r: any) => s + Number(r.cantitate_produsa || 0), 0);
      const nrPlan = lineOrders.length;
      const nrDone = lineOrders.filter((o: any) => o.status === "completed").length;
      return {
        id: line.id,
        nume: line.nume,
        planned,
        actualFromOrders,
        actualTotalSesiuni,
        diff: actualFromOrders - planned,
        nrPlan,
        nrDone,
      };
    })
    .filter(l => l.planned > 0 || l.actualTotalSesiuni > 0)
    .sort((a, b) => b.planned - a.planned);
  }, [lines, filteredOrders, filteredSessions, producedByOrder]);

  // Per Zi
  const perDay = useMemo(() => {
    if (!range.from) return [];
    const days = eachDayOfInterval({ start: range.from, end: range.to || range.from });
    return days.map(day => {
      const ordersZi = filteredOrders.filter((o: any) => {
        const d = orderRefDate(o); return d && isSameDay(d, day);
      });
      const planned = ordersZi.reduce((s, o: any) => s + Number(o.cantitate || 0), 0);
      const actualFromOrders = ordersZi.reduce((s, o: any) => s + (producedByOrder.get(o.id) || 0), 0);
      const sesiuniZi = filteredSessions.filter((s: any) => {
        const ref = s.ora_start || s.created_at;
        return ref && isSameDay(new Date(ref), day);
      });
      const actualTotalSesiuni = sesiuniZi.reduce((s, r: any) => s + Number(r.cantitate_produsa || 0), 0);
      return {
        zi: format(day, "dd MMM", { locale: ro }),
        ziFull: format(day, "yyyy-MM-dd"),
        planned,
        actualFromOrders,
        actualTotalSesiuni,
        diff: actualFromOrders - planned,
        nrComenzi: ordersZi.length,
      };
    });
  }, [filteredOrders, filteredSessions, producedByOrder, range]);

  // Per Produs
  const perProduct = useMemo(() => {
    const map = new Map<string, { produs: string; planned: number; actual: number; nr: number }>();
    filteredOrders.forEach((o: any) => {
      const key = o.productie_produse?.nume || o.produs_id || "—";
      const prev = map.get(key) || { produs: key, planned: 0, actual: 0, nr: 0 };
      prev.planned += Number(o.cantitate || 0);
      prev.actual += producedByOrder.get(o.id) || 0;
      prev.nr += 1;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.planned - a.planned);
  }, [filteredOrders, producedByOrder]);

  // KPI totale
  const kpi = useMemo(() => {
    const planned = filteredOrders.reduce((s, o: any) => s + Number(o.cantitate || 0), 0);
    const actualFromOrders = filteredOrders.reduce((s, o: any) => s + (producedByOrder.get(o.id) || 0), 0);
    const actualTotal = filteredSessions.reduce((s, r: any) => s + Number(r.cantitate_produsa || 0), 0);
    return { planned, actualFromOrders, actualTotal, diff: actualFromOrders - planned };
  }, [filteredOrders, filteredSessions, producedByOrder]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perLine.map(l => ({
      Linie: l.nume,
      "Planificat (buc)": l.planned,
      "Realizat pe comenzile din perioadă (buc)": l.actualFromOrders,
      "Realizat total sesiuni pe linie (buc)": l.actualTotalSesiuni,
      "Diferență": l.diff,
      "Realizare %": l.planned > 0 ? Math.round((l.actualFromOrders / l.planned) * 100) : 0,
      "Comenzi": l.nrPlan,
      "Finalizate": l.nrDone,
    }))), "Per Linie");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perOrder.map(o => ({
      Data: o.data,
      "Nr Comandă": o.numar,
      Produs: o.produs,
      Magazin: o.magazin,
      Linie: o.linie,
      "Planificat": o.planned,
      "Realizat": o.actual,
      "Diferență": o.diff,
      "Realizare %": o.planned > 0 ? Math.round((o.actual / o.planned) * 100) : 0,
      Status: STATUS_LABEL[o.status] || o.status,
    }))), "Per Comandă");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perDay.map(d => ({
      Zi: d.ziFull,
      "Planificat": d.planned,
      "Realizat pe comenzile zilei": d.actualFromOrders,
      "Realizat total sesiuni zi": d.actualTotalSesiuni,
      "Diferență": d.diff,
      "Nr Comenzi": d.nrComenzi,
    }))), "Per Zi");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perProduct.map(p => ({
      Produs: p.produs,
      "Planificat": p.planned,
      "Realizat": p.actual,
      "Diferență": p.actual - p.planned,
      "Realizare %": p.planned > 0 ? Math.round((p.actual / p.planned) * 100) : 0,
      "Nr Comenzi": p.nr,
    }))), "Per Produs");
    XLSX.writeFile(wb, `Oglinda_Comenzi_vs_Realizat_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`);
  };

  if (linesLoading || ordersLoading || sessionsLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <GitCompare className="h-7 w-7 text-primary" /> Oglindă: Comenzi vs Realizat
          </h2>
          <p className="text-muted-foreground">
            Ce trebuia produs (din comenzile introduse) vs ce s-a produs efectiv (din sesiunile operatorilor) — {currentFilter.label}
          </p>
        </div>
        <Button onClick={exportExcel} className="gap-2">
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </div>

      <ReportsFilters currentFilter={currentFilter} onFilterChange={setCurrentFilter} />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Planificat total</div>
          <div className="text-2xl font-bold">{kpi.planned.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Realizat pe comenzile din perioadă</div>
          <div className="text-2xl font-bold text-emerald-600">{kpi.actualFromOrders.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Realizat total (toate sesiunile)</div>
          <div className="text-2xl font-bold text-blue-600">{kpi.actualTotal.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Diferență (Realizat − Planificat)</div>
          <div className={`text-2xl font-bold ${kpi.diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {kpi.diff >= 0 ? "+" : ""}{kpi.diff.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Realizare: {kpi.planned > 0 ? Math.round((kpi.actualFromOrders / kpi.planned) * 100) : 0}%
          </div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="lines" className="gap-2"><Factory className="h-4 w-4" />Per Linie</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><Package className="h-4 w-4" />Per Comandă</TabsTrigger>
          <TabsTrigger value="days" className="gap-2"><TrendingUp className="h-4 w-4" />Per Zi</TabsTrigger>
          <TabsTrigger value="products" className="gap-2"><Package className="h-4 w-4" />Per Produs</TabsTrigger>
        </TabsList>

        {/* PER LINIE */}
        <TabsContent value="lines" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Planificat vs Realizat — per Linie</CardTitle></CardHeader>
            <CardContent>
              {perLine.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nu există date în perioada selectată.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={perLine}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="nume" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
                    <Legend />
                    <Bar dataKey="planned" name="Planificat" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="actualFromOrders" name="Realizat (pe comenzile perioadei)" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="actualTotalSesiuni" name="Realizat total sesiuni linie" fill="hsl(210 90% 55%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Detaliu Per Linie</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linie</TableHead>
                    <TableHead className="text-right">Planificat</TableHead>
                    <TableHead className="text-right">Realizat (comenzi)</TableHead>
                    <TableHead className="text-right">Realizat total sesiuni</TableHead>
                    <TableHead className="text-right">Diferență</TableHead>
                    <TableHead className="text-right">Realizare</TableHead>
                    <TableHead className="text-right">Comenzi</TableHead>
                    <TableHead className="text-right">Finalizate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perLine.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.nume}</TableCell>
                      <TableCell className="text-right font-semibold">{l.planned.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{l.actualFromOrders.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{l.actualTotalSesiuni.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{diffBadge(l.planned, l.actualFromOrders)}</TableCell>
                      <TableCell className="text-right">{pctBadge(l.planned, l.actualFromOrders)}</TableCell>
                      <TableCell className="text-right">{l.nrPlan}</TableCell>
                      <TableCell className="text-right">{l.nrDone}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PER COMANDĂ */}
        <TabsContent value="orders">
          <Card>
            <CardHeader><CardTitle>Comparație Per Comandă</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {perOrder.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nu există comenzi în perioadă.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Nr Comandă</TableHead>
                      <TableHead>Produs</TableHead>
                      <TableHead>Magazin</TableHead>
                      <TableHead>Linie</TableHead>
                      <TableHead className="text-right">Planificat</TableHead>
                      <TableHead className="text-right">Realizat</TableHead>
                      <TableHead className="text-right">Dif.</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perOrder.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs">{o.data}</TableCell>
                        <TableCell className="font-medium">{o.numar}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={o.produs}>{o.produs}</TableCell>
                        <TableCell className="max-w-[160px] truncate" title={o.magazin}>{o.magazin}</TableCell>
                        <TableCell>{o.linie}</TableCell>
                        <TableCell className="text-right font-semibold">{o.planned.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{o.actual.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{diffBadge(o.planned, o.actual)}</TableCell>
                        <TableCell className="text-right">{pctBadge(o.planned, o.actual)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{STATUS_LABEL[o.status] || o.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PER ZI */}
        <TabsContent value="days">
          <Card>
            <CardHeader><CardTitle>Comparație Pe Zile</CardTitle></CardHeader>
            <CardContent>
              {perDay.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Selectează o perioadă.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={perDay}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="zi" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
                      <Legend />
                      <Bar dataKey="planned" name="Planificat" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="actualFromOrders" name="Realizat (comenzile zilei)" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="actualTotalSesiuni" name="Realizat total sesiuni" fill="hsl(210 90% 55%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="overflow-x-auto mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zi</TableHead>
                          <TableHead className="text-right">Planificat</TableHead>
                          <TableHead className="text-right">Realizat (comenzile zilei)</TableHead>
                          <TableHead className="text-right">Realizat total sesiuni</TableHead>
                          <TableHead className="text-right">Diferență</TableHead>
                          <TableHead className="text-right">Realizare</TableHead>
                          <TableHead className="text-right">Nr Comenzi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {perDay.map(d => (
                          <TableRow key={d.ziFull}>
                            <TableCell className="font-medium">{d.zi}</TableCell>
                            <TableCell className="text-right font-semibold">{d.planned.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{d.actualFromOrders.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{d.actualTotalSesiuni.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{diffBadge(d.planned, d.actualFromOrders)}</TableCell>
                            <TableCell className="text-right">{pctBadge(d.planned, d.actualFromOrders)}</TableCell>
                            <TableCell className="text-right">{d.nrComenzi}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PER PRODUS */}
        <TabsContent value="products">
          <Card>
            <CardHeader><CardTitle>Comparație Per Produs</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {perProduct.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nu există produse în perioadă.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produs</TableHead>
                      <TableHead className="text-right">Planificat</TableHead>
                      <TableHead className="text-right">Realizat</TableHead>
                      <TableHead className="text-right">Diferență</TableHead>
                      <TableHead className="text-right">Realizare</TableHead>
                      <TableHead className="text-right">Nr Comenzi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perProduct.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium max-w-[300px] truncate" title={p.produs}>{p.produs}</TableCell>
                        <TableCell className="text-right font-semibold">{p.planned.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{p.actual.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{diffBadge(p.planned, p.actual)}</TableCell>
                        <TableCell className="text-right">{pctBadge(p.planned, p.actual)}</TableCell>
                        <TableCell className="text-right">{p.nr}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsMirror;
