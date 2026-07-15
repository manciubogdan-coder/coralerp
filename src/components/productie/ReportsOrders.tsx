import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProductionLines } from "@/hooks/productie/useProductionData";
import { useOrdersForReports } from "@/hooks/productie/useOrdersForReports";
import { useShifts, calculateShiftDuration } from "@/hooks/productie/useShifts";
import {
  Loader2,
  TrendingUp,
  Factory,
  Package,
  Download,
  Timer,
  Target,
  Gauge,
  ClipboardList,
} from "lucide-react";
import ReportsFilters, { DateFilter } from "./ReportsFilters";
import { format, eachDayOfInterval, startOfDay, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import * as XLSX from "xlsx";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

const ReportsOrders = () => {
  const { data: lines, isLoading: linesLoading } = useProductionLines();
  const { data: orders, isLoading: ordersLoading } = useOrdersForReports();
  const { data: shifts, isLoading: shiftsLoading } = useShifts();

  const [currentFilter, setCurrentFilter] = useState<DateFilter>({
    type: "today",
    dateRange: { from: new Date(), to: new Date() },
    label: "Astăzi",
  });

  const oreDisponibilePeZi = useMemo(() => {
    if (!shifts || shifts.length === 0) return 8;
    return shifts.reduce(
      (sum, s) => sum + calculateShiftDuration(s.ora_start, s.ora_sfarsit),
      0
    );
  }, [shifts]);

  // Comenzi filtrate după perioadă (data_productie sau created_at)
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const from = currentFilter.dateRange?.from
      ? startOfDay(currentFilter.dateRange.from)
      : null;
    const to = currentFilter.dateRange?.to
      ? new Date(
          currentFilter.dateRange.to.getFullYear(),
          currentFilter.dateRange.to.getMonth(),
          currentFilter.dateRange.to.getDate(),
          23, 59, 59
        )
      : from
        ? new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59)
        : null;

    return orders.filter((o: any) => {
      const d = orderRefDate(o);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [orders, currentFilter]);

  const nrZilePerioada = useMemo(() => {
    const from = currentFilter.dateRange?.from;
    const to = currentFilter.dateRange?.to || from;
    if (!from || !to) return 1;
    return Math.max(1, eachDayOfInterval({ start: from, end: to }).length);
  }, [currentFilter]);

  // ─── Per Linie ────────────────────────────────────────────────────────────
  const perLineStats = useMemo(() => {
    if (!lines) return [];
    const NEASIGNAT = { id: "__unassigned__", nume: "Neasignat", capacitate_ora: 0 };
    const allBuckets: Array<{ id: string; nume: string; capacitate_ora: number }> = [
      ...lines.map(l => ({ id: l.id, nume: l.nume, capacitate_ora: l.capacitate_ora || 0 })),
      NEASIGNAT,
    ];

    return allBuckets.map(line => {
      const lineOrders = filteredOrders.filter((o: any) => {
        if (line.id === "__unassigned__") return !o.linie_id;
        return o.linie_id === line.id;
      });

      const totalBuc = lineOrders.reduce(
        (sum, o: any) => sum + Number(o.cantitate || 0),
        0
      );

      const oreEstimate =
        line.capacitate_ora > 0 ? totalBuc / line.capacitate_ora : 0;

      const zileDistincte = new Set(
        lineOrders
          .map((o: any) => orderRefDate(o))
          .filter(Boolean)
          .map((d: Date) => format(d, "yyyy-MM-dd"))
      );

      const produseDistincte = new Set(
        lineOrders.map((o: any) => o.productie_produse?.nume || o.produs_id)
      );

      const bucPeZi = zileDistincte.size > 0 ? totalBuc / zileDistincte.size : 0;

      const nrCompletate = lineOrders.filter((o: any) => o.status === "completed").length;
      const nrInLucru = lineOrders.filter((o: any) => o.status === "in_progress" || o.status === "partial").length;
      const nrPending = lineOrders.filter((o: any) => o.status === "pending" || o.status === "assigned").length;

      return {
        id: line.id,
        nume: line.nume,
        capacitateOra: line.capacitate_ora,
        totalBuc,
        oreEstimate: round1(oreEstimate),
        bucPeZi: round1(bucPeZi),
        nrComenzi: lineOrders.length,
        nrProduse: produseDistincte.size,
        zileDistincte: zileDistincte.size,
        nrCompletate,
        nrInLucru,
        nrPending,
      };
    })
      .filter(l => l.nrComenzi > 0 || l.id !== "__unassigned__")
      .sort((a, b) => b.totalBuc - a.totalBuc);
  }, [lines, filteredOrders]);

  // ─── Per Comandă ──────────────────────────────────────────────────────────
  const perOrderStats = useMemo(() => {
    if (!filteredOrders) return [];
    return filteredOrders
      .map((order: any) => {
        const line = lines?.find(l => l.id === order.linie_id);
        const cap = line?.capacitate_ora || 0;
        const ore = cap > 0 ? Number(order.cantitate || 0) / cap : 0;
        const ref = orderRefDate(order);
        return {
          id: order.id,
          numar: order.numar_comanda,
          produs: order.productie_produse?.nume || "—",
          magazin: order.magazin,
          linie: line?.nume || "Neasignat",
          cantitate: Number(order.cantitate || 0),
          oreEstimate: round1(ore),
          data: ref ? format(ref, "dd.MM.yyyy") : "—",
          dataSort: ref ? ref.getTime() : 0,
          status: order.status,
          cantitateProdusa: Number(order.cantitate_reala_produsa || 0),
        };
      })
      .sort((a, b) => b.dataSort - a.dataSort || b.cantitate - a.cantitate);
  }, [filteredOrders, lines]);

  // ─── Comparativ pe zile ───────────────────────────────────────────────────
  const dailyComparison = useMemo(() => {
    const from = currentFilter.dateRange?.from;
    const to = currentFilter.dateRange?.to || from;
    if (!from || !to) return [];

    const days = eachDayOfInterval({ start: from, end: to });
    return days.map(day => {
      const comenziZi = filteredOrders.filter((o: any) => {
        const d = orderRefDate(o);
        return d && isSameDay(d, day);
      });
      const totalBuc = comenziZi.reduce((sum, o: any) => sum + Number(o.cantitate || 0), 0);
      const oreEstimate = comenziZi.reduce((sum, o: any) => {
        const line = lines?.find(l => l.id === o.linie_id);
        const cap = line?.capacitate_ora || 0;
        return sum + (cap > 0 ? Number(o.cantitate || 0) / cap : 0);
      }, 0);
      const produseDistincte = new Set(
        comenziZi.map((o: any) => o.productie_produse?.nume || o.produs_id)
      );
      return {
        zi: format(day, "dd MMM", { locale: ro }),
        ziFull: format(day, "yyyy-MM-dd"),
        totalBuc,
        oreEstimate: round1(oreEstimate),
        nrComenzi: comenziZi.length,
        nrProduse: produseDistincte.size,
      };
    });
  }, [filteredOrders, currentFilter, lines]);

  // ─── Încărcare per Linie (estimată) ───────────────────────────────────────
  const incarcareLinii = useMemo(() => {
    if (!lines) return [];
    const oreDisponibileTotal = oreDisponibilePeZi * nrZilePerioada;
    return lines.map(line => {
      const lineOrders = filteredOrders.filter((o: any) => o.linie_id === line.id);
      const totalBuc = lineOrders.reduce((s, o: any) => s + Number(o.cantitate || 0), 0);
      const cap = line.capacitate_ora || 0;
      const oreNecesare = cap > 0 ? totalBuc / cap : 0;
      const utilizare = oreDisponibileTotal > 0 ? (oreNecesare / oreDisponibileTotal) * 100 : 0;
      const oreLibere = Math.max(0, oreDisponibileTotal - oreNecesare);
      return {
        id: line.id,
        nume: line.nume,
        oreNecesare: round1(oreNecesare),
        oreDisponibile: round1(oreDisponibileTotal),
        oreLibere: round1(oreLibere),
        utilizare: round1(Math.min(100, utilizare)),
        utilizareBruta: round1(utilizare),
      };
    }).sort((a, b) => b.utilizareBruta - a.utilizareBruta);
  }, [lines, filteredOrders, oreDisponibilePeZi, nrZilePerioada]);

  // ─── KPI ─────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalBuc = filteredOrders.reduce((s, o: any) => s + Number(o.cantitate || 0), 0);
    const oreEstimate = filteredOrders.reduce((s, o: any) => {
      const line = lines?.find(l => l.id === o.linie_id);
      const cap = line?.capacitate_ora || 0;
      return s + (cap > 0 ? Number(o.cantitate || 0) / cap : 0);
    }, 0);
    const clientiSet = new Set(filteredOrders.map((o: any) => o.magazin).filter(Boolean));
    const produseSet = new Set(filteredOrders.map((o: any) => o.productie_produse?.nume || o.produs_id));
    return {
      totalBuc,
      oreEstimate: round1(oreEstimate),
      nrComenzi: filteredOrders.length,
      nrClienti: clientiSet.size,
      nrProduse: produseSet.size,
      nrCompletate: filteredOrders.filter((o: any) => o.status === "completed").length,
    };
  }, [filteredOrders, lines]);

  // ─── Export Excel ────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const sheetLinii = XLSX.utils.json_to_sheet(
      perLineStats.map(l => ({
        Linie: l.nume,
        "Capacitate (buc/oră)": l.capacitateOra,
        "Total Bucăți Comandate": l.totalBuc,
        "Ore Estimate": l.oreEstimate,
        "Buc/Zi": l.bucPeZi,
        "Nr Comenzi": l.nrComenzi,
        "Nr Produse": l.nrProduse,
        "Comenzi Finalizate": l.nrCompletate,
        "În Lucru": l.nrInLucru,
        "Neînceput": l.nrPending,
      }))
    );
    XLSX.utils.book_append_sheet(wb, sheetLinii, "Per Linie");

    const sheetComenzi = XLSX.utils.json_to_sheet(
      perOrderStats.map(o => ({
        Data: o.data,
        "Nr Comandă": o.numar,
        Produs: o.produs,
        Magazin: o.magazin,
        Linie: o.linie,
        "Cantitate Comandată": o.cantitate,
        "Cantitate Produsă": o.cantitateProdusa,
        "Ore Estimate": o.oreEstimate,
        Status: STATUS_LABEL[o.status] || o.status,
      }))
    );
    XLSX.utils.book_append_sheet(wb, sheetComenzi, "Per Comandă");

    const sheetZile = XLSX.utils.json_to_sheet(
      dailyComparison.map(d => ({
        Zi: d.ziFull,
        "Total Bucăți": d.totalBuc,
        "Ore Estimate": d.oreEstimate,
        "Nr Comenzi": d.nrComenzi,
        "Nr Produse": d.nrProduse,
      }))
    );
    XLSX.utils.book_append_sheet(wb, sheetZile, "Comparativ pe Zile");

    const filename = `Raport_Comenzi_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  if (linesLoading || ordersLoading || shiftsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Rapoarte pe Comenzi Introduse</h2>
          <p className="text-muted-foreground">
            Volume și încărcare pe baza comenzilor create — {currentFilter.label}
          </p>
        </div>
        <Button onClick={exportExcel} className="gap-2">
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <ReportsFilters currentFilter={currentFilter} onFilterChange={setCurrentFilter} />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard icon={<Package className="h-4 w-4" />} label="Total Bucăți" value={kpi.totalBuc.toLocaleString()} accent="text-primary" />
        <KpiCard icon={<Timer className="h-4 w-4" />} label="Ore Estimate" value={`${kpi.oreEstimate}h`} accent="text-blue-600" />
        <KpiCard icon={<ClipboardList className="h-4 w-4" />} label="Nr Comenzi" value={kpi.nrComenzi.toString()} accent="text-emerald-600" />
        <KpiCard icon={<Target className="h-4 w-4" />} label="Finalizate" value={kpi.nrCompletate.toString()} accent="text-green-600" />
        <KpiCard icon={<Factory className="h-4 w-4" />} label="Produse" value={kpi.nrProduse.toString()} accent="text-orange-600" />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Clienți" value={kpi.nrClienti.toString()} accent="text-purple-600" />
      </div>

      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="lines" className="gap-2"><Factory className="h-4 w-4" />Per Linie</TabsTrigger>
          <TabsTrigger value="load" className="gap-2"><Gauge className="h-4 w-4" />Încărcare</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><Package className="h-4 w-4" />Per Comandă</TabsTrigger>
          <TabsTrigger value="trend" className="gap-2"><TrendingUp className="h-4 w-4" />Comparativ</TabsTrigger>
        </TabsList>

        {/* PER LINIE */}
        <TabsContent value="lines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Volume Comandate pe Linie
              </CardTitle>
            </CardHeader>
            <CardContent>
              {perLineStats.filter(l => l.totalBuc > 0).length === 0 ? (
                <EmptyState text="Nu există comenzi introduse în perioada selectată" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={perLineStats.filter(l => l.totalBuc > 0)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="nume" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
                    <Legend />
                    <Bar dataKey="totalBuc" name="Buc Comandate" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="oreEstimate" name="Ore Estimate" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} />
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
                    <TableHead className="text-right">Cap. buc/oră</TableHead>
                    <TableHead className="text-right">Total Buc</TableHead>
                    <TableHead className="text-right">Ore Estimate</TableHead>
                    <TableHead className="text-right">Buc/Zi</TableHead>
                    <TableHead className="text-right">Comenzi</TableHead>
                    <TableHead className="text-right">Produse</TableHead>
                    <TableHead className="text-right">Finalizate</TableHead>
                    <TableHead className="text-right">În Lucru</TableHead>
                    <TableHead className="text-right">Neînceput</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perLineStats.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.nume}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{l.capacitateOra || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{l.totalBuc.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{l.oreEstimate}h</TableCell>
                      <TableCell className="text-right">{l.bucPeZi}</TableCell>
                      <TableCell className="text-right">{l.nrComenzi}</TableCell>
                      <TableCell className="text-right">{l.nrProduse}</TableCell>
                      <TableCell className="text-right text-emerald-600">{l.nrCompletate}</TableCell>
                      <TableCell className="text-right text-amber-600">{l.nrInLucru}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{l.nrPending}</TableCell>
                    </TableRow>
                  ))}
                  {perLineStats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                        Nu există comenzi în perioada selectată
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ÎNCĂRCARE */}
        <TabsContent value="load" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Încărcare Estimată din Comenzi Introduse
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Ore necesare pentru comenzile introduse vs.{" "}
                <span className="font-semibold text-foreground">
                  {round1(oreDisponibilePeZi)}h/zi × {nrZilePerioada} zi(le) = {round1(oreDisponibilePeZi * nrZilePerioada)}h
                </span>{" "}
                disponibile pe linie
              </p>
            </CardHeader>
            <CardContent>
              {incarcareLinii.length === 0 ? (
                <EmptyState text="Nu există linii configurate" />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(280, incarcareLinii.length * 50)}>
                  <BarChart data={incarcareLinii} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} unit="%" className="text-xs" />
                    <YAxis type="category" dataKey="nume" className="text-xs" width={120} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }}
                      formatter={(value: number, _name: string, props: any) => {
                        const item = props.payload;
                        return [`${value}% (${item.oreNecesare}h / ${item.oreDisponibile}h)`, "Utilizare"];
                      }}
                    />
                    <Bar dataKey="utilizare" name="Utilizare %" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Detaliu Încărcare per Linie</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linie</TableHead>
                    <TableHead className="text-right">Ore Necesare</TableHead>
                    <TableHead className="text-right">Ore Disponibile</TableHead>
                    <TableHead className="text-right">Ore Libere</TableHead>
                    <TableHead className="text-right">Utilizare</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incarcareLinii.map(l => {
                    const culoare = l.utilizareBruta >= 100 ? "text-red-600" : l.utilizareBruta >= 85 ? "text-emerald-600" : l.utilizareBruta >= 50 ? "text-amber-600" : "text-muted-foreground";
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nume}</TableCell>
                        <TableCell className="text-right font-semibold">{l.oreNecesare}h</TableCell>
                        <TableCell className="text-right text-muted-foreground">{l.oreDisponibile}h</TableCell>
                        <TableCell className="text-right text-muted-foreground">{l.oreLibere}h</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full ${l.utilizareBruta >= 100 ? "bg-red-500" : l.utilizareBruta >= 85 ? "bg-emerald-500" : l.utilizareBruta >= 50 ? "bg-amber-500" : "bg-muted-foreground"}`}
                                style={{ width: `${Math.min(100, l.utilizareBruta)}%` }}
                              />
                            </div>
                            <span className={`font-bold ${culoare} min-w-[3rem]`}>{l.utilizareBruta}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PER COMANDĂ */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Comenzi Introduse
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Toate comenzile din perioada selectată — indiferent dacă au fost produse
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Comandă</TableHead>
                    <TableHead>Linie</TableHead>
                    <TableHead className="text-right">Comandat</TableHead>
                    <TableHead className="text-right">Produs</TableHead>
                    <TableHead className="text-right">Ore Est.</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perOrderStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        Nu există comenzi în perioada selectată
                      </TableCell>
                    </TableRow>
                  ) : (
                    perOrderStats.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{o.data}</TableCell>
                        <TableCell>
                          <div className="font-medium">{o.produs}</div>
                          <div className="text-xs text-muted-foreground">#{o.numar} • {o.magazin}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{o.linie}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{o.cantitate.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{o.cantitateProdusa.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{o.oreEstimate}h</TableCell>
                        <TableCell>
                          <Badge variant={o.status === "completed" ? "default" : o.status === "in_progress" || o.status === "partial" ? "secondary" : "outline"}>
                            {STATUS_LABEL[o.status] || o.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPARATIV */}
        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Trend Comenzi pe Zile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyComparison.length === 0 ? (
                <EmptyState text="Selectează o perioadă pentru a vedea trendul" />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={dailyComparison}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="zi" className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="totalBuc" name="Total Bucăți" stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(217 91% 60%)" }} activeDot={{ r: 6 }} />
                    <Line yAxisId="right" type="monotone" dataKey="oreEstimate" name="Ore Estimate" stroke="hsl(25 95% 53%)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4, fill: "hsl(25 95% 53%)" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Detaliu Zilnic</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zi</TableHead>
                    <TableHead className="text-right">Total Bucăți</TableHead>
                    <TableHead className="text-right">Ore Estimate</TableHead>
                    <TableHead className="text-right">Nr Comenzi</TableHead>
                    <TableHead className="text-right">Nr Produse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyComparison.map(d => (
                    <TableRow key={d.ziFull}>
                      <TableCell className="font-medium">{d.zi}</TableCell>
                      <TableCell className="text-right font-semibold">{d.totalBuc.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-blue-600">{d.oreEstimate}h</TableCell>
                      <TableCell className="text-right">{d.nrComenzi}</TableCell>
                      <TableCell className="text-right">{d.nrProduse}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const KpiCard = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    </CardContent>
  </Card>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center text-muted-foreground py-12">
    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
    <p>{text}</p>
  </div>
);

export default ReportsOrders;
