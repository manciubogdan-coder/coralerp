import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProductionLines } from "@/hooks/productie/useProductionData";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { ClipboardList, Download, Plus, Printer, Trash2, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtRo = (iso: string) => {
  const [y, m, d] = String(iso).split("-");
  return `${d}.${m}.${y}`;
};

const formatOre = (h: number) => {
  if (!h || !isFinite(h) || h <= 0) return "-";
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm}min`;
  if (mm === 0) return `${hh}h`;
  return `${hh}h ${mm}min`;
};

interface LineOverride {
  norma?: number;
  oameni?: number;
  personal?: string;
  startProdus?: string;
  cantitate?: number;
}

interface ExtraRow {
  id: string;
  nume: string;
  norma?: number;
  oameni?: number;
  personal?: string;
}

const ProductionPlanner: React.FC = () => {
  const today = fmtDate(new Date());
  const [startDate, setStartDate] = usePersistentState("planner-start", today);
  const [endDate, setEndDate] = usePersistentState("planner-end", today);
  const [excluded, setExcluded] = usePersistentState<string[]>("planner-excluded-clients", []);
  const [overrides, setOverrides] = usePersistentState<Record<string, LineOverride>>("planner-line-overrides", {});
  const [extras, setExtras] = usePersistentState<ExtraRow[]>("planner-extra-rows", []);
  const [showClients, setShowClients] = useState(true);

  const { data: lines = [] } = useProductionLines();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["planner-orders", startDate, endDate],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("productie_comenzi")
          .select("id, linie_id, cantitate, data_productie, magazin, punct_livrare, produs_id, productie_produse(nume, unitate_masura)")
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

  const { data: clientiMeta = [] } = useQuery({
    queryKey: ["planner-clienti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productie_clienti")
        .select("nume_magazin, punct_livrare, nickname");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
  });

  const nickMap = useMemo(() => {
    const m = new Map<string, string>();
    (clientiMeta as any[]).forEach((c) => {
      if (c.nickname) m.set(`${c.nume_magazin}||${c.punct_livrare}`, c.nickname);
    });
    return m;
  }, [clientiMeta]);

  // Lista clienților din perioada selectată
  const clients = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; comenzi: number }>();
    for (const o of orders as any[]) {
      const key = `${o.magazin || "—"}||${o.punct_livrare || ""}`;
      const nick = nickMap.get(key);
      const label = nick ? `${nick} (${o.magazin})` : `${o.magazin || "—"}${o.punct_livrare ? ` – ${o.punct_livrare}` : ""}`;
      const e = map.get(key) || { key, label, total: 0, comenzi: 0 };
      e.total += Number(o.cantitate) || 0;
      e.comenzi += 1;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "ro"));
  }, [orders, nickMap]);

  // curăț selecțiile pentru clienți care nu mai există
  useEffect(() => {
    if (!clients.length) return;
    const keys = new Set(clients.map((c) => c.key));
    setExcluded((prev) => prev.filter((k) => keys.has(k)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.length]);

  const isIncluded = (key: string) => !excluded.includes(key);
  const toggleClient = (key: string) =>
    setExcluded((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const selectAll = () => setExcluded([]);
  const clearAll = () => setExcluded(clients.map((c) => c.key));

  const filteredOrders = useMemo(
    () => (orders as any[]).filter((o) => isIncluded(`${o.magazin || "—"}||${o.punct_livrare || ""}`)),
    [orders, excluded]
  );

  // Cantitate necesară + produs principal per linie
  const perLine = useMemo(() => {
    const map = new Map<string, { total: number; produse: Map<string, number> }>();
    for (const o of filteredOrders) {
      if (!o.linie_id) continue;
      const e = map.get(o.linie_id) || { total: 0, produse: new Map<string, number>() };
      const qty = Number(o.cantitate) || 0;
      e.total += qty;
      const nume = o.productie_produse?.nume || "—";
      e.produse.set(nume, (e.produse.get(nume) || 0) + qty);
      map.set(o.linie_id, e);
    }
    return map;
  }, [filteredOrders]);

  const nealocate = useMemo(
    () => filteredOrders.filter((o) => !o.linie_id).reduce((s, o) => s + (Number(o.cantitate) || 0), 0),
    [filteredOrders]
  );

  const setOverride = (lineId: string, patch: LineOverride) =>
    setOverrides((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));

  const rows = useMemo(() => {
    return lines.map((line) => {
      const ov = overrides[line.id] || {};
      const data = perLine.get(line.id);
      const autoCant = data?.total || 0;
      const cantitate = ov.cantitate != null ? ov.cantitate : autoCant;
      const norma = ov.norma != null ? ov.norma : Number(line.capacitate_ora) || 0;
      const oameni = ov.oameni != null ? ov.oameni : 0;
      const ore = norma > 0 ? cantitate / norma : 0;
      const topProdus = data
        ? Array.from(data.produse.entries()).sort((a, b) => b[1] - a[1])[0]
        : undefined;
      return {
        line,
        norma,
        oameni,
        cantitate,
        autoCant,
        ore,
        personal: ov.personal || "",
        startProdus: ov.startProdus || (topProdus ? `${topProdus[0]} – ${Math.round(topProdus[1]).toLocaleString()} buc` : ""),
      };
    });
  }, [lines, overrides, perLine]);

  const totals = useMemo(() => {
    const norma = rows.reduce((s, r) => s + (r.norma || 0), 0);
    const oameniLinii = rows.reduce((s, r) => s + (r.oameni || 0), 0);
    const cantitate = rows.reduce((s, r) => s + (r.cantitate || 0), 0);
    const oameniExtra = extras.reduce((s, e) => s + (e.oameni || 0), 0);
    return { norma, oameniLinii, cantitate, oameniExtra, oameniTotal: oameniLinii + oameniExtra };
  }, [rows, extras]);

  const addExtra = () =>
    setExtras((prev) => [...prev, { id: crypto.randomUUID(), nume: "", oameni: 0, personal: "" }]);
  const updateExtra = (id: string, patch: Partial<ExtraRow>) =>
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeExtra = (id: string) => setExtras((prev) => prev.filter((e) => e.id !== id));

  const buildMatrix = () => {
    const header = ["Linie", "Norma/oră", "Oameni", "Cant. necesară", "Nr. ore necesar", "Personal", "Se începe producția cu produsul"];
    const body: any[][] = rows.map((r) => [
      r.line.nume,
      r.norma || "",
      r.oameni || "",
      r.cantitate || "",
      r.norma > 0 && r.cantitate > 0 ? Number(r.ore.toFixed(2)) : "",
      r.personal,
      r.startProdus,
    ]);
    body.push(["TOTAL LINII", totals.norma, totals.oameniLinii, totals.cantitate, "", "", ""]);
    if (extras.length) {
      body.push([]);
      extras.forEach((e) => body.push([e.nume, e.norma || "", e.oameni || "", "", "", e.personal, ""]));
      body.push(["TOTAL AUXILIAR", "", totals.oameniExtra, "", "", "", ""]);
    }
    body.push([]);
    body.push(["TOTAL OAMENI", "", totals.oameniTotal, "", "", "", ""]);
    return [
      [`Planificator producție ${fmtRo(startDate)} - ${fmtRo(endDate)}`],
      [`Clienți incluși: ${clients.filter((c) => isIncluded(c.key)).length}/${clients.length}`],
      [],
      header,
      ...body,
    ];
  };

  const handleExport = () => {
    const ws = XLSX.utils.aoa_to_sheet(buildMatrix());
    ws["!cols"] = [{ wch: 24 }, { wch: 11 }, { wch: 9 }, { wch: 15 }, { wch: 16 }, { wch: 55 }, { wch: 38 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planificator");
    XLSX.writeFile(wb, `Planificator_productie_${startDate}_${endDate}.xlsx`);
    toast.success("Export Excel generat");
  };

  const handlePrint = () => {
    const matrix = buildMatrix();
    const esc = (v: any) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Planificator producție</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;padding:16px;color:#111}
  h1{font-size:18px;margin:0 0 4px}
  p{font-size:12px;margin:0 0 12px;color:#555}
  table{border-collapse:collapse;width:100%;font-size:11px}
  th,td{border:1px solid #999;padding:4px 6px;vertical-align:top}
  th{background:#eee;text-align:left}
  td.num{text-align:right}
  tr.total td{font-weight:bold;background:#f4f4f4}
  @page{size:A4 landscape;margin:10mm}
</style></head><body>
<h1>${esc(matrix[0][0])}</h1><p>${esc(matrix[1][0])}</p>
<table><thead><tr>${(matrix[3] as any[]).map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
${matrix.slice(4).map((r) => {
      if (!r || r.length === 0) return `<tr><td colspan="7" style="border:none;height:8px"></td></tr>`;
      const isTotal = String(r[0]).startsWith("TOTAL");
      return `<tr class="${isTotal ? "total" : ""}">${Array.from({ length: 7 }, (_, i) => {
        const v = r[i];
        const num = typeof v === "number";
        return `<td class="${num ? "num" : ""}">${esc(num ? v.toLocaleString("ro-RO") : v)}</td>`;
      }).join("")}</tr>`;
    }).join("")}
</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Permite ferestrele pop-up pentru a putea lista.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Planificator producție
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" /> Listează / PDF
              </Button>
              <Button size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Selectează perioada și clienții, ajustează norma, oamenii și personalul pe fiecare linie, apoi listează sau descarcă planul.
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
            <Button size="sm" variant="outline" onClick={() => { setStartDate(today); setEndDate(today); }}>Azi</Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                setStartDate(fmtDate(d));
                setEndDate(fmtDate(d));
              }}
            >
              Mâine
            </Button>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" /> Total oameni: {totals.oameniTotal}
            </Badge>
          </div>

          <div className="border rounded-md">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
              onClick={() => setShowClients((v) => !v)}
            >
              <span>
                Clienți în perioadă: {clients.filter((c) => isIncluded(c.key)).length}/{clients.length}
              </span>
              <span className="text-muted-foreground text-xs">{showClients ? "ascunde" : "arată"}</span>
            </button>
            {showClients && (
              <div className="px-3 pb-3 space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAll}>Bifează tot</Button>
                  <Button size="sm" variant="outline" onClick={clearAll}>Debifează tot</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 max-h-64 overflow-y-auto">
                  {clients.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                      <Checkbox checked={isIncluded(c.key)} onCheckedChange={() => toggleClient(c.key)} />
                      <span className="flex-1 truncate">{c.label}</span>
                      <span className="text-xs text-muted-foreground">{Math.round(c.total).toLocaleString()}</span>
                    </label>
                  ))}
                  {clients.length === 0 && (
                    <div className="text-sm text-muted-foreground py-2">Nicio comandă în perioada selectată.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Se încarcă...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Linie</TableHead>
                    <TableHead className="w-[100px] text-center">Norma/oră</TableHead>
                    <TableHead className="w-[90px] text-center">Oameni</TableHead>
                    <TableHead className="w-[130px] text-center">Cant. necesară</TableHead>
                    <TableHead className="w-[120px] text-center">Nr. ore</TableHead>
                    <TableHead className="min-w-[220px]">Personal</TableHead>
                    <TableHead className="min-w-[200px]">Se începe cu produsul</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.line.id}>
                      <TableCell className="font-medium">{r.line.nume}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 text-center"
                          value={r.norma || ""}
                          onChange={(e) => setOverride(r.line.id, { norma: e.target.value === "" ? undefined : Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 text-center"
                          value={r.oameni || ""}
                          onChange={(e) => setOverride(r.line.id, { oameni: e.target.value === "" ? undefined : Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 text-center"
                          value={r.cantitate || ""}
                          onChange={(e) => setOverride(r.line.id, { cantitate: e.target.value === "" ? undefined : Number(e.target.value) })}
                        />
                        {r.autoCant !== r.cantitate && (
                          <div className="text-[10px] text-muted-foreground text-center mt-0.5">
                            din comenzi: {Math.round(r.autoCant).toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{formatOre(r.ore)}</TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          placeholder="Nume operatori"
                          value={r.personal}
                          onChange={(e) => setOverride(r.line.id, { personal: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          placeholder="Produs de start"
                          value={r.startProdus}
                          onChange={(e) => setOverride(r.line.id, { startProdus: e.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>TOTAL LINII</TableCell>
                    <TableCell className="text-center">{totals.norma.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{totals.oameniLinii}</TableCell>
                    <TableCell className="text-center">{Math.round(totals.cantitate).toLocaleString()}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nicio linie configurată
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {nealocate > 0 && (
            <p className="text-xs text-amber-700">
              ⚠️ {Math.round(nealocate).toLocaleString()} buc din comenzi nu sunt alocate pe nicio linie.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Posturi auxiliare (spălat, picking, etichete, sortat...)
            </span>
            <Button size="sm" variant="outline" onClick={addExtra}>
              <Plus className="h-4 w-4 mr-1" /> Adaugă rând
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Post</TableHead>
                  <TableHead className="w-[100px] text-center">Norma/oră</TableHead>
                  <TableHead className="w-[90px] text-center">Oameni</TableHead>
                  <TableHead className="min-w-[260px]">Personal</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {extras.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Input className="h-8" placeholder="ex. Linie Spălat" value={e.nume} onChange={(ev) => updateExtra(e.id, { nume: ev.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="h-8 text-center" value={e.norma || ""} onChange={(ev) => updateExtra(e.id, { norma: ev.target.value === "" ? undefined : Number(ev.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="h-8 text-center" value={e.oameni || ""} onChange={(ev) => updateExtra(e.id, { oameni: ev.target.value === "" ? undefined : Number(ev.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8" placeholder="Nume operatori" value={e.personal || ""} onChange={(ev) => updateExtra(e.id, { personal: ev.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeExtra(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {extras.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Niciun post auxiliar adăugat.
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={2}>TOTAL OAMENI (linii + auxiliar)</TableCell>
                  <TableCell className="text-center">{totals.oameniTotal}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionPlanner;
