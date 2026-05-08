import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import {
  CalendarIcon, Download, Save, Loader2, Plus, Camera, Trash2, X, AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useInventoryType } from "@/context/inventory-type";
import { emitNotification } from "@/lib/notifications";

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
  pallet_type_id: string | null;
  pallet_count: number | null;
  supplier_id: string | null;
  supplier_name: string | null;
  manufacturer_id: string | null;
  product_id: string | null;
};

type PhotoRef = { path: string; url: string };

type ReportRow = {
  inventory_id: string;
  // AUTO din recepție (read-only)
  denumire_produs: string;
  producator: string;
  cantitate_receptionata: number;
  unit: string;
  tip_lada_culoare: string;
  nr_lazi: number | null;
  tip_palet: string;          // AUTO din recepție acum
  nr_paleti_rec: number | null; // AUTO din recepție acum
  // MANUALE (persistente)
  paleti_lazi_document: string;
  cantitate_document: string;
  pierdere_calitativa_procent: string;
  transmis_la_furnizor: boolean;
  defects: string[];
  observations: string;
  photos: PhotoRef[];
  // marker pentru articole lipsă
  is_missing?: boolean;
  missing_id?: string;
};

type SupplierGroup = {
  supplierName: string;
  supplierId: string | null;
  documentNumber: string;
  rows: ReportRow[];
};

type ReportDataRow = {
  inventory_id: string;
  paleti_lazi_document: string | null;
  cantitate_document: number | null;
  tip_palet: string | null;
  pierdere_calitativa_procent: number | null;
  transmis_la_furnizor: boolean | null;
  photos: PhotoRef[] | null;
  defects: string[] | null;
  observations: string | null;
};

type LookupRow = { id: string; name: string };

const getErrorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "A apărut o eroare neașteptată.";

const getInventoryTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_reception_records";
  if (t === "etichete") return "etichete_reception_records";
  return "reception_records";
};
const getCrateTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_crate_types";
  if (t === "etichete") return "etichete_crate_types";
  return "crate_types";
};
const getPalletTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_pallet_types";
  if (t === "etichete") return "etichete_pallet_types";
  return "pallet_types";
};
const getSupplierTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_suppliers";
  if (t === "etichete") return "etichete_suppliers";
  return "suppliers";
};
const getManufacturerTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_manufacturers";
  if (t === "etichete") return "etichete_manufacturers";
  return "manufacturers";
};
const getProductTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_products";
  if (t === "etichete") return "etichete_products";
  return "products";
};
const getDefectsTable = (t: string) => {
  if (t === "ambalaje") return "ambalaje_quality_defects";
  if (t === "etichete") return "etichete_quality_defects";
  return "quality_defects";
};

const getRomaniaDayRange = (date: Date) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Bucharest",
    timeZoneName: "shortOffset",
  });
  const parts = dtf.formatToParts(new Date(y, m, d, 12));
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+2";
  const match = tzPart.match(/GMT([+-]\d+)/);
  const offsetHours = match ? parseInt(match[1], 10) : 2;
  const startUtc = new Date(Date.UTC(y, m, d, 0 - offsetHours, 0, 0, 0));
  const endUtc = new Date(Date.UTC(y, m, d, 23 - offsetHours, 59, 59, 999));
  return { start: startUtc.toISOString(), end: endUtc.toISOString() };
};

