import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProductionLines, useWorkSessions } from "@/hooks/productie/useProductionData";
import { useOrdersForReports } from "@/hooks/productie/useOrdersForReports";
import { useShifts, calculateShiftDuration } from "@/hooks/productie/useShifts";
import {
  Loader2,
  TrendingUp,
  Users,
  Factory,
  Package,
  Download,
  Activity,
  Timer,
  Target,
  Gauge,
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
  ComposedChart,
} from "recharts";
import * as XLSX from "xlsx";

// ─── Helpers ────────────────────────────────────────────────────────────────

const minutesBetween = (start?: string | null, end?: string | null) => {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 0;
  return (e - s) / 60000;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const countOperators = (numeOperator?: string | null) => {
  if (!numeOperator) return 0;
  return numeOperator.split(",").map(s => s.trim()).filter(Boolean).length;
};

// ─── Component ──────────────────────────────────────────────────────────────

const Reports = () => {
  const { data: lines, isLoading: linesLoading } = useProductionLines();
  const { data: orders, isLoading: ordersLoading } = useOrdersForReports();
  const { data: workSessions, isLoading: sessionsLoading } = useWorkSessions();
  const { data: shifts, isLoading: shiftsLoading } = useShifts();

  const [currentFilter, setCurrentFilter] = useState<DateFilter>({
    type: "today",
    dateRange: { from: new Date(), to: new Date() },
    label: "Astăzi",
  });

  // Total ore disponibile pe zi (suma duratelor tuturor schimburilor configurate)
  const oreDisponibilePeZi = useMemo(() => {
    if (!shifts || shifts.length === 0) return 8; // fallback
    return shifts.reduce(
      (sum, s) => sum + calculateShiftDuration(s.ora_start, s.ora_sfarsit),
      0
    );
  }, [shifts]);

  // Sesiuni filtrate după perioada selectată (folosim ora_start ca referință)
  const filteredSessions = useMemo(() => {
    if (!workSessions) return [];
    const from = currentFilter.dateRange?.from
      ? startOfDay(currentFilter.dateRange.from)
      : null;
    const to = currentFilter.dateRange?.to
      ? new Date(currentFilter.dateRange.to.getFullYear(), currentFilter.dateRange.to.getMonth(), currentFilter.dateRange.to.getDate(), 23, 59, 59)
      : from
        ? new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59)
        : null;

    return workSessions.filter(s => {
      const ref = s.ora_start || s.created_at;
      if (!ref) return false;
      const d = new Date(ref);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [workSessions, currentFilter]);

  // ─── Per Linie ────────────────────────────────────────────────────────────
  const perLineStats = useMemo(() => {
    if (!lines) return [];

    return lines.map(line => {
      const lineSessions = filteredSessions.filter(s => s.linie_id === line.id);

      const totalBuc = lineSessions.reduce(
        (sum, s) => sum + (s.cantitate_produsa || 0),
        0
      );

      const totalMinReale = lineSessions.reduce(
        (sum, s) => sum + minutesBetween(s.ora_start, s.ora_sfarsit),
        0
      );
      const oreReale = totalMinReale / 60;

      // Zile distincte în care s-a lucrat pe această linie
      const zileLucratoare = new Set(
        lineSessions
          .filter(s => s.ora_start)
          .map(s => format(new Date(s.ora_start!), "yyyy-MM-dd"))
      );
      // Ore calendaristice = nr zile × 8h (schimb standard) - păstrat pentru export
      const oreCalendaristice = zileLucratoare.size * 8;

      const bucPeOraReale = oreReale > 0 ? totalBuc / oreReale : 0;
      // Buc/minut bazat pe timpul real lucrat
      const bucPeMinut = totalMinReale > 0 ? totalBuc / totalMinReale : 0;
      const bucPeZi = zileLucratoare.size > 0 ? totalBuc / zileLucratoare.size : 0;

      // Operatori distincti pe această linie
      const operatoriSet = new Set<string>();
      lineSessions.forEach(s => {
        (s.nume_operator || "")
          .split(",")
          .map(n => n.trim())
          .filter(Boolean)
          .forEach(n => operatoriSet.add(n.toLowerCase()));
      });

      const sesiuniActive = lineSessions.filter(s => s.status === "activa").length;

      return {
        id: line.id,
        nume: line.nume,
        totalBuc,
        oreReale: round1(oreReale),
        oreCalendaristice,
        bucPeOraReale: round1(bucPeOraReale),
        bucPeOraCal: round1(bucPeOraCal),
        bucPeZi: round1(bucPeZi),
        nrSesiuni: lineSessions.length,
        nrOperatori: operatoriSet.size,
        operatori: Array.from(operatoriSet),
        zileLucratoare: zileLucratoare.size,
        sesiuniActive,
      };
    }).sort((a, b) => b.totalBuc - a.totalBuc);
  }, [lines, filteredSessions]);

  // ─── Per Comandă ──────────────────────────────────────────────────────────
  const perOrderStats = useMemo(() => {
    if (!orders) return [];

    return orders
      .map(order => {
        const orderSessions = filteredSessions.filter(s => s.comanda_id === order.id);
        if (orderSessions.length === 0) return null;

        const totalBuc = orderSessions.reduce(
          (sum, s) => sum + (s.cantitate_produsa || 0),
          0
        );
        const totalMin = orderSessions.reduce(
          (sum, s) => sum + minutesBetween(s.ora_start, s.ora_sfarsit),
          0
        );
        const oreReale = totalMin / 60;
        const bucPeOra = oreReale > 0 ? totalBuc / oreReale : 0;

        const linieNume =
          lines?.find(l => l.id === orderSessions[0].linie_id)?.nume || "—";

        const operatoriSet = new Set<string>();
        orderSessions.forEach(s => {
          (s.nume_operator || "")
            .split(",")
            .map(n => n.trim())
            .filter(Boolean)
            .forEach(n => operatoriSet.add(n));
        });

        const procentFinalizat =
          order.cantitate > 0 ? (totalBuc / order.cantitate) * 100 : 0;

        return {
          id: order.id,
          numar: order.numar_comanda,
          produs: order.productie_produse?.nume || "—",
          magazin: order.magazin,
          linie: linieNume,
          cantitate: order.cantitate,
          totalBuc,
          oreReale: round1(oreReale),
          bucPeOra: round1(bucPeOra),
          operatori: Array.from(operatoriSet),
          nrOperatori: operatoriSet.size,
          procentFinalizat: round1(procentFinalizat),
          status: order.status,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.bucPeOra - a.bucPeOra);
  }, [orders, filteredSessions, lines]);

  // ─── Comparativ pe zile ───────────────────────────────────────────────────
  const dailyComparison = useMemo(() => {
    const from = currentFilter.dateRange?.from;
    const to = currentFilter.dateRange?.to || from;
    if (!from || !to) return [];

    const days = eachDayOfInterval({ start: from, end: to });
    return days.map(day => {
      const sesiuniZi = filteredSessions.filter(s => {
        const ref = s.ora_start || s.created_at;
        return ref && isSameDay(new Date(ref), day);
      });

      const totalBuc = sesiuniZi.reduce(
        (sum, s) => sum + (s.cantitate_produsa || 0),
        0
      );
      const totalMin = sesiuniZi.reduce(
        (sum, s) => sum + minutesBetween(s.ora_start, s.ora_sfarsit),
        0
      );
      const oreReale = totalMin / 60;
      const bucPeOra = oreReale > 0 ? totalBuc / oreReale : 0;

      const operatoriSet = new Set<string>();
      sesiuniZi.forEach(s => {
        (s.nume_operator || "")
          .split(",")
          .map(n => n.trim())
          .filter(Boolean)
          .forEach(n => operatoriSet.add(n.toLowerCase()));
      });

      return {
        zi: format(day, "dd MMM", { locale: ro }),
        ziFull: format(day, "yyyy-MM-dd"),
        totalBuc,
        bucPeOra: round1(bucPeOra),
        oreReale: round1(oreReale),
        operatori: operatoriSet.size,
        sesiuni: sesiuniZi.length,
      };
    });
  }, [filteredSessions, currentFilter]);

  // ─── Numărul de zile din perioada selectată ─────────────────────────────
  const nrZilePerioada = useMemo(() => {
    const from = currentFilter.dateRange?.from;
    const to = currentFilter.dateRange?.to || from;
    if (!from || !to) return 1;
    return Math.max(1, eachDayOfInterval({ start: from, end: to }).length);
  }, [currentFilter]);

  // ─── Încărcare per Linie (utilizare) ───────────────────────────────────
  // Comparăm orele lucrate vs orele disponibile (schimburi × zile)
  const incarcareLinii = useMemo(() => {
    if (!lines) return [];
    const oreDisponibileTotal = oreDisponibilePeZi * nrZilePerioada;

    return lines.map(line => {
      const lineSessions = filteredSessions.filter(s => s.linie_id === line.id);
      const totalMin = lineSessions.reduce(
        (sum, s) => sum + minutesBetween(s.ora_start, s.ora_sfarsit),
        0
      );
      const oreLucrate = totalMin / 60;
      const utilizare = oreDisponibileTotal > 0
        ? (oreLucrate / oreDisponibileTotal) * 100
        : 0;
      const oreLibere = Math.max(0, oreDisponibileTotal - oreLucrate);

      return {
        id: line.id,
        nume: line.nume,
        oreLucrate: round1(oreLucrate),
        oreDisponibile: round1(oreDisponibileTotal),
        oreLibere: round1(oreLibere),
        utilizare: round1(Math.min(100, utilizare)),
        utilizareBruta: round1(utilizare), // poate depăși 100% dacă lucrează în paralel
      };
    }).sort((a, b) => b.utilizare - a.utilizare);
  }, [lines, filteredSessions, oreDisponibilePeZi, nrZilePerioada]);

  // ─── Încărcare per Schimb pe fiecare Linie ─────────────────────────────
  const incarcarePerSchimb = useMemo(() => {
    if (!lines || !shifts || shifts.length === 0) return [];

    const parseHM = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    };

    // Pentru fiecare sesiune, calculăm overlap-ul cu fiecare schimb
    const overlapMinutes = (
      sStart: Date, sEnd: Date,
      shiftStart: number, shiftEnd: number
    ): number => {
      // Calculăm pentru fiecare zi din intervalul sesiunii
      let total = 0;
      const dayMs = 24 * 60 * 60 * 1000;
      const cursor = new Date(sStart.getFullYear(), sStart.getMonth(), sStart.getDate());
      const lastDay = new Date(sEnd.getFullYear(), sEnd.getMonth(), sEnd.getDate());

      while (cursor.getTime() <= lastDay.getTime()) {
        // Fereastra de schimb pentru această zi (gestionăm overnight)
        const winStart = new Date(cursor);
        winStart.setMinutes(shiftStart);
        const winEnd = new Date(cursor);
        if (shiftEnd > shiftStart) {
          winEnd.setMinutes(shiftEnd);
        } else {
          // overnight: se termină a doua zi
          winEnd.setDate(winEnd.getDate() + 1);
          winEnd.setMinutes(shiftEnd);
        }
        const overlapStart = Math.max(sStart.getTime(), winStart.getTime());
        const overlapEnd = Math.min(sEnd.getTime(), winEnd.getTime());
        if (overlapEnd > overlapStart) {
          total += (overlapEnd - overlapStart) / 60000;
        }
        cursor.setTime(cursor.getTime() + dayMs);
      }
      return total;
    };

    return lines.map(line => {
      const lineSessions = filteredSessions.filter(
        s => s.linie_id === line.id && s.ora_start && s.ora_sfarsit
      );

      const perSchimb = shifts.map(shift => {
        const shiftStart = parseHM(shift.ora_start);
        const shiftEnd = parseHM(shift.ora_sfarsit);
        const durataSchimb = calculateShiftDuration(shift.ora_start, shift.ora_sfarsit);
        const oreDispSchimb = durataSchimb * nrZilePerioada;

        let totalMin = 0;
        lineSessions.forEach(s => {
          totalMin += overlapMinutes(
            new Date(s.ora_start!),
            new Date(s.ora_sfarsit!),
            shiftStart,
            shiftEnd
          );
        });
        const ore = totalMin / 60;
        return {
          schimb: shift.nume,
          oreLucrate: round1(ore),
          oreDisponibile: round1(oreDispSchimb),
          utilizare: oreDispSchimb > 0 ? round1((ore / oreDispSchimb) * 100) : 0,
        };
      });

      return {
        id: line.id,
        nume: line.nume,
        schimburi: perSchimb,
      };
    });
  }, [lines, shifts, filteredSessions, nrZilePerioada]);

  // ─── Încărcare zilnică pe linie (pentru grafic pe zile) ──────────────────
  // Returnează: [{ data: "12 Apr", "Linia 1": 8.5, "Linia 2": 4.2, ... }, ...]
  const incarcareZilnica = useMemo(() => {
    if (!lines || !currentFilter.dateRange?.from) return { data: [], lineNames: [] };
    const from = startOfDay(currentFilter.dateRange.from);
    const to = currentFilter.dateRange.to
      ? startOfDay(currentFilter.dateRange.to)
      : from;
    const zile = eachDayOfInterval({ start: from, end: to });

    const data = zile.map(zi => {
      const row: Record<string, any> = {
        data: format(zi, "dd MMM", { locale: ro }),
        dataFull: format(zi, "dd MMM yyyy", { locale: ro }),
        oreDisponibile: round1(oreDisponibilePeZi),
      };
      lines.forEach(line => {
        const oreLine = filteredSessions
          .filter(s => s.linie_id === line.id && s.ora_start)
          .filter(s => isSameDay(new Date(s.ora_start!), zi))
          .reduce((sum, s) => sum + minutesBetween(s.ora_start, s.ora_sfarsit), 0) / 60;
        row[line.nume] = round1(oreLine);
      });
      return row;
    });

    return { data, lineNames: lines.map(l => l.nume) };
  }, [lines, filteredSessions, currentFilter, oreDisponibilePeZi]);

  // Paletă de culori HSL pentru linii (semantică, evită hardcodare)
  const lineColors = useMemo(() => {
    const hues = [210, 150, 35, 280, 0, 180, 50, 320, 100, 260];
    return incarcareZilnica.lineNames.map((_, i) => `hsl(${hues[i % hues.length]} 70% 50%)`);
  }, [incarcareZilnica.lineNames]);

  // ─── KPI Generale ─────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalBuc = filteredSessions.reduce(
      (sum, s) => sum + (s.cantitate_produsa || 0),
      0
    );
    const totalMin = filteredSessions.reduce(
      (sum, s) => sum + minutesBetween(s.ora_start, s.ora_sfarsit),
      0
    );
    const ore = totalMin / 60;
    const operatoriSet = new Set<string>();
    filteredSessions.forEach(s => {
      (s.nume_operator || "")
        .split(",")
        .map(n => n.trim())
        .filter(Boolean)
        .forEach(n => operatoriSet.add(n.toLowerCase()));
    });
    return {
      totalBuc,
      oreReale: round1(ore),
      bucPeOra: ore > 0 ? round1(totalBuc / ore) : 0,
      operatori: operatoriSet.size,
      sesiuni: filteredSessions.length,
      sesiuniActive: filteredSessions.filter(s => s.status === "activa").length,
    };
  }, [filteredSessions]);

  // ─── Export Excel ─────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const sheetLinii = XLSX.utils.json_to_sheet(
      perLineStats.map(l => ({
        Linie: l.nume,
        "Total Bucăți": l.totalBuc,
        "Ore Reale Lucrate": l.oreReale,
        "Ore Calendaristice (8h/zi)": l.oreCalendaristice,
        "Buc/Oră (real)": l.bucPeOraReale,
        "Buc/Oră (calendar)": l.bucPeOraCal,
        "Buc/Zi": l.bucPeZi,
        "Zile Lucrate": l.zileLucratoare,
        "Nr Sesiuni": l.nrSesiuni,
        "Nr Operatori": l.nrOperatori,
        Operatori: l.operatori.join(", "),
      }))
    );
    XLSX.utils.book_append_sheet(wb, sheetLinii, "Per Linie");

    const sheetComenzi = XLSX.utils.json_to_sheet(
      perOrderStats.map(o => ({
        "Nr Comandă": o.numar,
        Produs: o.produs,
        Magazin: o.magazin,
        Linie: o.linie,
        "Cantitate Comandată": o.cantitate,
        "Cantitate Produsă": o.totalBuc,
        "% Finalizat": o.procentFinalizat,
        "Ore Reale": o.oreReale,
        "Buc/Oră": o.bucPeOra,
        Operatori: o.operatori.join(", "),
        Status: o.status,
      }))
    );
    XLSX.utils.book_append_sheet(wb, sheetComenzi, "Per Comandă");

    const sheetZile = XLSX.utils.json_to_sheet(
      dailyComparison.map(d => ({
        Zi: d.ziFull,
        "Total Bucăți": d.totalBuc,
        "Buc/Oră": d.bucPeOra,
        "Ore Reale": d.oreReale,
        "Nr Operatori": d.operatori,
        "Nr Sesiuni": d.sesiuni,
      }))
    );
    XLSX.utils.book_append_sheet(wb, sheetZile, "Comparativ pe Zile");

    const filename = `Raport_Productie_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  if (linesLoading || ordersLoading || sessionsLoading || shiftsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Rapoarte Producție</h2>
          <p className="text-muted-foreground">
            Productivitate, randament și comparații — {currentFilter.label}
          </p>
        </div>
        <Button onClick={exportExcel} className="gap-2">
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <ReportsFilters currentFilter={currentFilter} onFilterChange={setCurrentFilter} />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          label="Total Bucăți"
          value={kpi.totalBuc.toLocaleString()}
          accent="text-primary"
        />
        <KpiCard
          icon={<Timer className="h-4 w-4" />}
          label="Ore Reale"
          value={`${kpi.oreReale}h`}
          accent="text-blue-600"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Buc/Oră Mediu"
          value={kpi.bucPeOra.toString()}
          accent="text-emerald-600"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Operatori"
          value={kpi.operatori.toString()}
          accent="text-purple-600"
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Sesiuni"
          value={kpi.sesiuni.toString()}
          accent="text-orange-600"
        />
        <KpiCard
          icon={<Factory className="h-4 w-4" />}
          label="Sesiuni Active"
          value={kpi.sesiuniActive.toString()}
          accent="text-green-600"
          pulse={kpi.sesiuniActive > 0}
        />
      </div>

      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="lines" className="gap-2">
            <Factory className="h-4 w-4" />
            Per Linie
          </TabsTrigger>
          <TabsTrigger value="load" className="gap-2">
            <Gauge className="h-4 w-4" />
            Încărcare
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <Package className="h-4 w-4" />
            Per Comandă
          </TabsTrigger>
          <TabsTrigger value="trend" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Comparativ
          </TabsTrigger>
        </TabsList>

        {/* ─── PER LINIE ──────────────────────────────────────────────── */}
        <TabsContent value="lines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Randament — Buc/Oră pe Linie
              </CardTitle>
            </CardHeader>
            <CardContent>
              {perLineStats.filter(l => l.totalBuc > 0).length === 0 ? (
                <EmptyState text="Nu există producție în perioada selectată" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={perLineStats.filter(l => l.totalBuc > 0)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="nume" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="bucPeOraReale"
                      name="Buc/Oră (timp real)"
                      fill="hsl(var(--primary))"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="bucPeOraCal"
                      name="Buc/Oră (calendar 8h)"
                      fill="hsl(var(--muted-foreground))"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detaliu Per Linie</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linie</TableHead>
                    <TableHead className="text-right">Total Buc</TableHead>
                    <TableHead className="text-right">Ore Reale</TableHead>
                    <TableHead className="text-right">Buc/Oră (real)</TableHead>
                    <TableHead className="text-right">Buc/Oră (calendar)</TableHead>
                    <TableHead className="text-right">Buc/Zi</TableHead>
                    <TableHead className="text-right">Operatori</TableHead>
                    <TableHead className="text-right">Sesiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perLineStats.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {l.nume}
                          {l.sesiuniActive > 0 && (
                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                        </div>
                        {l.operatori.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                            {l.operatori.join(", ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {l.totalBuc.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {l.oreReale}h
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-emerald-600">
                          {l.bucPeOraReale}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {l.bucPeOraCal}
                      </TableCell>
                      <TableCell className="text-right">{l.bucPeZi}</TableCell>
                      <TableCell className="text-right">{l.nrOperatori}</TableCell>
                      <TableCell className="text-right">{l.nrSesiuni}</TableCell>
                    </TableRow>
                  ))}
                  {perLineStats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                        Nu există linii configurate
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PER COMANDĂ ────────────────────────────────────────────── */}
        {/* ─── ÎNCĂRCARE LINII ────────────────────────────────────────── */}
        <TabsContent value="load" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Grad de Încărcare a Liniilor
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Câte ore lucrează fiecare linie din totalul de{" "}
                <span className="font-semibold text-foreground">
                  {round1(oreDisponibilePeZi)}h/zi
                </span>{" "}
                disponibile ({shifts?.length || 0} schimburi configurate) ×{" "}
                {nrZilePerioada} zi(le) ={" "}
                <span className="font-semibold text-foreground">
                  {round1(oreDisponibilePeZi * nrZilePerioada)}h disponibile
                </span>{" "}
                pe linie
              </p>
            </CardHeader>
            <CardContent>
              {incarcareLinii.length === 0 ? (
                <EmptyState text="Nu există linii configurate" />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(280, incarcareLinii.length * 50)}>
                  <BarChart
                    data={incarcareLinii}
                    layout="vertical"
                    margin={{ left: 20, right: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} unit="%" className="text-xs" />
                    <YAxis type="category" dataKey="nume" className="text-xs" width={120} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                      formatter={(value: number, name: string, props: any) => {
                        const item = props.payload;
                        return [
                          `${value}% (${item.oreLucrate}h / ${item.oreDisponibile}h)`,
                          "Utilizare",
                        ];
                      }}
                    />
                    <Bar dataKey="utilizare" name="Utilizare %" radius={[0, 6, 6, 0]}>
                      {incarcareLinii.map((entry, idx) => (
                        <Tooltip key={idx} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Încărcare zilnică pe linie - grafic pe zile */}
          {incarcareZilnica.data.length > 0 && incarcareZilnica.lineNames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Încărcare Zilnică pe Linie
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Câte ore a lucrat fiecare linie în fiecare zi din perioada selectată
                  (linia roșie întreruptă = capacitate zilnică disponibilă: {round1(oreDisponibilePeZi)}h)
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={incarcareZilnica.data} margin={{ left: 10, right: 20, top: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="data" className="text-xs" />
                    <YAxis
                      className="text-xs"
                      label={{ value: "Ore", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                      labelFormatter={(label, payload) => {
                        const full = payload?.[0]?.payload?.dataFull;
                        return full || label;
                      }}
                      formatter={(value: number, name: string) => [`${value}h`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                    {incarcareZilnica.lineNames.map((name, idx) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        fill={lineColors[idx]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="oreDisponibile"
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                      name="Capacitate/zi"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Detaliu numeric per linie */}
          <Card>
            <CardHeader>
              <CardTitle>Detaliu Încărcare per Linie</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linie</TableHead>
                    <TableHead className="text-right">Ore Lucrate</TableHead>
                    <TableHead className="text-right">Ore Disponibile</TableHead>
                    <TableHead className="text-right">Ore Libere</TableHead>
                    <TableHead className="text-right">Utilizare</TableHead>
                    <TableHead className="text-right">Potențial</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incarcareLinii.map(l => {
                    const culoare =
                      l.utilizare >= 85
                        ? "text-emerald-600"
                        : l.utilizare >= 50
                          ? "text-amber-600"
                          : "text-red-500";
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nume}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {l.oreLucrate}h
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {l.oreDisponibile}h
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {l.oreLibere}h
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full ${
                                  l.utilizare >= 85
                                    ? "bg-emerald-500"
                                    : l.utilizare >= 50
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(100, l.utilizare)}%` }}
                              />
                            </div>
                            <span className={`font-bold ${culoare} min-w-[3rem]`}>
                              {l.utilizare}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {l.utilizare < 85 ? (
                            <Badge variant="outline" className="text-emerald-600">
                              +{round1(100 - l.utilizare)}%
                            </Badge>
                          ) : (
                            <Badge variant="outline">Maxim</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Heatmap încărcare per schimb × linie */}
          {shifts && shifts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Încărcare per Schimb</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Cât din fiecare schimb este folosit pe fiecare linie
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linie</TableHead>
                      {shifts.map(s => (
                        <TableHead key={s.id} className="text-center">
                          {s.nume}
                          <div className="text-xs font-normal text-muted-foreground">
                            {s.ora_start.substring(0, 5)}–{s.ora_sfarsit.substring(0, 5)}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incarcarePerSchimb.map(line => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">{line.nume}</TableCell>
                        {line.schimburi.map((sch, idx) => {
                          const bg =
                            sch.utilizare >= 85
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                              : sch.utilizare >= 50
                                ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                                : sch.utilizare > 0
                                  ? "bg-red-500/15 text-red-700 dark:text-red-400"
                                  : "bg-muted text-muted-foreground";
                          return (
                            <TableCell key={idx} className="text-center">
                              <div className={`inline-flex flex-col items-center px-3 py-1.5 rounded-md ${bg}`}>
                                <span className="font-bold">{sch.utilizare}%</span>
                                <span className="text-xs opacity-80">
                                  {sch.oreLucrate}h / {sch.oreDisponibile}h
                                </span>
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── PER COMANDĂ ────────────────────────────────────────────── */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Productivitate per Comandă
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sortat după buc/oră — vezi rapid care comenzi au mers cel mai bine
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comandă</TableHead>
                    <TableHead>Linie</TableHead>
                    <TableHead className="text-right">Comandat</TableHead>
                    <TableHead className="text-right">Produs</TableHead>
                    <TableHead className="text-right">% Final</TableHead>
                    <TableHead className="text-right">Ore</TableHead>
                    <TableHead className="text-right">Buc/Oră</TableHead>
                    <TableHead>Operatori</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perOrderStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                        Nu există sesiuni de producție în perioada selectată
                      </TableCell>
                    </TableRow>
                  ) : (
                    perOrderStats.map(o => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <div className="font-medium">{o.produs}</div>
                          <div className="text-xs text-muted-foreground">
                            #{o.numar} • {o.magazin}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{o.linie}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{o.cantitate}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {o.totalBuc}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              o.procentFinalizat >= 100
                                ? "text-emerald-600 font-semibold"
                                : o.procentFinalizat >= 50
                                  ? "text-amber-600"
                                  : "text-muted-foreground"
                            }
                          >
                            {o.procentFinalizat}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {o.oreReale}h
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-emerald-600">{o.bucPeOra}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-wrap gap-1">
                            {o.operatori.slice(0, 3).map(op => (
                              <Badge key={op} variant="secondary" className="text-xs">
                                {op}
                              </Badge>
                            ))}
                            {o.operatori.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{o.operatori.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── COMPARATIV ─────────────────────────────────────────────── */}
        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Trend Producție pe Zile
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
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalBuc"
                      name="Total Bucăți"
                      stroke="hsl(217 91% 60%)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "hsl(217 91% 60%)" }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="bucPeOra"
                      name="Buc/Oră"
                      stroke="hsl(25 95% 53%)"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={{ r: 4, fill: "hsl(25 95% 53%)" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detaliu Zilnic</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zi</TableHead>
                    <TableHead className="text-right">Total Bucăți</TableHead>
                    <TableHead className="text-right">Ore Reale</TableHead>
                    <TableHead className="text-right">Buc/Oră</TableHead>
                    <TableHead className="text-right">Operatori</TableHead>
                    <TableHead className="text-right">Sesiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyComparison.map(d => (
                    <TableRow key={d.ziFull}>
                      <TableCell className="font-medium">{d.zi}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {d.totalBuc.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {d.oreReale}h
                      </TableCell>
                      <TableCell className="text-right text-emerald-600 font-semibold">
                        {d.bucPeOra}
                      </TableCell>
                      <TableCell className="text-right">{d.operatori}</TableCell>
                      <TableCell className="text-right">{d.sesiuni}</TableCell>
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

// ─── Sub-components ─────────────────────────────────────────────────────────

const KpiCard = ({
  icon,
  label,
  value,
  accent,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  pulse?: boolean;
}) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${accent} ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </div>
    </CardContent>
  </Card>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center text-muted-foreground py-12">
    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
    <p>{text}</p>
  </div>
);

export default Reports;
