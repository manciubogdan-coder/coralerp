import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
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
  original_quantity: number;
  net_quantity: number | null;
  unit: string;
  receipt_date: string;
  document_number: string | null;
  crate_count: number | null;
  crate_type_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  manufacturer_id: string | null;
};

type ReportRow = {
  inventory_id: string;
  // === AUTO din recepție (read-only) ===
  denumire_produs: string;
  producator: string;
  cantitate_receptionata: number;   // = inventory.quantity
  unit: string;
  tip_lada_culoare: string;          // = crate_types.name
  nr_lazi: number | null;            // = crate_count
  // === MANUALE (persistente) ===
  paleti_lazi_document: string;
  cantitate_document: string;        // INPUT manual
  tip_palet: string;
  pierdere_calitativa_procent: string;
  transmis_la_furnizor: boolean;
};

type SupplierGroup = {
  supplierName: string;
  documentNumber: string;
  rows: ReportRow[];
};

const getInventoryTable = (type: string) => {
  if (type === "ambalaje") return "ambalaje_reception_records" as const;
  if (type === "etichete") return "etichete_reception_records" as const;
  return "reception_records" as const;
};

const getCrateTypeTable = (type: string) => {
  if (type === "ambalaje") return "ambalaje_crate_types" as const;
  if (type === "etichete") return "etichete_crate_types" as const;
  return "crate_types" as const;
};

const getSupplierTable = (type: string) => {
  if (type === "ambalaje") return "ambalaje_suppliers" as const;
  if (type === "etichete") return "etichete_suppliers" as const;
  return "suppliers" as const;
};

const getManufacturerTable = (type: string) => {
  if (type === "ambalaje") return "ambalaje_manufacturers" as const;
  if (type === "etichete") return "etichete_manufacturers" as const;
  return "manufacturers" as const;
};

