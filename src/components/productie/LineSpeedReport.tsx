import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import * as XLSX from "xlsx";
import { Download, Gauge, Loader2, Timer, Package, Lightbulb } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ReportsFilters, { DateFilter } from "./ReportsFilters";
import { useProductionLines } from "@/hooks/productie/useProductionData";
import { useLineSpeedData } from "@/hooks/productie/useLineSpeedData";
import { buildSpeedReport, normaTone, SUSPECT_LABEL, type SpeedStat, type LineReport } from "@/lib/productie/lineSpeed";

const n0 = (x: number) => Math.round(x).toLocaleString("ro-RO");
const n1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const r1 = (x: number) => Math.round(x * 10) / 10;
const dayKey = (iso: string) => format(new Date(iso), "yyyy-MM-dd");
const dayLabel = (k: string) => format(new Date(`${k}T12:00:00`), "EEE dd MMM", { locale: ro });

const TONE: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  bad: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  none: "bg-muted text-muted-foreground",
};

const Pct = ({ p }: { p: number | null }) => (
  <span className={`inline-block min-w-[3.5rem] rounded px-2 py-0.5 text-center text-xs font-semibold ${TONE[normaTone(p)]}`}>
    {p == null ? "fără normă" : `${Math.round(p)}%`}
  </span>
);