const ReceptionReport: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [groups, setGroups] = useState<SupplierGroup[]>([]);
  const [defectsList, setDefectsList] = useState<LookupRow[]>([]);
  const [crateTypeMap, setCrateTypeMap] = useState<Map<string, string>>(new Map());
  const [crateTypesList, setCrateTypesList] = useState<LookupRow[]>([]);

  // Dialogs
  const [photoDialog, setPhotoDialog] = useState<{ groupIdx: number; rowIdx: number } | null>(null);
  const [defectsDialog, setDefectsDialog] = useState<{ groupIdx: number; rowIdx: number } | null>(null);
  const [missingDialog, setMissingDialog] = useState<{ groupIdx: number } | null>(null);

  // Missing item form
  const [missingForm, setMissingForm] = useState<{
    product_id: string | null;
    product_name: string;
    expected_quantity: string;
    unit: string;
    notes: string;
  }>({ product_id: null, product_name: "", expected_quantity: "", unit: "kg", notes: "" });
  const [productsList, setProductsList] = useState<{ id: string; name: string; default_unit?: string }[]>([]);

  const loadDefects = async () => {
    const { data } = await (supabase as any)
      .from(getDefectsTable(inventoryType))
      .select("id, name")
      .order("name");
    setDefectsList((data as LookupRow[]) || []);
  };

  const loadProducts = async () => {
    const { data } = await (supabase as any)
      .from(getProductTable(inventoryType))
      .select("id, name, default_unit")
      .order("name");
    setProductsList((data as any[]) || []);
  };

  const loadCrateTypes = async () => {
    const { data } = await (supabase as any)
      .from(getCrateTable(inventoryType))
      .select("id, name")
      .order("name");
    setCrateTypesList((data as LookupRow[]) || []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { start, end } = getRomaniaDayRange(date);
      const tableName = getInventoryTable(inventoryType);

      const { data: invData, error: invErr } = await (supabase as any)
        .from(tableName)
        .select(
          `id, name, original_quantity, net_quantity, unit, receipt_date, document_number,
           crate_count, crate_type_id, pallet_type_id, pallet_count,
           supplier_id, supplier_name, manufacturer_id, product_id`
        )
        .gte("receipt_date", start)
        .lte("receipt_date", end)
        .order("supplier_name", { ascending: true });
      if (invErr) throw invErr;
      const inv = (invData || []) as InventoryRow[];

      // Existing report data
      const invIds = inv.map((r) => r.id);
      const reportMap = new Map<string, ReportDataRow>();
      for (let i = 0; i < invIds.length; i += 50) {
        const slice = invIds.slice(i, i + 50);
        if (slice.length === 0) break;
        const { data: repData, error: repErr } = await (supabase as any)
          .from("reception_report_data")
          .select("*")
          .in("inventory_id", slice);
        if (repErr) throw repErr;
        ((repData || []) as ReportDataRow[]).forEach((r) => reportMap.set(r.inventory_id, r));
      }

      // Lookups
      const crateIds = Array.from(new Set(inv.map((r) => r.crate_type_id).filter(Boolean))) as string[];
      const palletIds = Array.from(new Set(inv.map((r) => r.pallet_type_id).filter(Boolean))) as string[];
      const supplierIds = Array.from(new Set(inv.map((r) => r.supplier_id).filter(Boolean))) as string[];
      const manufacturerIds = Array.from(new Set(inv.map((r) => r.manufacturer_id).filter(Boolean))) as string[];

      const fetchLookup = async (table: string, ids: string[]): Promise<LookupRow[]> => {
        if (ids.length === 0) return [];
        const { data } = await (supabase as any).from(table).select("id, name").in("id", ids);
        return (data as LookupRow[]) || [];
      };

      const [crates, pallets, suppliers, manufacturers] = await Promise.all([
        fetchLookup(getCrateTable(inventoryType), crateIds),
        fetchLookup(getPalletTable(inventoryType), palletIds),
        fetchLookup(getSupplierTable(inventoryType), supplierIds),
        fetchLookup(getManufacturerTable(inventoryType), manufacturerIds),
      ]);

      const crateMap = new Map(crates.map((r) => [r.id, r.name]));
      const palletMap = new Map(pallets.map((r) => [r.id, r.name]));
      const supplierMap = new Map(suppliers.map((r) => [r.id, r.name]));
      const manufacturerMap = new Map(manufacturers.map((r) => [r.id, r.name]));
      setCrateTypeMap(crateMap);

      // Missing items pentru ziua respectivă
      const isoDate = format(date, "yyyy-MM-dd");
      const { data: missingData } = await (supabase as any)
        .from("reception_missing_items")
        .select("*")
        .eq("inventory_type", inventoryType)
        .eq("receipt_date", isoDate);
      const missing = (missingData as any[]) || [];

      // Group by supplier+document
      const grouped = new Map<string, SupplierGroup>();
      const ensureGroup = (supplierId: string | null, supplierName: string, docNumber: string) => {
        const key = `${supplierName}__${docNumber}`;
        if (!grouped.has(key)) {
          grouped.set(key, { supplierName, supplierId, documentNumber: docNumber, rows: [] });
        }
        return grouped.get(key)!;
      };

      inv.forEach((row) => {
        const supplierName = row.supplier_name || (row.supplier_id ? supplierMap.get(row.supplier_id) : null) || "Fără furnizor";
        const grp = ensureGroup(row.supplier_id, supplierName, row.document_number || "");
        const existing = reportMap.get(row.id);
        grp.rows.push({
          inventory_id: row.id,
          denumire_produs: row.name,
          producator: row.manufacturer_id ? manufacturerMap.get(row.manufacturer_id) || "" : "",
          cantitate_receptionata: Number(row.original_quantity ?? row.net_quantity ?? 0),
          unit: row.unit || "",
          tip_lada_culoare: row.crate_type_id ? crateMap.get(row.crate_type_id) || "" : "",
          nr_lazi: row.crate_count ?? null,
          tip_palet: row.pallet_type_id ? palletMap.get(row.pallet_type_id) || "" : "",
          nr_paleti_rec: row.pallet_count ?? null,
          paleti_lazi_document: existing?.paleti_lazi_document ?? "",
          cantitate_document: existing?.cantitate_document != null ? String(existing.cantitate_document) : "",
          pierdere_calitativa_procent:
            existing?.pierdere_calitativa_procent != null
              ? String(existing.pierdere_calitativa_procent)
              : "",
          transmis_la_furnizor: existing?.transmis_la_furnizor ?? false,
          photos: Array.isArray(existing?.photos) ? existing!.photos! : [],
          defects: Array.isArray(existing?.defects) ? existing!.defects! : [],
          observations: existing?.observations ?? "",
        });
      });

      // Adaugă articolele lipsă în grupul corespunzător
      missing.forEach((m: any) => {
        const supplierName = m.supplier_name || "Fără furnizor";
        const grp = ensureGroup(m.supplier_id, supplierName, m.document_number || "");
        grp.rows.push({
          inventory_id: `missing-${m.id}`,
          denumire_produs: m.product_name,
          producator: "",
          cantitate_receptionata: 0,
          unit: m.unit || "",
          tip_lada_culoare: "",
          nr_lazi: null,
          tip_palet: "",
          nr_paleti_rec: null,
          paleti_lazi_document: "",
          cantitate_document: m.expected_quantity != null ? String(m.expected_quantity) : "",
          pierdere_calitativa_procent: "",
          transmis_la_furnizor: false,
          photos: [],
          defects: [],
          observations: m.notes || "",
          is_missing: true,
          missing_id: m.id,
        });
      });

      setGroups(Array.from(grouped.values()));
    } catch (e: unknown) {
      console.error(e);
      toast({ title: "Eroare la încărcare", description: getErrorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadDefects();
    loadProducts();
    loadCrateTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, inventoryType]);

  // Persist o singură linie în DB (folosit pentru autosave + salvare imediată poze)
  const persistRow = async (row: ReportRow) => {
    if (row.is_missing) return;
    try {
      const { error } = await (supabase as any)
        .from("reception_report_data")
        .upsert([{
          inventory_id: row.inventory_id,
          inventory_type: inventoryType,
          paleti_lazi_document: row.paleti_lazi_document || null,
          cantitate_document: row.cantitate_document !== "" ? parseFloat(row.cantitate_document) : null,
          cantitate_receptionata: row.cantitate_receptionata,
          tip_lada_culoare: row.tip_lada_culoare || null,
          tip_palet: row.tip_palet || null,
          nr_lazi: row.nr_lazi,
          pierdere_calitativa_procent:
            row.pierdere_calitativa_procent !== "" ? parseFloat(row.pierdere_calitativa_procent) : null,
          transmis_la_furnizor: row.transmis_la_furnizor,
          photos: row.photos,
          defects: row.defects,
          observations: row.observations || null,
        }], { onConflict: "inventory_id" });
      if (error) throw error;
    } catch (e) {
      console.error("Autosave eșuat", e);
    }
  };

  // Autosave debounced per inventory_id
  const autosaveTimers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const scheduleAutosave = (row: ReportRow) => {
    const id = row.inventory_id;
    const existing = autosaveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      persistRow(row);
      autosaveTimers.current.delete(id);
    }, 800);
    autosaveTimers.current.set(id, t);
  };

  const updateRow = (
    groupIdx: number, rowIdx: number,
    field: keyof ReportRow, value: ReportRow[keyof ReportRow]
  ) => {
    setGroups((prev) => {
      const next = [...prev];
      const grp = { ...next[groupIdx] };
      const rows = [...grp.rows];
      rows[rowIdx] = { ...rows[rowIdx], [field]: value };
      grp.rows = rows;
      next[groupIdx] = grp;
      // Autosave (debounced)
      scheduleAutosave(rows[rowIdx]);
      return next;
    });
  };

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
  const calcKgConsiderate = (r: ReportRow) => {
    const pkg = calcPierdereKg(r);
    if (pkg == null) return r.cantitate_receptionata;
    return r.cantitate_receptionata - pkg;
  };

  const handleSaveGroup = async (group: SupplierGroup) => {
    const key = `${group.supplierName}__${group.documentNumber}`;
    setSavingKey(key);
    try {
      const payload = group.rows
        .filter((r) => !r.is_missing)
        .map((r) => ({
          inventory_id: r.inventory_id,
          inventory_type: inventoryType,
          paleti_lazi_document: r.paleti_lazi_document || null,
          cantitate_document: r.cantitate_document !== "" ? parseFloat(r.cantitate_document) : null,
          cantitate_receptionata: r.cantitate_receptionata,
          tip_lada_culoare: r.tip_lada_culoare || null,
          tip_palet: r.tip_palet || null,
          nr_lazi: r.nr_lazi,
          pierdere_calitativa_procent:
            r.pierdere_calitativa_procent !== "" ? parseFloat(r.pierdere_calitativa_procent) : null,
          transmis_la_furnizor: r.transmis_la_furnizor,
          photos: r.photos,
          defects: r.defects,
          observations: r.observations || null,
        }));

      for (let i = 0; i < payload.length; i += 50) {
        const slice = payload.slice(i, i + 50);
        const { error } = await (supabase as any)
          .from("reception_report_data")
          .upsert(slice, { onConflict: "inventory_id" });
        if (error) throw error;
      }

      toast({ title: "Salvat", description: `${group.supplierName}: ${payload.length} rânduri actualizate.` });
    } catch (e: unknown) {
      console.error(e);
      toast({ title: "Eroare la salvare", description: getErrorMessage(e), variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  // Photos
  const handleUploadPhotos = async (groupIdx: number, rowIdx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const row = groups[groupIdx].rows[rowIdx];
    const newPhotos: PhotoRef[] = [...row.photos];
    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${inventoryType}/${row.inventory_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await (supabase as any).storage
          .from("reception-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = (supabase as any).storage.from("reception-photos").getPublicUrl(path);
        newPhotos.push({ path, url: pub.publicUrl });
      } catch (e: unknown) {
        toast({ title: "Eroare upload", description: getErrorMessage(e), variant: "destructive" });
      }
    }
    updateRow(groupIdx, rowIdx, "photos", newPhotos);
    // Persist IMEDIAT (nu așteptăm debounce) — pe mobil, după cameră, tab-ul poate fi reîncărcat
    await persistRow({ ...row, photos: newPhotos });
  };

  const handleDeletePhoto = async (groupIdx: number, rowIdx: number, photoIdx: number) => {
    const row = groups[groupIdx].rows[rowIdx];
    const photo = row.photos[photoIdx];
    try {
      await (supabase as any).storage.from("reception-photos").remove([photo.path]);
    } catch { /* ignore */ }
    const newPhotos = row.photos.filter((_, i) => i !== photoIdx);
    updateRow(groupIdx, rowIdx, "photos", newPhotos);
    await persistRow({ ...row, photos: newPhotos });
  };

  // Missing items
  const openMissingDialog = (groupIdx: number) => {
    setMissingForm({ product_id: null, product_name: "", expected_quantity: "", unit: "kg", notes: "" });
    setMissingDialog({ groupIdx });
  };

  const handleAddMissing = async () => {
    if (!missingDialog) return;
    const grp = groups[missingDialog.groupIdx];
    if (!missingForm.product_name.trim()) {
      toast({ title: "Numele produsului este obligatoriu", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from("reception_missing_items")
        .insert({
          inventory_type: inventoryType,
          receipt_date: format(date, "yyyy-MM-dd"),
          supplier_id: grp.supplierId,
          supplier_name: grp.supplierName,
          document_number: grp.documentNumber || null,
          product_id: missingForm.product_id,
          product_name: missingForm.product_name.trim(),
          expected_quantity: parseFloat(missingForm.expected_quantity) || 0,
          unit: missingForm.unit || null,
          notes: missingForm.notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Notificare la achiziții
      await emitNotification("reception.missing_item", "Articol lipsă la recepție", {
        body: `${grp.supplierName}: ${missingForm.product_name} — așteptat ${missingForm.expected_quantity} ${missingForm.unit}, NU a venit.`,
        link: "/calitate",
        payload: {
          inventoryType,
          supplier_name: grp.supplierName,
          product_name: missingForm.product_name,
          expected_quantity: parseFloat(missingForm.expected_quantity) || 0,
          unit: missingForm.unit,
          document_number: grp.documentNumber,
        },
      });

      toast({ title: "Articol lipsă marcat", description: "Achizițiile au fost notificate." });
      setMissingDialog(null);
      loadData();
    } catch (e: unknown) {
      toast({ title: "Eroare", description: getErrorMessage(e), variant: "destructive" });
    }
  };

  const handleRemoveMissing = async (missingId: string) => {
    if (!window.confirm("Ștergi marcajul de articol lipsă?")) return;
    try {
      const { error } = await (supabase as any)
        .from("reception_missing_items")
        .delete()
        .eq("id", missingId);
      if (error) throw error;
      loadData();
    } catch (e: unknown) {
      toast({ title: "Eroare", description: getErrorMessage(e), variant: "destructive" });
    }
  };

  // Parse "2P/3L" sau "2P/3L||TipLada" în {p, l, tip}
  const parsePalDoc = (txt: string): { p: number | null; l: number | null; tip: string } => {
    if (!txt) return { p: null, l: null, tip: "" };
    const [counts, tip = ""] = txt.split("||");
    const pMatch = counts.match(/(\d+)\s*P/i);
    const lMatch = counts.match(/(\d+)\s*L/i);
    return {
      p: pMatch ? parseInt(pMatch[1], 10) : null,
      l: lMatch ? parseInt(lMatch[1], 10) : null,
      tip: tip.trim(),
    };
  };
  const formatPalDoc = (p: number | null, l: number | null, tip: string = ""): string => {
    const parts: string[] = [];
    if (p != null && p > 0) parts.push(`${p}P`);
    if (l != null && l > 0) parts.push(`${l}L`);
    const counts = parts.join("/");
    return tip ? `${counts}||${tip}` : counts;
  };

  // Totaluri pe grup
  const groupTotals = (group: SupplierGroup) => {
    let totalPaleti = 0;
    let totalPaletiDoc = 0;
    let totalLaziDoc = 0;
    let totalCantDoc = 0;
    const ladiByType = new Map<string, number>();
    group.rows.forEach((r) => {
      if (r.is_missing) return;
      totalPaleti += r.nr_paleti_rec || 0;
      if (r.tip_lada_culoare && r.nr_lazi) {
        ladiByType.set(r.tip_lada_culoare, (ladiByType.get(r.tip_lada_culoare) || 0) + r.nr_lazi);
      }
      const { p, l } = parsePalDoc(r.paleti_lazi_document || "");
      if (p) totalPaletiDoc += p;
      if (l) totalLaziDoc += l;
      const cd = parseFloat(r.cantitate_document);
      if (!isNaN(cd)) totalCantDoc += cd;
    });
    return { totalPaleti, ladiByType, totalPaletiDoc, totalLaziDoc, totalCantDoc };
  };

  // ============ EXPORT EXCEL ============
  const exportSupplierReport = (group: SupplierGroup) => {
    const dateStr = format(date, "dd.MM.yyyy");
    const aoa: (string | number | null)[][] = [];
    aoa.push(["CORAL BIOGREENS SRL"]);
    aoa.push([]);
    aoa.push(["Data receptie:", dateStr, null, null, null, null, null, null, null, "Nr document", null, group.documentNumber || ""]);
    aoa.push([]);
    aoa.push(["Furnizor:", group.supplierName]);
    aoa.push([]);
    aoa.push(["Document Receptie"]);
    aoa.push([]);
    aoa.push([]);
    aoa.push([
      "Nr crt", "Denumire produs", "Producator",
      "Paleți doc", "Lăzi doc", "Tip lăzi doc", "Cantitate document", "Cantitate receptionata",
      "Tip lada/culoare", "Tip palet", "Nr paleti rec", "Nr Lazi",
      "Diferenta", "Pierdere calit. (%)", "Transmis furnizor",
      "Pierdere (kg)", "Kg considerate", "Defecte", "Observatii", "Status",
    ]);

    group.rows.forEach((r, idx) => {
      const dif = r.is_missing ? null : calcDiferenta(r);
      const pkg = r.is_missing ? null : calcPierdereKg(r);
      const { p: pDoc, l: lDoc, tip: tipDoc } = parsePalDoc(r.paleti_lazi_document || "");
      aoa.push([
        idx + 1,
        r.denumire_produs,
        r.producator,
        pDoc,
        lDoc,
        tipDoc,
        r.cantitate_document !== "" ? parseFloat(r.cantitate_document) : null,
        r.is_missing ? 0 : r.cantitate_receptionata,
        r.tip_lada_culoare,
        r.tip_palet,
        r.nr_paleti_rec,
        r.nr_lazi,
        dif,
        r.pierdere_calitativa_procent !== "" ? parseFloat(r.pierdere_calitativa_procent) : null,
        r.transmis_la_furnizor ? "DA" : "NU",
        pkg,
        r.is_missing ? 0 : calcKgConsiderate(r),
        (r.defects || []).join(", "),
        r.observations || "",
        r.is_missing ? "LIPSĂ" : "OK",
      ]);
    });

    // Totaluri
    const totals = groupTotals(group);
    aoa.push([]);
    aoa.push(["TOTALURI"]);
    aoa.push(["Nr total paleți recepționați", totals.totalPaleti]);
    Array.from(totals.ladiByType.entries()).forEach(([tip, cnt]) => {
      aoa.push([`Nr lăzi (${tip})`, cnt]);
    });

    aoa.push([]);
    aoa.push([null, "Nume Prenume receptioner", "_____________________________________________",
      null, null, null, null, null, null, "Semnatura", "_____________________"]);
    aoa.push([]);
    aoa.push([null, "Nume Prenume calitate", "_____________________________________________",
      null, null, null, null, null, null, "Semnatura", "_____________________"]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = Array(20).fill({ wch: 16 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Receptie");
    const safe = group.supplierName.replace(/[^a-z0-9]/gi, "_");
    XLSX.writeFile(wb, `Receptie_${safe}_${format(date, "yyyy-MM-dd")}.xlsx`);
  };

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
                <Button variant="outline" className={cn("w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "EEEE, dd MMMM yyyy", { locale: ro }) : "Alege data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Button onClick={loadData} variant="outline" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reîncarcă"}
            </Button>
          </div>

          {!loading && groups.length === 0 && (
            <p className="text-muted-foreground mt-6 text-center">Nicio recepție în această zi.</p>
          )}
        </CardContent>
      </Card>

      {groups.map((group, gIdx) => {
        const totals = groupTotals(group);
        return (
          <Card key={`${group.supplierName}-${group.documentNumber}-${gIdx}`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Furnizor: {group.supplierName}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Nr document: {group.documentNumber || "—"} • {group.rows.length} produse
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => openMissingDialog(gIdx)}>
                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                  Adaugă articol lipsă
                </Button>
                <Button size="sm" onClick={() => handleSaveGroup(group)}
                  disabled={savingKey === `${group.supplierName}__${group.documentNumber}`}>
                  {savingKey === `${group.supplierName}__${group.documentNumber}`
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Save className="h-4 w-4 mr-2" />}
                  Salvează
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportSupplierReport(group)}>
                  <Download className="h-4 w-4 mr-2" />Exportă Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto px-2">
              <Table className="text-xs [&_th]:px-1 [&_th]:h-9 [&_td]:px-1 [&_td]:py-1.5 [&_th]:text-[11px] [&_th]:font-medium [&_th]:whitespace-normal [&_th]:leading-tight">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">Nr</TableHead>
                    <TableHead className="min-w-[110px]">Denumire produs</TableHead>
                    <TableHead className="min-w-[90px]">Producator</TableHead>
                    <TableHead className="min-w-[95px]">Paleți doc</TableHead>
                    <TableHead className="min-w-[95px]">Lăzi doc</TableHead>
                    <TableHead className="min-w-[120px]">Tip lăzi doc</TableHead>
                    <TableHead className="bg-amber-50 dark:bg-amber-950/30 min-w-[110px]">Cant. doc</TableHead>
                    <TableHead className="w-[80px]">Cant. recep.</TableHead>
                    <TableHead className="w-[90px]">Tip lada/culoare</TableHead>
                    <TableHead className="w-[80px]">Tip palet</TableHead>
                    <TableHead className="w-[60px]">Nr paleti rec</TableHead>
                    <TableHead className="w-[50px]">Nr Lazi</TableHead>
                    <TableHead className="w-[60px]">Diferență</TableHead>
                    <TableHead className="w-[60px]">Pierd. %</TableHead>
                    <TableHead className="w-[55px] text-center">Transmis</TableHead>
                    <TableHead className="w-[70px]">Pierd. (kg)</TableHead>
                    <TableHead className="w-[70px]">Kg consid.</TableHead>
                    <TableHead className="w-[80px]">Defecte</TableHead>
                    <TableHead className="w-[70px]">Poze</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((r, rIdx) => {
                    const dif = r.is_missing ? null : calcDiferenta(r);
                    const pkg = r.is_missing ? null : calcPierdereKg(r);
                    return (
                      <TableRow key={r.inventory_id} className={cn(r.is_missing && "bg-red-50 dark:bg-red-950/20")}>
                        <TableCell>{rIdx + 1}</TableCell>
                        <TableCell className="font-medium">
                          {r.is_missing && <span className="inline-block px-1.5 py-0.5 text-[10px] bg-red-600 text-white rounded mr-1">LIPSĂ</span>}
                          {r.denumire_produs}
                        </TableCell>
                        <TableCell>{r.producator || "—"}</TableCell>
                        <TableCell>
                          {(() => {
                            const { p, l } = parsePalDoc(r.paleti_lazi_document || "");
                            return (
                              <Input type="number" min="0" step="1" placeholder="0"
                                value={p ?? ""} disabled={r.is_missing}
                                onChange={(e) => {
                                  const np = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  updateRow(gIdx, rIdx, "paleti_lazi_document", formatPalDoc(np, l));
                                }}
                                className="h-7 text-xs px-1 w-full" />
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const { p, l } = parsePalDoc(r.paleti_lazi_document || "");
                            return (
                              <Input type="number" min="0" step="1" placeholder="0"
                                value={l ?? ""} disabled={r.is_missing}
                                onChange={(e) => {
                                  const nl = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  updateRow(gIdx, rIdx, "paleti_lazi_document", formatPalDoc(p, nl));
                                }}
                                className="h-7 text-xs px-1 w-full" />
                            );
                          })()}
                        </TableCell>
                        <TableCell className="bg-amber-50/50 dark:bg-amber-950/10">
                          <Input type="number" step="0.01" placeholder="kg"
                            value={r.cantitate_document} disabled={r.is_missing}
                            onChange={(e) => updateRow(gIdx, rIdx, "cantitate_document", e.target.value)}
                            className="h-7 text-xs px-1 w-full" />
                        </TableCell>
                        <TableCell className={cn("font-semibold", r.is_missing && "text-red-600")}>
                          {r.is_missing ? `0 ${r.unit}` : `${r.cantitate_receptionata} ${r.unit}`}
                        </TableCell>
                        <TableCell>{r.tip_lada_culoare || "—"}</TableCell>
                        <TableCell>{r.tip_palet || "—"}</TableCell>
                        <TableCell className="font-semibold">{r.nr_paleti_rec ?? "—"}</TableCell>
                        <TableCell className="font-semibold">{r.nr_lazi ?? "—"}</TableCell>
                        <TableCell className={cn("font-semibold",
                          dif != null && dif < 0 && "text-destructive",
                          dif != null && dif > 0 && "text-green-600")}>
                          {dif != null ? dif.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" disabled={r.is_missing}
                            value={r.pierdere_calitativa_procent}
                            onChange={(e) => updateRow(gIdx, rIdx, "pierdere_calitativa_procent", e.target.value)}
                            className="h-7 text-xs px-1 w-full" />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox checked={r.transmis_la_furnizor} disabled={r.is_missing}
                            onCheckedChange={(v) => updateRow(gIdx, rIdx, "transmis_la_furnizor", Boolean(v))} />
                        </TableCell>
                        <TableCell className="font-semibold">{pkg != null ? pkg.toFixed(2) : "—"}</TableCell>
                        <TableCell className="font-semibold text-green-700 dark:text-green-500">
                          {r.is_missing ? "—" : calcKgConsiderate(r).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                            disabled={r.is_missing}
                            onClick={() => setDefectsDialog({ groupIdx: gIdx, rowIdx: rIdx })}>
                            {r.defects.length > 0 ? `${r.defects.length} ✓` : "—"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                            disabled={r.is_missing}
                            onClick={() => setPhotoDialog({ groupIdx: gIdx, rowIdx: rIdx })}>
                            <Camera className="h-3 w-3 mr-1" />
                            {r.photos.length > 0 ? r.photos.length : ""}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {r.is_missing && r.missing_id && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => handleRemoveMissing(r.missing_id!)}>
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/60 font-semibold">
                    <TableCell colSpan={3} className="text-right">TOTAL document:</TableCell>
                    <TableCell className="text-sm text-center">{totals.totalPaletiDoc || "—"}</TableCell>
                    <TableCell className="text-sm text-center">{totals.totalLaziDoc || "—"}</TableCell>
                    <TableCell className="bg-amber-50/50 dark:bg-amber-950/10 text-sm">
                      {totals.totalCantDoc > 0 ? totals.totalCantDoc.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell colSpan={3} className="text-right">Paleți rec:</TableCell>
                    <TableCell className="text-base">{totals.totalPaleti}</TableCell>
                    <TableCell colSpan={9}>
                      {totals.ladiByType.size > 0 && (
                        <div className="flex flex-wrap gap-3 text-xs">
                          {Array.from(totals.ladiByType.entries()).map(([tip, cnt]) => (
                            <span key={tip} className="px-2 py-1 bg-background rounded border">
                              {tip}: <strong>{cnt}</strong> lăzi
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Photo dialog */}
      <Dialog open={!!photoDialog} onOpenChange={(o) => !o && setPhotoDialog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Poze: {photoDialog && groups[photoDialog.groupIdx]?.rows[photoDialog.rowIdx]?.denumire_produs}
            </DialogTitle>
          </DialogHeader>
          {photoDialog && (() => {
            const row = groups[photoDialog.groupIdx].rows[photoDialog.rowIdx];
            return (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="flex-1">
                    <input type="file" accept="image/*" multiple capture="environment"
                      onChange={(e) => { handleUploadPhotos(photoDialog.groupIdx, photoDialog.rowIdx, e.target.files); e.target.value = ""; }}
                      className="hidden" />
                    <span className="block w-full text-center text-sm font-medium px-4 py-2 rounded-md border bg-primary text-primary-foreground cursor-pointer hover:opacity-90">
                      📷 Fă poză
                    </span>
                  </label>
                  <label className="flex-1">
                    <input type="file" accept="image/*" multiple
                      onChange={(e) => { handleUploadPhotos(photoDialog.groupIdx, photoDialog.rowIdx, e.target.files); e.target.value = ""; }}
                      className="hidden" />
                    <span className="block w-full text-center text-sm font-medium px-4 py-2 rounded-md border bg-secondary text-secondary-foreground cursor-pointer hover:opacity-90">
                      🖼️ Alege din galerie
                    </span>
                  </label>
                </div>
                {row.photos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nu există poze.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                    {row.photos.map((p, i) => (
                      <div key={p.path} className="relative group">
                        <a href={p.url} target="_blank" rel="noreferrer">
                          <img src={p.url} alt={`Poza ${i + 1}`} className="w-full h-32 object-cover rounded border" />
                        </a>
                        <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-6 w-6 p-0 opacity-90"
                          onClick={() => handleDeletePhoto(photoDialog.groupIdx, photoDialog.rowIdx, i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Defects dialog */}
      <Dialog open={!!defectsDialog} onOpenChange={(o) => !o && setDefectsDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Defecte: {defectsDialog && groups[defectsDialog.groupIdx]?.rows[defectsDialog.rowIdx]?.denumire_produs}
            </DialogTitle>
          </DialogHeader>
          {defectsDialog && (() => {
            const row = groups[defectsDialog.groupIdx].rows[defectsDialog.rowIdx];
            const toggleDefect = (name: string) => {
              const has = row.defects.includes(name);
              const next = has ? row.defects.filter((d) => d !== name) : [...row.defects, name];
              updateRow(defectsDialog.groupIdx, defectsDialog.rowIdx, "defects", next);
            };
            return (
              <div className="space-y-4">
                {defectsList.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nu există defecte definite. Adaugă în Nomenclatoare → Defecte calitate.
                  </p>
                )}
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {defectsList.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                      <Checkbox checked={row.defects.includes(d.name)} onCheckedChange={() => toggleDefect(d.name)} />
                      <span>{d.name}</span>
                    </label>
                  ))}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Observații suplimentare</label>
                  <Input value={row.observations}
                    onChange={(e) => updateRow(defectsDialog.groupIdx, defectsDialog.rowIdx, "observations", e.target.value)}
                    placeholder="ex: 3 lăzi cu probleme la marginea paletului" />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => setDefectsDialog(null)}>Gata</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Missing item dialog */}
      <Dialog open={!!missingDialog} onOpenChange={(o) => !o && setMissingDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adaugă articol lipsă</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Articolul apare în raport cu cantitate <strong>0</strong> și se evidențiază roșu.
              NU se modifică stocul. Achizițiile primesc o notificare automată.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Produs (din nomenclator)</label>
              <Select
                value={missingForm.product_id || ""}
                onValueChange={(v) => {
                  const p = productsList.find((x) => x.id === v);
                  setMissingForm((f) => ({
                    ...f,
                    product_id: v,
                    product_name: p?.name || f.product_name,
                    unit: p?.default_unit || f.unit,
                  }));
                }}>
                <SelectTrigger><SelectValue placeholder="Selectează produs" /></SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {productsList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">sau scrie manual numele</label>
              <Input value={missingForm.product_name}
                onChange={(e) => setMissingForm((f) => ({ ...f, product_name: e.target.value }))}
                placeholder="Nume produs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cantitate așteptată</label>
                <Input type="number" step="0.01" value={missingForm.expected_quantity}
                  onChange={(e) => setMissingForm((f) => ({ ...f, expected_quantity: e.target.value }))}
                  placeholder="ex: 50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">UM</label>
                <Input value={missingForm.unit}
                  onChange={(e) => setMissingForm((f) => ({ ...f, unit: e.target.value }))} placeholder="kg" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observații</label>
              <Input value={missingForm.notes}
                onChange={(e) => setMissingForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="opțional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissingDialog(null)}>Anulează</Button>
            <Button onClick={handleAddMissing}>
              <Plus className="h-4 w-4 mr-2" />Marchează ca lipsă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceptionReport;