// Convert a calendar date (interpreted in Europe/Bucharest TZ) into the
// UTC ISO range covering that local day. Romania = UTC+2 (winter) or +3 (DST).
const getRomaniaDayRange = (date: Date) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  // Compute offset of Bucharest at this date
  // We use Intl to get the offset hours
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Bucharest",
    timeZoneName: "shortOffset",
  });
  const parts = dtf.formatToParts(new Date(y, m, d, 12));
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+2";
  const match = tzPart.match(/GMT([+-]\d+)/);
  const offsetHours = match ? parseInt(match[1], 10) : 2;
  // Local 00:00 in Bucharest -> UTC = -offset
  const startUtc = new Date(Date.UTC(y, m, d, 0 - offsetHours, 0, 0, 0));
  const endUtc = new Date(Date.UTC(y, m, d, 23 - offsetHours, 59, 59, 999));
  return { start: startUtc.toISOString(), end: endUtc.toISOString() };
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
      const { start, end } = getRomaniaDayRange(date);
      const tableName = getInventoryTable(inventoryType);

      const { data: invData, error: invErr } = await supabase
        .from(tableName)
        .select(
          `id, name, original_quantity, net_quantity, unit, receipt_date, document_number,
           crate_count, crate_type_id, supplier_id, supplier_name, manufacturer_id`
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

      // Fetch existing report data (batch 50)
      const invIds = inv.map((r) => r.id);
      const reportMap = new Map<string, any>();
      for (let i = 0; i < invIds.length; i += 50) {
        const slice = invIds.slice(i, i + 50);
        const { data: repData, error: repErr } = await supabase
          .from("reception_report_data")
          .select("*")
          .in("inventory_id", slice);
        if (repErr) throw repErr;
        (repData || []).forEach((r: any) => reportMap.set(r.inventory_id, r));
      }

      const crateTypeIds = Array.from(new Set(inv.map((r) => r.crate_type_id).filter(Boolean))) as string[];
      const supplierIds = Array.from(new Set(inv.map((r) => r.supplier_id).filter(Boolean))) as string[];
      const manufacturerIds = Array.from(new Set(inv.map((r) => r.manufacturer_id).filter(Boolean))) as string[];

      const [crateTypesRes, suppliersRes, manufacturersRes] = await Promise.all([
        crateTypeIds.length
          ? (supabase as any).from(getCrateTypeTable(inventoryType)).select("id, name").in("id", crateTypeIds)
          : Promise.resolve({ data: [], error: null }),
        supplierIds.length
          ? (supabase as any).from(getSupplierTable(inventoryType)).select("id, name").in("id", supplierIds)
          : Promise.resolve({ data: [], error: null }),
        manufacturerIds.length
          ? (supabase as any).from(getManufacturerTable(inventoryType)).select("id, name").in("id", manufacturerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (crateTypesRes.error) throw crateTypesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (manufacturersRes.error) throw manufacturersRes.error;

      const crateTypeMap = new Map<string, string>((crateTypesRes.data || []).map((r: any) => [String(r.id), String(r.name)]));
      const supplierMap = new Map<string, string>((suppliersRes.data || []).map((r: any) => [String(r.id), String(r.name)]));
      const manufacturerMap = new Map<string, string>((manufacturersRes.data || []).map((r: any) => [String(r.id), String(r.name)]));

      // Group by supplier + document_number
      const grouped = new Map<string, SupplierGroup>();
      inv.forEach((row) => {
        const supplierName = row.supplier_name || (row.supplier_id ? supplierMap.get(row.supplier_id) : null) || "Fără furnizor";
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
          // AUTO
          denumire_produs: row.name,
          producator: row.manufacturer_id ? manufacturerMap.get(row.manufacturer_id) || "" : "",
          cantitate_receptionata: Number(row.net_quantity ?? row.original_quantity ?? 0),
          unit: row.unit || "",
          tip_lada_culoare: row.crate_type_id ? crateTypeMap.get(row.crate_type_id) || "" : "",
          nr_lazi: row.crate_count ?? null,
          // MANUAL
          paleti_lazi_document: existing?.paleti_lazi_document ?? "",
          cantitate_document:
            existing?.cantitate_document != null
              ? String(existing.cantitate_document)
              : "",
          tip_palet: existing?.tip_palet ?? "",
          pierdere_calitativa_procent:
            existing?.pierdere_calitativa_procent != null
              ? String(existing.pierdere_calitativa_procent)
              : "",
          transmis_la_furnizor: existing?.transmis_la_furnizor ?? false,
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
    const doc = parseFloat(r.cantitate_document);
    if (isNaN(doc)) return null;
    return r.cantitate_receptionata - doc;
  };
  const calcPierdereKg = (r: ReportRow) => {
    const proc = parseFloat(r.pierdere_calitativa_procent);
    if (isNaN(proc)) return null;
    return (r.cantitate_receptionata * proc) / 100;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const allRows = groups.flatMap((g) => g.rows);
      const payload = allRows.map((r) => ({
        inventory_id: r.inventory_id,
        inventory_type: inventoryType,
        paleti_lazi_document: r.paleti_lazi_document || null,
        cantitate_document:
          r.cantitate_document !== "" ? parseFloat(r.cantitate_document) : null,
        // Persistăm și auto fields ca snapshot (pentru istoric corect)
        cantitate_receptionata: r.cantitate_receptionata,
        tip_lada_culoare: r.tip_lada_culoare || null,
        tip_palet: r.tip_palet || null,
        nr_lazi: r.nr_lazi,
        pierdere_calitativa_procent:
          r.pierdere_calitativa_procent !== ""
            ? parseFloat(r.pierdere_calitativa_procent)
            : null,
        transmis_la_furnizor: r.transmis_la_furnizor,
      }));

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
      null, null, null, null, null, null, null,
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
        r.cantitate_document !== "" ? parseFloat(r.cantitate_document) : null,
        r.cantitate_receptionata,
        r.tip_lada_culoare,
        r.tip_palet,
        r.nr_lazi,
        dif,
        r.pierdere_calitativa_procent !== ""
          ? parseFloat(r.pierdere_calitativa_procent)
          : null,
        r.transmis_la_furnizor ? "DA" : "NU",
        pkg,
      ]);
    });

    for (let i = group.rows.length; i < 15; i++) {
      aoa.push([i + 1]);
    }

    aoa.push([]);
    aoa.push([
      null, "Nume Prenume receptioner", "_____________________________________________",
      null, null, null, null, null, null, "Semnatura", "_____________________",
    ]);
    aoa.push([]);
    aoa.push([
      null, "Nume Prenume calitate", "_____________________________________________",
      null, null, null, null, null, null, "Semnatura", "_____________________",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 6 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 16 },
      { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 12 },
      { wch: 16 }, { wch: 18 }, { wch: 18 },
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
                    "w-[260px] justify-start text-left font-normal",
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
        <Card key={`${group.supplierName}-${group.documentNumber}-${gIdx}`}>
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
                  <TableHead className="bg-amber-50 dark:bg-amber-950/30">
                    Cantitate document <span className="text-xs">(manual)</span>
                  </TableHead>
                  <TableHead>Cantitate recepționată</TableHead>
                  <TableHead>Tip lada/culoare</TableHead>
                  <TableHead>Tip palet</TableHead>
                  <TableHead>Nr Lazi</TableHead>
                  <TableHead>Diferență</TableHead>
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
                      <TableCell>{r.producator || "—"}</TableCell>
                      <TableCell>
                        <Input
                          value={r.paleti_lazi_document}
                          placeholder="Ex: 2P / ALBASTRE"
                          onChange={(e) =>
                            updateRow(gIdx, rIdx, "paleti_lazi_document", e.target.value)
                          }
                          className="min-w-[140px]"
                        />
                      </TableCell>
                      <TableCell className="bg-amber-50/50 dark:bg-amber-950/10">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="manual"
                          value={r.cantitate_document}
                          onChange={(e) =>
                            updateRow(gIdx, rIdx, "cantitate_document", e.target.value)
                          }
                          className="min-w-[110px]"
                        />
                      </TableCell>
                      <TableCell className="font-semibold">
                        {r.cantitate_receptionata} {r.unit}
                      </TableCell>
                      <TableCell>{r.tip_lada_culoare || "—"}</TableCell>
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
                      <TableCell className="font-semibold">
                        {r.nr_lazi != null ? r.nr_lazi : "—"}
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
                            updateRow(gIdx, rIdx, "pierdere_calitativa_procent", e.target.value)
                          }
                          className="min-w-[80px]"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={r.transmis_la_furnizor}
                          onCheckedChange={(v) =>
                            updateRow(gIdx, rIdx, "transmis_la_furnizor", Boolean(v))
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