const Kpi = ({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </CardContent>
  </Card>
);

const StatCells = ({ s }: { s: SpeedStat }) => (
  <>
    <TableCell className="text-right">{n1(s.ore)}h</TableCell>
    <TableCell className="text-right">{n0(s.buc)}</TableCell>
    <TableCell className="text-right font-semibold">{n0(s.bucPeOra)}</TableCell>
    <TableCell className="text-right"><Pct p={s.procentNorma} /></TableCell>
  </>
);

const LineSpeedReport = () => {
  const today = new Date();
  const [filter, setFilter] = useState<DateFilter>({ type: "week", dateRange: { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7)), to: today }, label: "Săptămâna curentă" });
  const [excludeSuspect, setExcludeSuspect] = useState(true);
  const [lineId, setLineId] = useState<string>("");

  const { data: lines, isLoading: linesLoading } = useProductionLines();
  const { data, isLoading, error } = useLineSpeedData(filter.dateRange?.from, filter.dateRange?.to);

  const report = useMemo(() => buildSpeedReport({
    sessions: data?.sessions || [],
    lines: (lines || []).map(l => ({ id: l.id, nume: l.nume, capacitate_ora: Number(l.capacitate_ora) || 0 })),
    dayOf: dayKey,
    productOf: id => (id && data?.products.get(id)) || "Produs necunoscut",
    excludeSuspect,
  }), [data, lines, excludeSuspect]);

  const selected: LineReport | undefined = report.lines.find(l => l.id === lineId) || report.lines[0];
  const t = report.total;

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const statCols = (s: SpeedStat) => ({
      "Ore lucrate": r1(s.ore), "Bucăți": Math.round(s.buc), "Buc/oră real": Math.round(s.bucPeOra), "Normă buc/oră": s.norma,
      "% din normă": s.procentNorma == null ? null : r1(s.procentNorma),
      "Sesiuni": s.sesiuni,
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.lines.map(l => ({
      Linie: l.nume, ...statCols(l), "Zile lucrate": l.zile, "Normă realistă (mediana zilelor)": Math.round(l.normaRealista),
      "Cea mai bună zi": l.ceaMaiBunaZi?.zi ?? "", "Buc/oră zi bună": l.ceaMaiBunaZi ? Math.round(l.ceaMaiBunaZi.bucPeOra) : null,
      "Cea mai slabă zi": l.ceaMaiSlabaZi?.zi ?? "", "Buc/oră zi slabă": l.ceaMaiSlabaZi ? Math.round(l.ceaMaiSlabaZi.bucPeOra) : null,
    }))), "Linii");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.lines.flatMap(l => [...l.perZi].sort(([a], [b]) => a.localeCompare(b)).map(([zi, s]) => ({ Linie: l.nume, Zi: zi, ...statCols(s) })))), "Pe zile");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.lines.flatMap(l => l.perProdus.map(s => ({ Linie: l.nume, Produs: s.produs, ...statCols(s) })))), "Pe produse");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.lines.flatMap(l => l.perOperator.map(s => ({ Linie: l.nume, Operator: s.operator, ...statCols(s) })))), "Pe operatori");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.suspects.map(x => ({
      Linie: x.linie, Operator: x.session.nume_operator || "", Start: x.session.ora_start ? format(new Date(x.session.ora_start), "yyyy-MM-dd HH:mm") : "",
      Stop: x.session.ora_sfarsit ? format(new Date(x.session.ora_sfarsit), "yyyy-MM-dd HH:mm") : "", "Ore": r1(x.ore),
      "Bucăți": Number(x.session.cantitate_produsa || 0), Motiv: SUSPECT_LABEL[x.motiv],
    }))), "Sesiuni suspecte");
    XLSX.writeFile(wb, `Viteza linii vs norma ${filter.label}.xlsx`);
  };

  if (linesLoading || isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const chartData = report.lines.map(l => ({ nume: l.nume, real: Math.round(l.bucPeOra), norma: l.norma, realista: Math.round(l.normaRealista) }));
  const trend = selected ? report.zile.map(zi => ({ zi: dayLabel(zi), real: selected.perZi.get(zi) ? Math.round(selected.perZi.get(zi)!.bucPeOra) : null })) : [];
  const ideas = report.lines.filter(l => l.norma > 0 && l.zile >= 3 && Math.abs(l.normaRealista - l.norma) / l.norma > 0.15);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><Gauge className="h-5 w-5" />Viteză linii vs normă</h2>
          <p className="text-sm text-muted-foreground">Viteza se calculează doar pe orele lucrate efectiv (pornire → oprire sesiune), nu pe ore pe zi sau 24h.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="excl" checked={excludeSuspect} onCheckedChange={setExcludeSuspect} />
            <Label htmlFor="excl" className="text-sm">Exclude sesiunile suspecte ({report.suspects.filter(s => s.motiv !== "deschisa").length})</Label>
          </div>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!report.lines.length}><Download className="mr-2 h-4 w-4" />Export Excel</Button>
        </div>
      </div>

      <ReportsFilters currentFilter={filter} onFilterChange={setFilter} />

      {error && <Card><CardContent className="p-4 text-sm text-destructive">Nu am putut citi sesiunile: {(error as Error).message}</CardContent></Card>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi icon={<Timer className="h-4 w-4" />} label="Ore lucrate (toate liniile)" value={`${n1(t.ore)}h`} hint={`${t.sesiuni} sesiuni`} />
        <Kpi icon={<Package className="h-4 w-4" />} label="Bucăți produse" value={n0(t.buc)} />
        <Kpi icon={<Gauge className="h-4 w-4" />} label="Realizare normă (medie ponderată)" value={t.procentNorma == null ? "—" : `${Math.round(t.procentNorma)}%`} hint={`${n0(t.bucPeOra)} vs ${n0(t.norma)} buc/oră`} />
      </div>

      {!report.lines.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nu există sesiuni finalizate în perioada selectată.</CardContent></Card>
      ) : (
        <Tabs defaultValue="rank" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="rank">Clasament linii</TabsTrigger>
            <TabsTrigger value="days">Pe zile</TabsTrigger>
            <TabsTrigger value="products">Pe produse</TabsTrigger>
            <TabsTrigger value="operators">Pe operatori</TabsTrigger>
            <TabsTrigger value="suspects">Sesiuni suspecte ({report.suspects.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="rank" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Buc/oră real vs normă setată</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="nume" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
                    <Legend />
                    <Bar dataKey="norma" name="Normă setată" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="real" name="Real (pe ore lucrate)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="realista" name="Normă realistă (mediana zilelor)" fill="hsl(var(--accent-foreground))" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {ideas.length > 0 && (
              <Card className="border-amber-300">
                <CardContent className="space-y-1 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4" />Norme de revizuit</div>
                  {ideas.map(l => (
                    <div key={l.id}>
                      <b>{l.nume}</b>: normă setată {n0(l.norma)} buc/oră, dar ziua tipică din perioadă ({l.zile} zile) a mers cu {n0(l.normaRealista)} buc/oră
                      {l.normaRealista > l.norma ? " — norma pare prea mică." : " — norma pare prea mare sau linia are o problemă constantă."}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="overflow-x-auto pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linie</TableHead>
                      <TableHead className="text-right">Normă</TableHead>
                      <TableHead className="text-right">Ore lucrate</TableHead>
                      <TableHead className="text-right">Bucăți</TableHead>
                      <TableHead className="text-right">Buc/oră real</TableHead>
                      <TableHead className="text-right">% normă</TableHead>
                      <TableHead className="text-right">Normă realistă</TableHead>
                      <TableHead>Cea mai bună / slabă zi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.lines.map(l => (
                      <TableRow key={l.id} className="cursor-pointer" onClick={() => setLineId(l.id)}>
                        <TableCell className="font-medium">{l.nume}<div className="text-xs text-muted-foreground">{l.zile} zile · {l.sesiuni} sesiuni</div></TableCell>
                        <TableCell className="text-right">{l.norma ? n0(l.norma) : "—"}</TableCell>
                        <StatCells s={l} />
                        <TableCell className="text-right">{n0(l.normaRealista)}</TableCell>
                        <TableCell className="text-xs">
                          {l.ceaMaiBunaZi && <div>▲ {dayLabel(l.ceaMaiBunaZi.zi)}: {n0(l.ceaMaiBunaZi.bucPeOra)}</div>}
                          {l.ceaMaiSlabaZi && <div className="text-muted-foreground">▼ {dayLabel(l.ceaMaiSlabaZi.zi)}: {n0(l.ceaMaiSlabaZi.bucPeOra)}</div>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-xs text-muted-foreground">Normă realistă = mediana vitezei zilnice (zile cu minim 30 min lucrate).</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="days" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Hartă % din normă — linie × zi</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linie</TableHead>
                      {report.zile.map(zi => <TableHead key={zi} className="text-center text-xs capitalize">{dayLabel(zi)}</TableHead>)}
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.lines.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nume}</TableCell>
                        {report.zile.map(zi => {
                          const s = l.perZi.get(zi);
                          return (
                            <TableCell key={zi} className="text-center" title={s ? `${n0(s.bucPeOra)} buc/oră · ${n1(s.ore)}h · ${n0(s.buc)} buc` : "nu s-a lucrat"}>
                              {s ? <div><Pct p={s.procentNorma} /><div className="mt-0.5 text-[10px] text-muted-foreground">{n0(s.bucPeOra)}/h · {n1(s.ore)}h</div></div> : <span className="text-muted-foreground">·</span>}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center"><Pct p={l.procentNorma} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <LinePicker lines={report.lines} value={selected?.id} onChange={setLineId} />
            {selected && (
              <Card>
                <CardHeader><CardTitle className="text-base">{selected.nume} — buc/oră pe zile vs normă</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="zi" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
                      <Legend />
                      {selected.norma > 0 && <ReferenceLine y={selected.norma} stroke="hsl(var(--destructive))" strokeDasharray="6 4" label={{ value: `Normă ${selected.norma}`, position: "insideTopRight", fontSize: 11 }} />}
                      <Line type="monotone" dataKey="real" name="Buc/oră real" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <LinePicker lines={report.lines} value={selected?.id} onChange={setLineId} />
            {selected && <Breakdown title={`${selected.nume} — viteza pe produs`} label="Produs" rows={selected.perProdus.map(p => ({ key: p.produs, s: p }))}
              note="Dacă un produs stă constant mult sub sau peste normă, probabil merită o normă separată pentru el pe această linie." />}
          </TabsContent>

          <TabsContent value="operators" className="space-y-4">
            <LinePicker lines={report.lines} value={selected?.id} onChange={setLineId} />
            {selected && <Breakdown title={`${selected.nume} — viteza pe operator principal`} label="Operator" rows={selected.perOperator.map(p => ({ key: p.operator, s: p }))}
              note="Viteza fiecărui operator principal, pe orele lucrate de el pe această linie." />}
          </TabsContent>

          <TabsContent value="suspects">
            <Card>
              <CardContent className="overflow-x-auto pt-6">
                {!report.suspects.length ? <p className="py-6 text-center text-muted-foreground">Nicio sesiune suspectă în perioadă.</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linie</TableHead><TableHead>Operator</TableHead><TableHead>Start</TableHead><TableHead>Stop</TableHead>
                        <TableHead className="text-right">Ore</TableHead><TableHead className="text-right">Bucăți</TableHead><TableHead>Motiv</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.suspects.map(x => (
                        <TableRow key={x.session.id}>
                          <TableCell>{x.linie}</TableCell>
                          <TableCell>{x.session.nume_operator || "—"}</TableCell>
                          <TableCell>{x.session.ora_start ? format(new Date(x.session.ora_start), "dd.MM HH:mm") : "—"}</TableCell>
                          <TableCell>{x.session.ora_sfarsit ? format(new Date(x.session.ora_sfarsit), "dd.MM HH:mm") : "—"}</TableCell>
                          <TableCell className="text-right">{n1(x.ore)}</TableCell>
                          <TableCell className="text-right">{n0(Number(x.session.cantitate_produsa || 0))}</TableCell>
                          <TableCell className="text-xs">{SUSPECT_LABEL[x.motiv]}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <p className="mt-3 text-xs text-muted-foreground">Sesiunile deschise nu intră niciodată în calcul. Celelalte sunt scoase doar cât timp comutatorul „Exclude sesiunile suspecte” e pornit.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

const LinePicker = ({ lines, value, onChange }: { lines: LineReport[]; value?: string; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-2">
    <Label className="text-sm">Linie:</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-64"><SelectValue placeholder="Alege linia" /></SelectTrigger>
      <SelectContent className="max-h-72 overflow-y-auto">
        {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.nume}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

const Breakdown = ({ title, label, rows, note }: { title: string; label: string; rows: { key: string; s: SpeedStat }[]; note: string }) => (
  <Card>
    <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{label}</TableHead>
            <TableHead className="text-right">Ore lucrate</TableHead>
            <TableHead className="text-right">Bucăți</TableHead>
            <TableHead className="text-right">Buc/oră real</TableHead>
            <TableHead className="text-right">% normă</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => <TableRow key={r.key}><TableCell className="font-medium">{r.key}</TableCell><StatCells s={r.s} /></TableRow>)}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </CardContent>
  </Card>
);

export default LineSpeedReport;
