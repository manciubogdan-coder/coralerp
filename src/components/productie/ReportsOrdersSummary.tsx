import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ClipboardList, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import * as XLSX from "xlsx";
import { buildOrdersSummary, summarySheetRows, type SummaryOrder } from "@/lib/productie/ordersSummary";

type Mode = "productie" | "intrare";

const isoDay = (d: Date) => format(d, "yyyy-MM-dd");
const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return isoDay(d); };
const fmt = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });
const others = (m: Record<string, number>) => Object.entries(m).map(([u, v]) => `${fmt(v)} ${u}`).join(" · ");

async function loadDayOrders(day: string, mode: Mode): Promise<SummaryOrder[]> {
  const PAGE = 1000;
  const start = new Date(`${day}T00:00:00`).toISOString();
  const end = new Date(`${shift(day, 1)}T00:00:00`).toISOString();
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("productie_comenzi")
      .select("id, numar_comanda, magazin, punct_livrare, cantitate, status, tip_comanda, productie_produse(nume, unitate_masura)");
    q = mode === "productie" ? q.eq("data_productie", day) : q.gte("created_at", start).lt("created_at", end);
    const { data, error } = await q.order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((r: any) => ({ ...r, produs: r.productie_produse?.nume, unitate: r.productie_produse?.unitate_masura }));
}

const ReportsOrdersSummary = () => {
  const [day, setDay] = useState(() => isoDay(new Date()));
  const [mode, setMode] = useState<Mode>("productie");
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders-summary", mode, day],
    queryFn: () => loadDayOrders(day, mode),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(day),
    staleTime: 60_000,
  });
  const summary = useMemo(() => buildOrdersSummary(data || []), [data]);
  const dayLabel = format(new Date(`${day}T12:00:00`), "EEEE, d MMMM yyyy", { locale: ro });
  const modeLabel = mode === "productie" ? "ziua de producție" : "ziua în care au intrat";

  const exportExcel = () => {
    const rows = summarySheetRows(summary, `Centralizator comenzi — ${dayLabel} (${modeLabel})`);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Size each column to its longest value (title row excluded) so store and product names are never cut off.
    const widths = [10, 10, 10, 4];
    rows.slice(2).forEach(r => r.forEach((v, i) => {
      if (i < widths.length) widths[i] = Math.max(widths[i], String(v ?? "").length + 2);
    }));
    ws["!cols"] = widths.map(wch => ({ wch: Math.min(wch, 90) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Centralizator");
    XLSX.writeFile(wb, `centralizator-comenzi-${day}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Centralizator comenzi
          </CardTitle>
          <Button onClick={exportExcel} disabled={isLoading || summary.stores.length === 0} className="gap-2">
            <Download className="h-4 w-4" /> Descarcă Excel
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Ziua anterioară" onClick={() => setDay(d => shift(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} className="w-44" aria-label="Data" />
          <Button variant="outline" size="icon" aria-label="Ziua următoare" onClick={() => setDay(d => shift(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDay(isoDay(new Date()))}>Azi</Button>
          <div className="flex rounded-md border p-0.5 ml-auto">
            <Button size="sm" variant={mode === "productie" ? "secondary" : "ghost"} onClick={() => setMode("productie")}>După ziua de producție</Button>
            <Button size="sm" variant={mode === "intrare" ? "secondary" : "ghost"} onClick={() => setMode("intrare")}>După ziua intrării</Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {dayLabel} · {summary.stores.length} magazine · {summary.nrComenzi} comenzi · fără producție în avans, reambalări și comenzi anulate
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="text-center text-destructive py-8">Comenzile nu s-au putut încărca. Încearcă din nou.</p>
        ) : summary.stores.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nu există comenzi pentru ziua aleasă.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Magazin</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead className="text-right">Cantitate</TableHead>
                <TableHead>UM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.stores.map(st => (
                <Fragment key={st.store}>
                  {st.rows.map((r, i) => (
                    <TableRow key={`${st.store}|${r.produs}|${r.unitate}`}>
                      <TableCell className="font-medium">{i === 0 ? st.store : ""}</TableCell>
                      <TableCell>{r.produs}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.cantitate)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.unitate}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell className="font-semibold" colSpan={2}>Total {st.store}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmt(st.totalBuc)}</TableCell>
                    <TableCell className="font-semibold">buc{others(st.otherUnits) ? ` · ${others(st.otherUnits)}` : ""}</TableCell>
                  </TableRow>
                </Fragment>
              ))}
              <TableRow className="bg-primary/10 hover:bg-primary/10">
                <TableCell className="font-bold text-base" colSpan={2}>TOTAL ZI</TableCell>
                <TableCell className="text-right font-bold text-base tabular-nums">{fmt(summary.totalBuc)}</TableCell>
                <TableCell className="font-bold">buc{others(summary.otherUnits) ? ` · ${others(summary.otherUnits)}` : ""}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportsOrdersSummary;
