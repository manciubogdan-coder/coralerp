import React, { useEffect, useMemo, useState } from "react";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { CalendarIcon, Download, Save, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useInventoryType } from "@/context/inventory-type";

type InventoryRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  receipt_date: string;
  document_number: string | null;
  crate_count: number | null;
  supplier_id: string | null;
  supplier_name: string | null;
  manufacturer_id: string | null;
  manufacturers: { name: string } | null;
  crate_types: { name: string } | null;
};

type ReportRow = {
  inventory_id: string;
  // Auto-completate
  denumire_produs: string;
  producator: string;
  cantitate_document: number;
  unit: string;
  nr_lazi_auto: number | null;
  tip_lada_auto: string | null;
  // Manuale (persistente)
  paleti_lazi_document: string;
  cantitate_receptionata: string;
  tip_lada_culoare: string;
  tip_palet: string;
  nr_lazi: string;
  pierdere_calitativa_procent: string;
  transmis_la_furnizor: boolean;
  report_id?: string;
};

type SupplierGroup = {
  supplierName: string;
  documentNumber: string;
  rows: ReportRow[];
};

const getInventoryTable = (type: string) => {
  if (type === "ambalaje") return "ambalaje_inventory" as const;
  if (type === "etichete") return "etichete_inventory" as const;
  return "inventory" as const;
};

const ReceptionReport: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<SupplierGroup[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const start = startOfDay(date).toISOString();
      const end = endOfDay(date).toISOString();
      const tableName = getInventoryTable(inventoryType);

      const { data: invData, error: invErr } = await supabase
        .from(tableName)
        .select(
          `id, name, quantity, unit, receipt_date, document_number, crate_count,
           supplier_id, supplier_name, manufacturer_id,
           manufacturers ( name ),
           crate_types ( name )`
        )
        .gte("receipt_date", start)
        .lte("receipt_date", end)
        .order("supplier_name", { ascending: true });

      if (invErr) throw invErr;

      const inv = (invData || []) as unknown as InventoryRow[];
      if (inv.length === 0) {
        setGroups([]);
        return;
      }

      // Fetch existing report data for these inventory ids (batch 50)
      const invIds = inv.map((r) => r.id);
      const reportMap = new Map<string, any>();
      for (let i = 0; i < invIds.length; i += 50) {
        const slice = invIds.slice(i, i + 50);
        const { data: repData, error: repErr } = await supabase
          .from("reception_report_data")
          .select("*")
          .in("inventory_id", slice);
        if (repErr) throw repErr;
        (repData || []).forEach((r) => reportMap.set(r.inventory_id, r));
      }

      // Group by supplier + document_number
      const grouped = new Map<string, SupplierGroup>();
      inv.forEach((row) => {
        const supplierName = row.supplier_name || "Fără furnizor";
        const docNumber = row.document_number || "";
        const key = `${supplierName}__${docNumber}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            supplierName,
            documentNumber: docNumber,
            rows: [],
          });
        }
        const existing = reportMap.get(row.id);
        grouped.get(key)!.rows.push({
          inventory_id: row.id,
          denumire_produs: row.name,
          producator: row.manufacturers?.name || "",
          cantitate_document: Number(row.quantity || 0),
          unit: row.unit || "",
          nr_lazi_auto: row.crate_count ?? null,
          tip_lada_auto: row.crate_types?.name ?? null,
          paleti_lazi_document: existing?.paleti_lazi_document ?? "",
          cantitate_receptionata:
            existing?.cantitate_receptionata != null
              ? String(existing.cantitate_receptionata)
              : "",
          tip_lada_culoare:
            existing?.tip_lada_culoare ?? row.crate_types?.name ?? "",
          tip_palet: existing?.tip_palet ?? "",
          nr_lazi:
            existing?.nr_lazi != null
              ? String(existing.nr_lazi)
              : row.crate_count != null
              ? String(row.crate_count)
              : "",
          pierdere_calitativa_procent:
            existing?.pierdere_calitativa_procent != null
              ? String(existing.pierdere_calitativa_procent)
              : "",
          transmis_la_furnizor: existing?.transmis_la_furnizor ?? false,
          report_id: existing?.id,
        });
      });

      setGroups(Array.from(grouped.values()));
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Eroare la încărcare",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, inventoryType]);

  const updateRow = (
    groupIdx: number,
    rowIdx: number,
    field: keyof ReportRow,
    value: any
  ) => {
    setGroups((prev) => {
      const next = [...prev];
      const grp = { ...next[groupIdx] };
      const rows = [...grp.rows];
      rows[rowIdx] = { ...rows[rowIdx], [field]: value };
      grp.rows = rows;
      next[groupIdx] = grp;
      return next;
    });
  };

  // Calcule
  const calcDiferenta = (r: ReportRow) => {
    const rec = parseFloat(r.cantitate_receptionata);
    if (isNaN(rec)) return null;
    return rec - r.cantitate_document;
  };
  const calcPierdereKg = (r: ReportRow) => {
    const rec = parseFloat(r.cantitate_receptionata);
    const proc = parseFloat(r.pierdere_calitativa_procent);
    if (isNaN(rec) || isNaN(proc)) return null;
    return (rec * proc) / 100;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const allRows = groups.flatMap((g) => g.rows);
      const payload = allRows.map((r) => ({
        inventory_id: r.inventory_id,
        inventory_type: inventoryType,
        paleti_lazi_document: r.paleti_lazi_document || null,
        cantitate_receptionata:
          r.cantitate_receptionata !== ""
            ? parseFloat(r.cantitate_receptionata)
            : null,
        tip_lada_culoare: r.tip_lada_culoare || null,
        tip_palet: r.tip_palet || null,
        nr_lazi: r.nr_lazi !== "" ? parseInt(r.nr_lazi, 10) : null,
        pierdere_calitativa_procent:
          r.pierdere_calitativa_procent !== ""
            ? parseFloat(r.pierdere_calitativa_procent)
            : null,
        transmis_la_furnizor: r.transmis_la_furnizor,
      }));

      // Upsert in batches of 50
      for (let i = 0; i < payload.length; i += 50) {
        const slice = payload.slice(i, i + 50);
        const { error } = await supabase
          .from("reception_report_data")
          .upsert(slice, { onConflict: "inventory_id" });
        if (error) throw error;
      }

      toast({
        title: "Salvat",
        description: `${payload.length} rânduri actualizate.`,
      });
      await loadData();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Eroare la salvare",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const exportSupplierReport = (group: SupplierGroup) => {
    const dateStr = format(date, "dd.MM.yyyy");
    const aoa: (string | number | null)[][] = [];

    aoa.push(["CORAL BIOGREENS SRL"]);
    aoa.push([]);
    aoa.push([
      "Data receptie:",
      dateStr,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "Nr document",
      null,
      group.documentNumber || "",
    ]);
    aoa.push([]);
    aoa.push(["Furnizor:", group.supplierName]);
    aoa.push([]);
    aoa.push(["Document Receptie Materie Prima"]);
    aoa.push([]);
    aoa.push([]);
    aoa.push([
      "Nr crt",
      "Denumire produs",
      "Producator",
      "Paleti/lazi document",
      "Cantitate document",
      "Cantitate receptionata",
      "Tip lada/culoare (ambalaj)",
      "Tip palet lemn/plastic culoare",
      "Nr Lazi",
      "Diferenta",
      "Pierdere calitativa (%)",
      "Transmis la furnizor DA/NU",
      "Pierdere calitativa (kg)",
    ]);

    group.rows.forEach((r, idx) => {
      const dif = calcDiferenta(r);
      const pkg = calcPierdereKg(r);
      aoa.push([
        idx + 1,
        r.denumire_produs,
        r.producator,
        r.paleti_lazi_document,
        r.cantitate_document,
        r.cantitate_receptionata !== ""
          ? parseFloat(r.cantitate_receptionata)
          : null,
        r.tip_lada_culoare,
        r.tip_palet,
        r.nr_lazi !== "" ? parseInt(r.nr_lazi, 10) : null,
        dif,
        r.pierdere_calitativa_procent !== ""
          ? parseFloat(r.pierdere_calitativa_procent)
          : null,
        r.transmis_la_furnizor ? "DA" : "NU",
        pkg,
      ]);
    });

    // Padding rows
    for (let i = group.rows.length; i < 15; i++) {
      aoa.push([i + 1]);
    }

    aoa.push([]);
    aoa.push([
      null,
      "Nume Prenume receptioner",
      "_____________________________________________",
      null,
      null,
      null,
      null,
      null,
      null,
      "Semnatura",
      "_____________________",
    ]);
    aoa.push([]);
    aoa.push([
      null,
      "Nume Prenume calitate",
      "_____________________________________________",
      null,
      null,
      null,
      null,
      null,
      null,
      "Semnatura",
      "_____________________",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 10 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Receptie");
    const safeSupplier = group.supplierName.replace(/[^a-z0-9]/gi, "_");
    XLSX.writeFile(
      wb,
      `Receptie_${safeSupplier}_${format(date, "yyyy-MM-dd")}.xlsx`
    );
  };

  const totalRows = useMemo(
    () => groups.reduce((s, g) => s + g.rows.length, 0),
    [groups]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Raport de Recepție</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date
                    ? format(date, "EEEE, dd MMMM yyyy", { locale: ro })
                    : "Alege data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Button onClick={loadData} variant="outline" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reîncarcă"
              )}
            </Button>

            <Button
              onClick={handleSaveAll}
              disabled={saving || totalRows === 0}
              className="ml-auto"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvează toate modificările
            </Button>
          </div>

          {!loading && groups.length === 0 && (
            <p className="text-muted-foreground mt-6 text-center">
              Nicio recepție în această zi.
            </p>
          )}
        </CardContent>
      </Card>

      {groups.map((group, gIdx) => (
        <Card key={gIdx}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                Furnizor: {group.supplierName}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Nr document: {group.documentNumber || "—"} •{" "}
                {group.rows.length} produse
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportSupplierReport(group)}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportă Excel
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Nr</TableHead>
                  <TableHead>Denumire produs</TableHead>
                  <TableHead>Producator</TableHead>
                  <TableHead>Paleti/lazi document</TableHead>
                  <TableHead>Cantitate document</TableHead>
                  <TableHead>Cantitate receptionata</TableHead>
                  <TableHead>Tip lada/culoare</TableHead>
                  <TableHead>Tip palet</TableHead>
                  <TableHead>Nr Lazi</TableHead>
                  <TableHead>Diferenta</TableHead>
                  <TableHead>Pierdere %</TableHead>
                  <TableHead>Transmis</TableHead>
                  <TableHead>Pierdere (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((r, rIdx) => {
                  const dif = calcDiferenta(r);
                  const pkg = calcPierdereKg(r);
                  return (
                    <TableRow key={r.inventory_id}>
                      <TableCell>{rIdx + 1}</TableCell>
                      <TableCell className="font-medium">
                        {r.denumire_produs}
                      </TableCell>
                      <TableCell>{r.producator}</TableCell>
                      <TableCell>
                        <Input
                          value={r.paleti_lazi_document}
                          placeholder="Ex: 2P / ALBASTRE"
                          onChange={(e) =>
                            updateRow(
                              gIdx,
                              rIdx,
                              "paleti_lazi_document",
                              e.target.value
                            )
                          }
                          className="min-w-[140px]"
                        />
                      </TableCell>
                      <TableCell className="font-semibold">
                        {r.cantitate_document} {r.unit}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={r.cantitate_receptionata}
                          onChange={(e) =>
                            updateRow(
                              gIdx,
                              rIdx,
                              "cantitate_receptionata",
                              e.target.value
                            )
                          }
                          className="min-w-[110px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.tip_lada_culoare}
                          onChange={(e) =>
                            updateRow(
                              gIdx,
                              rIdx,
                              "tip_lada_culoare",
                              e.target.value
                            )
                          }
                          className="min-w-[140px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.tip_palet}
                          placeholder="lemn / plastic"
                          onChange={(e) =>
                            updateRow(gIdx, rIdx, "tip_palet", e.target.value)
                          }
                          className="min-w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={r.nr_lazi}
                          onChange={(e) =>
                            updateRow(gIdx, rIdx, "nr_lazi", e.target.value)
                          }
                          className="min-w-[80px]"
                        />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-semibold",
                          dif != null && dif < 0 && "text-destructive",
                          dif != null && dif > 0 && "text-green-600"
                        )}
                      >
                        {dif != null ? dif.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={r.pierdere_calitativa_procent}
                          onChange={(e) =>
                            updateRow(
                              gIdx,
                              rIdx,
                              "pierdere_calitativa_procent",
                              e.target.value
                            )
                          }
                          className="min-w-[80px]"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={r.transmis_la_furnizor}
                          onCheckedChange={(v) =>
                            updateRow(
                              gIdx,
                              rIdx,
                              "transmis_la_furnizor",
                              Boolean(v)
                            )
                          }
                        />
                        <div className="text-xs mt-1 font-medium">
                          {r.transmis_la_furnizor ? "DA" : "NU"}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {pkg != null ? pkg.toFixed(2) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ReceptionReport;
