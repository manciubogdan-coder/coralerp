import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import {
  CalendarIcon, Download, Save, Loader2, Plus, Camera, Trash2, X, AlertTriangle, Layers, Mail, Copy, Check,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx-js-style";

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
import { dateFromKey, keyFromDate, persistDateKey, readStoredDateKey, todayKey } from "@/lib/persistentDate";
import {
  type BreakdownEntry,
  type BreakdownPayload,
  decodePalDoc,
  encodePalDoc,
  emptyBreakdown,
  summarizeBreakdown,
  aggregateByType,
} from "@/lib/receptionBreakdown";

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
  product_id: string | null;
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
  declared_quantity: string;  // pt. cazul cu surplus peste prag
  pierdere_calitativa_procent: string;
  transmis_la_furnizor: boolean;
  defects: string[];
  observations: string;
  photos: PhotoRef[];
  // marker pentru articole lipsă
  is_missing?: boolean;
  missing_id?: string;
};

type ToleranceCfg = { under: number; over: number };
const DEFAULT_TOLERANCE: ToleranceCfg = { under: 3, over: 105 };

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
  declared_quantity: number | null;
  tip_palet: string | null;
  pierdere_calitativa_procent: number | null;
  transmis_la_furnizor: boolean | null;
  photos: PhotoRef[] | null;
  defects: string[] | null;
  observations: string | null;
};

type LookupRow = { id: string; name: string };
type EmailLang = "en" | "ro" | "it";
type EmailContent = Record<EmailLang, string>;

const PHOTO_BUCKET = "reception-photos";

const getReceptionPhotoUrl = (photo: PhotoRef) => {
  if (photo.path) {
    const { data } = (supabase as any).storage.from(PHOTO_BUCKET).getPublicUrl(photo.path);
    return data.publicUrl as string;
  }
  return (photo.url || "").replace(/\/object\/public\/reception-(Foto|foto|Poze|poze)\//, `/object/public/${PHOTO_BUCKET}/`);
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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

const QUALITY_TRANSLATIONS: Record<EmailLang, Record<string, string>> = {
  en: {
    impuritati: "impurities", "impurități": "impurities", "varfuri arse": "burnt tips", "vârfuri arse": "burnt tips",
    "frunze galbene": "yellow leaves", "frunze arse": "burnt leaves", "frunze negre": "black leaves", "frunze putrede": "rotten leaves",
    putred: "rotten", mucegai: "mold", umed: "wet", "usor umed": "slightly damp", "ușor umed": "slightly damp",
    deshidratat: "dehydrated", "tije lungi": "long stems", "cozi lungi": "long tails", seminte: "seeds", semințe: "seeds",
    flori: "flowers", crengi: "branches", neuniform: "uneven", "capete nedezvoltate": "undeveloped heads",
  },
  ro: {
    impurities: "impurități", "burnt tips": "vârfuri arse", "yellow leaves": "frunze galbene", "burnt leaves": "frunze arse",
    "black leaves": "frunze negre", "rotten leaves": "frunze putrede", rotten: "putred", mold: "mucegai", wet: "umed",
    "slightly damp": "ușor umed", dehydrated: "deshidratat", "long stems": "tije lungi", "long tails": "cozi lungi",
    seeds: "semințe", flowers: "flori", branches: "crengi", uneven: "neuniform", "undeveloped heads": "capete nedezvoltate",
  },
  it: {
    impurities: "impurità", impuritati: "impurità", "impurități": "impurità", "burnt tips": "punte bruciate", "vârfuri arse": "punte bruciate",
    "yellow leaves": "foglie gialle", "frunze galbene": "foglie gialle", "burnt leaves": "foglie bruciate", "frunze arse": "foglie bruciate",
    "black leaves": "foglie nere", "rotten leaves": "foglie marce", putred: "marcio", rotten: "marcio", mold: "muffa", mucegai: "muffa",
    wet: "bagnato", umed: "bagnato", "slightly damp": "leggermente umido", "ușor umed": "leggermente umido",
    dehydrated: "disidratato", deshidratat: "disidratato", "long stems": "gambi lunghi", "tije lungi": "gambi lunghi",
    "long tails": "code lunghe", "cozi lungi": "code lunghe", seeds: "semi", seminte: "semi", semințe: "semi", flowers: "fiori", flori: "fiori",
    branches: "rami", crengi: "rami", uneven: "non uniforme", neuniform: "non uniforme", "undeveloped heads": "cespi non sviluppati",
  },
};

const translateKnownTerms = (text: string, lang: EmailLang) => {
  let out = text;
  Object.entries(QUALITY_TRANSLATIONS[lang]).forEach(([from, to]) => {
    out = out.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), to);
  });
  return out;
};

const translateEmailDraft = (text: string, target: EmailLang) => {
  const phraseMap: Record<EmailLang, Record<string, string>> = {
    en: {
      "Bună ziua": "Good afternoon", "Buon pomeriggio": "Good afternoon", "am constatat următoarele probleme calitative": "we found the following quality problems",
      "abbiamo riscontrato i seguenti problemi qualitativi": "we found the following quality problems", "Solicităm notă de credit pentru": "We want a credit note for",
      "Chiediamo una nota di credito per": "We want a credit note for", "Vă transmit diferențele": "I send you the differences", "Vi inviamo le differenze": "I send you the differences",
      "Nu avem diferențe cantitative": "We do not have quantitative differences", "Non abbiamo differenze quantitative": "We do not have quantitative differences",
      "Vă rugăm să ne transmiteți notele de credit în termen de 30 de zile": "Please send us your credit notes within 30 days",
      "Vi preghiamo di inviarci le note di credito entro 30 giorni": "Please send us your credit notes within 30 days", "Mulțumim, o zi bună": "Thank you, have a good day", "Grazie, buona giornata": "Thank you, have a good day",
      "Tabel recepție": "Reception table", "Tabella ricevimento": "Reception table", "Poze": "Photos", "Foto": "Photos", "lipsă": "less", "mai puțin": "less", "in meno": "less",
    },
    ro: {
      "Good afternoon": "Bună ziua", "Buon pomeriggio": "Bună ziua", "we found the following quality problems": "am constatat următoarele probleme calitative",
      "abbiamo riscontrato i seguenti problemi qualitativi": "am constatat următoarele probleme calitative", "We want a credit note for": "Solicităm notă de credit pentru",
      "Chiediamo una nota di credito per": "Solicităm notă de credit pentru", "I send you the differences": "Vă transmit diferențele", "Vi inviamo le differenze": "Vă transmit diferențele",
      "We do not have quantitative differences": "Nu avem diferențe cantitative", "Non abbiamo differenze quantitative": "Nu avem diferențe cantitative",
      "Please send us your credit notes within 30 days": "Vă rugăm să ne transmiteți notele de credit în termen de 30 de zile",
      "Vi preghiamo di inviarci le note di credito entro 30 giorni": "Vă rugăm să ne transmiteți notele de credit în termen de 30 de zile", "Thank you, have a good day": "Mulțumim, o zi bună", "Grazie, buona giornata": "Mulțumim, o zi bună",
      "Reception table": "Tabel recepție", "Tabella ricevimento": "Tabel recepție", "Photos": "Poze", "Foto": "Poze", "less": "mai puțin", "in meno": "mai puțin",
    },
    it: {
      "Good afternoon": "Buon pomeriggio", "Bună ziua": "Buon pomeriggio", "we found the following quality problems": "abbiamo riscontrato i seguenti problemi qualitativi",
      "am constatat următoarele probleme calitative": "abbiamo riscontrato i seguenti problemi qualitativi", "We want a credit note for": "Chiediamo una nota di credito per",
      "Solicităm notă de credit pentru": "Chiediamo una nota di credito per", "I send you the differences": "Vi inviamo le differenze", "Vă transmit diferențele": "Vi inviamo le differenze",
      "We do not have quantitative differences": "Non abbiamo differenze quantitative", "Nu avem diferențe cantitative": "Non abbiamo differenze quantitative",
      "Please send us your credit notes within 30 days": "Vi preghiamo di inviarci le note di credito entro 30 giorni",
      "Vă rugăm să ne transmiteți notele de credit în termen de 30 de zile": "Vi preghiamo di inviarci le note di credito entro 30 giorni", "Thank you, have a good day": "Grazie, buona giornata", "Mulțumim, o zi bună": "Grazie, buona giornata",
      "Reception table": "Tabella ricevimento", "Tabel recepție": "Tabella ricevimento", "Photos": "Foto", "Poze": "Foto", "less": "in meno", "mai puțin": "in meno", "lipsă": "in meno",
    },
  };
  let out = text;
  Object.entries(phraseMap[target]).forEach(([from, to]) => {
    out = out.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), to);
  });
  return translateKnownTerms(out, target);
};

const translateEmailText = async (text: string, target: EmailLang) => {
  if (!text.trim()) return "";
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("translate failed");
    const data = await res.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map((x: any[]) => x?.[0] || "").join("") : "";
    return translated || translateEmailDraft(text, target);
  } catch {
    return translateEmailDraft(text, target);
  }
};

const ReceptionReport: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const { toast } = useToast();
  const dateStorageKey = `receptionReport.date.${inventoryType}`;
  const [date, setDateState] = useState<Date>(() => {
    return dateFromKey(readStoredDateKey(dateStorageKey, todayKey()));
  });
  const setDate = (d: Date) => {
    setDateState(d);
    persistDateKey(dateStorageKey, keyFromDate(d));
  };
  // Re-citește data salvată când se schimbă inventoryType (cheia se schimbă)
  useEffect(() => {
    setDateState(dateFromKey(readStoredDateKey(dateStorageKey, todayKey())));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [groups, setGroups] = useState<SupplierGroup[]>([]);
  const [defectsList, setDefectsList] = useState<LookupRow[]>([]);
  const [crateTypeMap, setCrateTypeMap] = useState<Map<string, string>>(new Map());
  const [crateTypesList, setCrateTypesList] = useState<LookupRow[]>([]);
  const [palletTypesList, setPalletTypesList] = useState<LookupRow[]>([]);
  const [tolerancesMap, setTolerancesMap] = useState<Map<string, ToleranceCfg>>(new Map());

  const getTol = (productId: string | null | undefined): ToleranceCfg =>
    (productId && tolerancesMap.get(productId)) || DEFAULT_TOLERANCE;

  // Dialogs
  const [photoDialog, setPhotoDialog] = useState<{ groupIdx: number; rowIdx: number } | null>(null);
  const [defectsDialog, setDefectsDialog] = useState<{ groupIdx: number; rowIdx: number } | null>(null);
  const [missingDialog, setMissingDialog] = useState<{ groupIdx: number } | null>(null);
  const [detailsDialog, setDetailsDialog] = useState<{ groupIdx: number; rowIdx: number } | null>(null);
  const [emailDialog, setEmailDialog] = useState<{ groupIdx: number } | null>(null);
  const [emailLang, setEmailLang] = useState<EmailLang>("en");
  const [emailBodyRo, setEmailBodyRo] = useState("");
  const [emailBodyEn, setEmailBodyEn] = useState("");
  const [emailBodyIt, setEmailBodyIt] = useState("");
  const [emailCopied, setEmailCopied] = useState(false);
  const [emailTranslating, setEmailTranslating] = useState(false);
  const [emailDefectTranslations, setEmailDefectTranslations] = useState<Record<string, Partial<Record<EmailLang, string>>>>({});
  const [emailVersion, setEmailVersion] = useState<"v1" | "v2">("v1");
  const [emailShortBodyRo, setEmailShortBodyRo] = useState("");
  const [emailShortBodyEn, setEmailShortBodyEn] = useState("");
  const [emailShortBodyIt, setEmailShortBodyIt] = useState("");
  const translateSeqRef = useRef(0);

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
    const tables = ["crate_types", "ambalaje_crate_types", "etichete_crate_types"];
    const results = await Promise.all(
      tables.map((t) =>
        (supabase as any).from(t).select("id, name").order("name").then((r: any) => (r.data as LookupRow[]) || [])
      )
    );
    const merged = new Map<string, LookupRow>();
    results.flat().forEach((r) => {
      const key = r.name.trim().toLowerCase();
      if (!merged.has(key)) merged.set(key, r);
    });
    setCrateTypesList(Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const loadPalletTypes = async () => {
    const tables = ["pallet_types", "ambalaje_pallet_types", "etichete_pallet_types"];
    const results = await Promise.all(
      tables.map((t) =>
        (supabase as any).from(t).select("id, name").order("name").then((r: any) => (r.data as LookupRow[]) || [])
      )
    );
    const merged = new Map<string, LookupRow>();
    results.flat().forEach((r) => {
      const key = r.name.trim().toLowerCase();
      if (!merged.has(key)) merged.set(key, r);
    });
    setPalletTypesList(Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name)));
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
          product_id: row.product_id ?? null,
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
          declared_quantity: existing?.declared_quantity != null ? String(existing.declared_quantity) : "",
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
          product_id: m.product_id ?? null,
          declared_quantity: "",
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

      // Load tolerances for all involved product_ids
      const productIds = Array.from(new Set(inv.map((r) => r.product_id).filter(Boolean))) as string[];
      const tolMap = new Map<string, ToleranceCfg>();
      if (productIds.length > 0) {
        for (let i = 0; i < productIds.length; i += 50) {
          const slice = productIds.slice(i, i + 50);
          const { data: tolData } = await (supabase as any)
            .from("product_reception_tolerances")
            .select("product_id, tolerance_under_percent, tolerance_over_kg")
            .eq("inventory_type", inventoryType)
            .in("product_id", slice);
          ((tolData || []) as any[]).forEach((t) => {
            tolMap.set(t.product_id, {
              under: Number(t.tolerance_under_percent ?? 3),
              over: Number(t.tolerance_over_kg ?? 105),
            });
          });
        }
      }
      setTolerancesMap(tolMap);
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
    loadPalletTypes();
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
          declared_quantity: row.declared_quantity !== "" ? parseFloat(row.declared_quantity) : null,
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

  // Cantitatea efectivă folosită în calcule.
  // declared_quantity = surplus în kg pe care îl DECLARĂM peste cantitatea de pe document
  // (ex.: a venit 837.5 kg cu doc 637.5 → surplus real 200 kg, dar declarăm doar 70 kg → effective = 707.5).
  const effectiveReceived = (r: ReportRow): number => {
    const doc = parseFloat(r.cantitate_document);
    const declared = parseFloat(r.declared_quantity);
    if (!isNaN(declared) && declared >= 0 && !isNaN(doc) && isOverThreshold(r)) {
      return doc + declared;
    }
    return r.cantitate_receptionata;
  };

  // True dacă recepția e sub document, dar diferența e în limita toleranței (%).
  const isUnderTolerance = (r: ReportRow): boolean => {
    const doc = parseFloat(r.cantitate_document);
    if (isNaN(doc) || doc <= 0) return false;
    const rec = r.cantitate_receptionata;
    if (rec >= doc) return false;
    const tol = getTol(r.product_id).under;
    return ((doc - rec) / doc) * 100 <= tol;
  };

  // True dacă recepția depășește documentul → cere „Cant. declarată".
  const isOverThreshold = (r: ReportRow): boolean => {
    const doc = parseFloat(r.cantitate_document);
    if (isNaN(doc) || doc <= 0) return false;
    return r.cantitate_receptionata > doc;
  };

  const calcDiferenta = (r: ReportRow) => {
    const doc = parseFloat(r.cantitate_document);
    if (isNaN(doc)) return null;
    if (isUnderTolerance(r)) return 0;
    return effectiveReceived(r) - doc;
  };
  const calcPierdereKg = (r: ReportRow) => {
    const proc = parseFloat(r.pierdere_calitativa_procent);
    if (isNaN(proc)) return null;
    // În cazul „sub toleranță", pierderea se calculează pe cantitatea de pe document
    const doc = parseFloat(r.cantitate_document);
    const base = isUnderTolerance(r) && !isNaN(doc) ? doc : effectiveReceived(r);
    return (base * proc) / 100;
  };
  // Pierdere (kg) se afișează/raportează rotunjit la întreg (1.34 -> 1, 1.55 -> 2)
  const calcPierdereKgRotunjit = (r: ReportRow) => {
    const v = calcPierdereKg(r);
    return v != null ? Math.round(v) : null;
  };
  const calcKgConsiderate = (r: ReportRow) => {
    // Folosim cantitatea recepționată brută (fără surplus declarat) și aplicăm pierderea în procente
    const base = r.cantitate_receptionata;
    const proc = parseFloat(r.pierdere_calitativa_procent);
    if (isNaN(proc)) return base;
    return base - (base * proc) / 100;
  };
  // Kg considerate se afișează/rapoartează rotunjit la întreg (1.34 -> 1, 1.55 -> 2)
  const calcKgConsiderateRotunjit = (r: ReportRow) => Math.round(calcKgConsiderate(r));

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
          declared_quantity: r.declared_quantity !== "" ? parseFloat(r.declared_quantity) : null,
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

  // Parse "2P/3L" / "2P/3L||TipLada" / "2P/3L||TipLada||BD:..." în {p, l, tip, bd}
  const parsePalDoc = (txt: string): {
    p: number | null; l: number | null; tip: string; bd: BreakdownPayload;
  } => {
    const decoded = decodePalDoc(txt || "");
    return {
      p: decoded.totalDocP,
      l: decoded.totalDocL,
      tip: decoded.legacyTipLada,
      bd: decoded.breakdown,
    };
  };

  // Reformat — preservă breakdown-ul existent (sau îl reflectă din p/l/tip pentru flow-ul vechi).
  const formatPalDoc = (
    p: number | null, l: number | null, tip: string = "", bd?: BreakdownPayload
  ): string => {
    const isEmpty = (!p || p <= 0) && (!l || l <= 0) && !tip && (!bd || (
      bd.rec_pallets.length === 0 && bd.rec_crates.length === 0 &&
      bd.doc_pallets.length === 0 && bd.doc_crates.length === 0
    ));
    if (isEmpty) return "";

    if (bd) {
      // Sincronizează totalurile doc cu p/l (păstrează intrarea unică din UI dacă există)
      const next: BreakdownPayload = {
        rec_pallets: bd.rec_pallets,
        rec_crates: bd.rec_crates,
        doc_pallets: bd.doc_pallets.length > 0 ? bd.doc_pallets : (p && p > 0 ? [{ id: null, name: "", count: p }] : []),
        doc_crates: bd.doc_crates.length > 0 ? bd.doc_crates : (l && l > 0 ? [{ id: null, name: tip, count: l }] : []),
      };
      // Dacă utilizatorul modifică totalurile p/l din inputurile simple (un singur tip), reflectă-le
      if (p != null && next.doc_pallets.length === 1) next.doc_pallets[0].count = p;
      if (l != null && next.doc_crates.length === 1) {
        next.doc_crates[0].count = l;
        if (tip) next.doc_crates[0].name = tip;
      }
      return encodePalDoc(next);
    }

    // Fără breakdown — format simplu
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
    const ladiDocByType = new Map<string, number>();
    const paletiRecByType = new Map<string, number>();
    const paletiDocByType = new Map<string, number>();
    const laziRecByType = new Map<string, number>();
    group.rows.forEach((r) => {
      if (r.is_missing) return;
      const { p, l, tip, bd } = parsePalDoc(r.paleti_lazi_document || "");

      // Recepție din breakdown (multi-tip) — fallback la coloanele simple dacă nu există BD
      if (bd.rec_pallets.length > 0) {
        bd.rec_pallets.forEach((row) => {
          if ((row.count || 0) <= 0) return;
          totalPaleti += row.count;
          if (row.name) paletiRecByType.set(row.name, (paletiRecByType.get(row.name) || 0) + row.count);
        });
      } else {
        totalPaleti += r.nr_paleti_rec || 0;
        if (r.tip_palet && r.nr_paleti_rec) {
          paletiRecByType.set(r.tip_palet, (paletiRecByType.get(r.tip_palet) || 0) + r.nr_paleti_rec);
        }
      }

      if (bd.rec_crates.length > 0) {
        bd.rec_crates.forEach((row) => {
          if ((row.count || 0) <= 0 || !row.name) return;
          ladiByType.set(row.name, (ladiByType.get(row.name) || 0) + row.count);
          laziRecByType.set(row.name, (laziRecByType.get(row.name) || 0) + row.count);
        });
      } else if (r.tip_lada_culoare && r.nr_lazi) {
        ladiByType.set(r.tip_lada_culoare, (ladiByType.get(r.tip_lada_culoare) || 0) + r.nr_lazi);
        laziRecByType.set(r.tip_lada_culoare, (laziRecByType.get(r.tip_lada_culoare) || 0) + r.nr_lazi);
      }

      // Document din breakdown
      if (bd.doc_pallets.length > 0) {
        bd.doc_pallets.forEach((row) => {
          if ((row.count || 0) <= 0) return;
          totalPaletiDoc += row.count;
          if (row.name) paletiDocByType.set(row.name, (paletiDocByType.get(row.name) || 0) + row.count);
        });
      } else if (p) {
        totalPaletiDoc += p;
      }

      if (bd.doc_crates.length > 0) {
        bd.doc_crates.forEach((row) => {
          if ((row.count || 0) <= 0) return;
          totalLaziDoc += row.count;
          if (row.name) ladiDocByType.set(row.name, (ladiDocByType.get(row.name) || 0) + row.count);
        });
      } else {
        if (l) totalLaziDoc += l;
        if (tip && l) ladiDocByType.set(tip, (ladiDocByType.get(tip) || 0) + l);
      }

      const cd = parseFloat(r.cantitate_document);
      if (!isNaN(cd)) totalCantDoc += cd;
    });
    return {
      totalPaleti, ladiByType, ladiDocByType,
      totalPaletiDoc, totalLaziDoc, totalCantDoc,
      paletiRecByType, paletiDocByType, laziRecByType,
    };
  };

  // ============ EXPORT EXCEL ============
  const exportSupplierReport = (group: SupplierGroup) => {
    const dateStr = format(date, "dd.MM.yyyy");
    const NCOLS = 20;
    const pad = (arr: (string | number | null)[]) => {
      const out = arr.slice();
      while (out.length < NCOLS) out.push(null);
      return out;
    };
    const aoa: (string | number | null)[][] = [];
    // Row 0: title (merged across all cols)
    aoa.push(pad(["CORAL BIOGREENS SRL"]));
    // Row 1: Data + Nr document
    aoa.push(pad(["Data receptie:", dateStr, null, null, null, null, null, null, null, null, "Nr document:", group.documentNumber || ""]));
    // Row 2: Furnizor
    aoa.push(pad(["Furnizor:", group.supplierName]));
    // Row 3: subtitle
    aoa.push(pad(["Document Receptie"]));
    aoa.push(pad([])); // spacer row 4
    // Row 5: column headers
    aoa.push([
      "Nr crt", "Denumire produs", "Producator",
      "Paleți doc", "Lăzi doc", "Tip lăzi doc", "Cantitate document", "Cantitate receptionata",
      "Tip lada/culoare", "Tip palet", "Nr paleti rec", "Nr Lazi",
      "Diferenta", "Pierdere calit. (%)", "Transmis furnizor",
      "Pierdere (kg)", "Kg considerate", "Defecte", "Observatii", "Status",
    ]);

    group.rows.forEach((r, idx) => {
      const dif = r.is_missing ? null : calcDiferenta(r);
      const pkg = r.is_missing ? null : calcPierdereKgRotunjit(r);
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
        r.is_missing ? 0 : calcKgConsiderateRotunjit(r),
        (r.defects || []).join(", "),
        r.observations || "",
        r.is_missing ? "LIPSĂ" : "OK",
      ]);
    });

    const dataStart = 6;
    const dataEnd = dataStart + group.rows.length - 1;

    // Totaluri – pun label în col 0 (va fi merge-uit cu următoarele coloane ca să nu se înfășoare vertical)
    const totals = groupTotals(group);
    aoa.push(pad([])); // spacer
    const totalsHeaderRow = aoa.length; aoa.push(pad(["TOTALURI"]));
    const totalsLabelRows: number[] = [];
    totalsLabelRows.push(aoa.length);
    aoa.push(pad(["Nr total paleți recepționați", null, null, null, null, totals.totalPaleti]));
    Array.from(totals.ladiByType.entries()).forEach(([tip, cnt]) => {
      totalsLabelRows.push(aoa.length);
      aoa.push(pad([`Nr lăzi (${tip})`, null, null, null, null, cnt]));
    });

    aoa.push(pad([])); // spacer
    const sigRow1 = aoa.length;
    aoa.push(pad(["Nume Prenume receptioner", null, null, null, "_____________________________", null, null, null, null, null, "Semnatura", null, "_____________________"]));
    aoa.push(pad([]));
    const sigRow2 = aoa.length;
    aoa.push(pad(["Nume Prenume calitate", null, null, null, "_____________________________", null, null, null, null, null, "Semnatura", null, "_____________________"]));

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Lățimi coloane optimizate pentru A4 landscape (legibile)
    ws["!cols"] = [
      { wch: 4 },   // Nr crt
      { wch: 11 },  // Denumire produs
      { wch: 10 },  // Producator
      { wch: 5 },   // Paleți doc
      { wch: 5 },   // Lăzi doc
      { wch: 8 },   // Tip lăzi doc
      { wch: 9 },   // Cantitate document
      { wch: 9 },   // Cantitate receptionata
      { wch: 10 },  // Tip lada/culoare
      { wch: 9 },   // Tip palet
      { wch: 6 },   // Nr paleti rec
      { wch: 5 },   // Nr Lazi
      { wch: 7 },   // Diferenta
      { wch: 8 },   // Pierdere calit. (%)
      { wch: 8 },   // Transmis furnizor
      { wch: 8 },   // Pierdere (kg)
      { wch: 9 },   // Kg considerate
      { wch: 20 },  // Defecte
      { wch: 11 },  // Observatii
      { wch: 7 },   // Status
    ];

    // Pune labels în B (col 0 e prea îngustă) – mutăm conținutul meta
    // Row 1: A="Data receptie:" merge cu B; valoare în C..F; "Nr document:" în L; valoare în M..N
    // Row 2: A="Furnizor:" merge cu B; valoare în C..J
    // Refacem rândurile de meta aici (suprascriem celulele)
    const setCell = (addr: string, v: any) => { ws[addr] = { v, t: typeof v === "number" ? "n" : "s" }; };
    // clear row 1 (B2..) and row 2
    for (let c = 0; c < NCOLS; c++) {
      const a1 = XLSX.utils.encode_cell({ r: 1, c });
      const a2 = XLSX.utils.encode_cell({ r: 2, c });
      delete ws[a1];
      delete ws[a2];
    }
    setCell("A2", "Data receptie:");
    setCell("C2", dateStr);
    setCell("L2", "Nr document:");
    setCell("N2", group.documentNumber || "");
    setCell("A3", "Furnizor:");
    setCell("C3", group.supplierName);

    const headerRowIdx = 5;
    const totalsHeaderRowIdx = totalsHeaderRow;

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } },           // titlu
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },                    // "Data receptie:"
      { s: { r: 1, c: 2 }, e: { r: 1, c: 5 } },                    // valoare data
      { s: { r: 1, c: 11 }, e: { r: 1, c: 12 } },                  // "Nr document:"
      { s: { r: 1, c: 13 }, e: { r: 1, c: NCOLS - 1 } },           // valoare nr doc
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },                    // "Furnizor:"
      { s: { r: 2, c: 2 }, e: { r: 2, c: 9 } },                    // valoare furnizor
      { s: { r: 3, c: 0 }, e: { r: 3, c: NCOLS - 1 } },            // subtitle
      // Totaluri
      { s: { r: totalsHeaderRowIdx, c: 0 }, e: { r: totalsHeaderRowIdx, c: NCOLS - 1 } },
      ...totalsLabelRows.map((r) => ({ s: { r, c: 0 }, e: { r, c: 4 } })),
      ...totalsLabelRows.map((r) => ({ s: { r, c: 5 }, e: { r, c: 7 } })),
      // Semnături
      { s: { r: sigRow1, c: 0 }, e: { r: sigRow1, c: 3 } },
      { s: { r: sigRow1, c: 4 }, e: { r: sigRow1, c: 9 } },
      { s: { r: sigRow1, c: 10 }, e: { r: sigRow1, c: 11 } },
      { s: { r: sigRow1, c: 12 }, e: { r: sigRow1, c: NCOLS - 1 } },
      { s: { r: sigRow2, c: 0 }, e: { r: sigRow2, c: 3 } },
      { s: { r: sigRow2, c: 4 }, e: { r: sigRow2, c: 9 } },
      { s: { r: sigRow2, c: 10 }, e: { r: sigRow2, c: 11 } },
      { s: { r: sigRow2, c: 12 }, e: { r: sigRow2, c: NCOLS - 1 } },
    ];

    const rows: any[] = [];
    rows[0] = { hpt: 24 };
    rows[1] = { hpt: 18 };
    rows[2] = { hpt: 18 };
    rows[3] = { hpt: 20 };
    rows[4] = { hpt: 6 };
    rows[headerRowIdx] = { hpt: 46 };
    // Înălțime dinamică pe baza textului din Defecte / Observatii / Denumire (pt 10, ~13pt per linie)
    const wrapLines = (text: string, width: number) => {
      if (!text) return 1;
      const words = String(text).split(/\s+/);
      let lines = 1, cur = 0;
      for (const w of words) {
        const len = w.length + (cur > 0 ? 1 : 0);
        if (cur + len > width) { lines++; cur = w.length; } else { cur += len; }
      }
      return Math.max(1, lines);
    };
    group.rows.forEach((r, idx) => {
      const def = (r.defects || []).join(", ");
      const obs = r.observations || "";
      const den = r.denumire_produs || "";
      const linesDef = wrapLines(def, 20);
      const linesObs = wrapLines(obs, 11);
      const linesDen = wrapLines(den, 11);
      const lines = Math.max(linesDef, linesObs, linesDen, 2);
      rows[dataStart + idx] = { hpt: Math.min(120, 14 + lines * 13) };
    });
    rows[totalsHeaderRowIdx] = { hpt: 22 };
    totalsLabelRows.forEach((r) => { rows[r] = { hpt: 20 }; });
    rows[sigRow1] = { hpt: 24 };
    rows[sigRow2] = { hpt: 24 };
    ws["!rows"] = rows;

    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    const thinBorder = { style: "thin", color: { rgb: "BFBFBF" } } as any;
    const border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    const totalsLabelSet = new Set(totalsLabelRows);

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;

        const isHeader = R === headerRowIdx;
        const isData = R >= dataStart && R <= dataEnd;
        const isTitle = R === 0;
        const isSubtitle = R === 3;
        const isTotalsHeader = R === totalsHeaderRowIdx;
        const isTotalsLabel = totalsLabelSet.has(R);

        const base: any = {
          alignment: {
            wrapText: true,
            vertical: "center",
            horizontal: isTitle || isSubtitle || isTotalsHeader
              ? "center"
              : (isHeader ? "center" : (typeof cell.v === "number" ? "right" : "left")),
          },
          font: {
            name: "Calibri",
            sz: isTitle ? 15 : (isSubtitle ? 12 : (isHeader ? 10 : (isTotalsHeader ? 12 : (isTotalsLabel ? 11 : 10)))),
            bold: isTitle || isSubtitle || isHeader || isTotalsHeader || isTotalsLabel,
          },
        };

        if (isHeader) {
          base.fill = { patternType: "solid", fgColor: { rgb: "2E7D32" } };
          base.font.color = { rgb: "FFFFFF" };
          base.border = border;
        } else if (isData) {
          base.border = border;
        } else if (isTotalsLabel) {
          base.border = border;
        }

        cell.s = base;
        if (typeof cell.v === "number" && isData) {
          cell.z = "0.00";
        }
      }
    }

    // Forțăm tot pe o singură pagină
    (ws as any)["!pageSetup"] = {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToWidth: 1,
      fitToHeight: 1,
      scale: 75,
    };
    (ws as any)["!printOptions"] = { horizontalCentered: true };
    (ws as any)["!margins"] = { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 };
    (ws as any)["!sheetPr"] = { pageSetUpPr: { fitToPage: true } };

    const wb = XLSX.utils.book_new();
    (wb as any).Workbook = {
      Views: [{ RTL: false }],
      Sheets: [{ Hidden: 0 }],
    };
    XLSX.utils.book_append_sheet(wb, ws, "Receptie");
    const safe = group.supplierName.replace(/[^a-z0-9]/gi, "_");
    XLSX.writeFile(wb, `Receptie_${safe}_${format(date, "yyyy-MM-dd")}.xlsx`);
  };

  // ============ EMAIL FURNIZOR (RO + EN) ============
  const fmtKg = (n: number) => {
    const s = n.toFixed(2);
    if (s.endsWith(".00")) return s.slice(0, -3);
    if (s.endsWith("0")) return s.slice(0, -1);
    return s;
  };

  const buildEmailContent = (group: SupplierGroup): EmailContent => {
    const dateStr = format(date, "dd.MM.yyyy");
    const doc = group.documentNumber || "—";
    const partner = group.supplierName;

    const qualityRows = group.rows.filter((r) => {
      if (r.is_missing) return false;
      const proc = parseFloat(r.pierdere_calitativa_procent);
      const hasLoss = !isNaN(proc) && proc > 0;
      const hasDefects = (r.defects && r.defects.length > 0) || (r.observations && r.observations.trim() !== "");
      return hasLoss || hasDefects;
    });
    const diffRows = group.rows.filter((r) => {
      if (r.is_missing) return true;
      const dif = calcDiferenta(r);
      return dif != null && dif !== 0;
    });

    const sub = (r: ReportRow) => r.producator || partner;
    const desc = (r: ReportRow, lang: EmailLang) => translateKnownTerms([(r.defects || []).join(", "), r.observations].filter(Boolean).join(", ").trim(), lang);
    const render = (lang: EmailLang) => {
      const lines: string[] = [lang === "ro" ? "Bună ziua," : lang === "it" ? "Buon pomeriggio," : "Good afternoon,", ""];
      if (qualityRows.length > 0) {
        lines.push(
          lang === "ro"
            ? `La recepția din ${dateStr}, ${partner} cu numărul de document ${doc} am constatat următoarele probleme calitative:`
            : lang === "it"
              ? `Al ricevimento del ${dateStr}, ${partner} con numero documento ${doc}, abbiamo riscontrato i seguenti problemi qualitativi:`
              : `At the reception on ${dateStr}, ${partner} with document number ${doc}, we found the following quality problems:`,
          ""
        );
        qualityRows.forEach((r) => {
          const lossKg = calcPierdereKgRotunjit(r);
          const lossTxt = lossKg != null && lossKg > 0
            ? lang === "ro" ? ` Solicităm notă de credit pentru ${fmtKg(lossKg)}${r.unit || "kg"}.`
              : lang === "it" ? ` Chiediamo una nota di credito per ${fmtKg(lossKg)}${r.unit || "kg"}.`
                : ` We want a credit note for ${fmtKg(lossKg)}${r.unit || "kg"}.`
            : "";
          const recvForEmail = effectiveReceived(r);
          lines.push(
            lang === "ro"
              ? `${r.denumire_produs} de la furnizorul ${sub(r)} am recepționat ${fmtKg(recvForEmail)}${r.unit || "kg"} – ${desc(r, lang) || "probleme calitative"}.${lossTxt}`
              : lang === "it"
                ? `${r.denumire_produs} dal fornitore ${sub(r)} abbiamo ricevuto ${fmtKg(recvForEmail)}${r.unit || "kg"} – ${desc(r, lang) || "problemi qualitativi"}.${lossTxt}`
                : `${r.denumire_produs} from the supplier ${sub(r)} we received ${fmtKg(recvForEmail)}${r.unit || "kg"} – ${desc(r, lang) || "quality issues"}.${lossTxt}`,
            ""
          );
        });
      }
      if (diffRows.length > 0) {
        lines.push(
          lang === "ro" ? `Vă transmit diferențele de la recepția de astăzi cu numărul de document ${doc}:`
            : lang === "it" ? `Vi inviamo le differenze dal ricevimento di oggi con numero documento ${doc}:`
              : `I send you the differences from today's receipt with document number ${doc}:`,
          ""
        );
        diffRows.forEach((r) => {
          const dif = r.is_missing ? -(parseFloat(r.cantitate_document) || 0) : (calcDiferenta(r) || 0);
          const qty = Math.abs(dif);
          const unit = r.unit || "kg";
          const suffix = r.is_missing
            ? (lang === "ro" ? "lipsă (nu a fost livrat)" : lang === "it" ? "in meno (non consegnato)" : "less (not delivered)")
            : dif < 0
              ? (lang === "ro" ? "mai puțin" : lang === "it" ? "in meno" : "less")
              : (lang === "ro" ? "în plus" : lang === "it" ? "in più" : "extra");
          lines.push(`${r.denumire_produs} – ${fmtKg(qty)}${unit} ${suffix}`);
        });
        lines.push("");
      } else if (qualityRows.length > 0) {
        lines.push(lang === "ro" ? "Nu avem diferențe cantitative." : lang === "it" ? "Non abbiamo differenze quantitative." : "We do not have quantitative differences.", "");
      }
      lines.push(
        lang === "ro" ? "Vă rugăm să ne transmiteți notele de credit în termen de 30 de zile."
          : lang === "it" ? "Vi preghiamo di inviarci le note di credito entro 30 giorni."
            : "Please send us your credit notes within 30 days.",
        "",
        lang === "ro" ? "Mulțumim, o zi bună!" : lang === "it" ? "Grazie, buona giornata!" : "Thank you, have a good day!"
      );
      return lines.join("\n");
    };

    return { en: render("en"), ro: render("ro"), it: render("it") };
  };

  const allPhotosForGroup = (group: SupplierGroup) => {
    const out: { row: ReportRow; photo: PhotoRef }[] = [];
    group.rows.forEach((r) => (r.photos || []).forEach((p) => out.push({ row: r, photo: p })));
    return out;
  };

  const buildShortIntro = (group: SupplierGroup): EmailContent => {
    const dateStr = format(date, "dd.MM.yyyy");
    const doc = group.documentNumber || "—";
    const partner = group.supplierName;
    return {
      ro: `Bună ziua,\n\nVă transmit mai jos raportul calitativ pentru recepția din ${dateStr}, ${partner}, document ${doc}.\n\nVă rugăm să ne transmiteți notele de credit în termen de 30 de zile.\n\nMulțumim, o zi bună!`,
      en: `Good afternoon,\n\nPlease find below the quality report for the reception on ${dateStr}, ${partner}, document ${doc}.\n\nPlease send us your credit notes within 30 days.\n\nThank you, have a good day!`,
      it: `Buon pomeriggio,\n\nIn allegato il report qualitativo per il ricevimento del ${dateStr}, ${partner}, documento ${doc}.\n\nVi preghiamo di inviarci le note di credito entro 30 giorni.\n\nGrazie, buona giornata!`,
    };
  };

  const openEmailDialog = (groupIdx: number) => {
    const { en, ro, it } = buildEmailContent(groups[groupIdx]);
    const short = buildShortIntro(groups[groupIdx]);
    const defectTexts = Array.from(new Set(groups[groupIdx].rows
      .map((r) => [(r.defects || []).join(", "), r.observations].filter(Boolean).join(", ").trim())
      .filter(Boolean)));
    setEmailBodyEn(en);
    setEmailBodyRo(ro);
    setEmailBodyIt(it);
    setEmailShortBodyEn(short.en);
    setEmailShortBodyRo(short.ro);
    setEmailShortBodyIt(short.it);
    setEmailLang("en");
    setEmailCopied(false);
    setEmailDefectTranslations({});
    setEmailDialog({ groupIdx });

    const seq = ++translateSeqRef.current;
    setEmailTranslating(true);
    Promise.all([
      translateEmailText(ro, "en"),
      translateEmailText(ro, "it"),
      Promise.all(defectTexts.map(async (text) => {
        const [enDef, itDef] = await Promise.all([translateEmailText(text, "en"), translateEmailText(text, "it")]);
        return [text, { ro: text, en: enDef || translateKnownTerms(text, "en"), it: itDef || translateKnownTerms(text, "it") }] as const;
      })),
    ]).then(([enText, itText, defectEntries]) => {
      if (translateSeqRef.current !== seq) return;
      setEmailBodyEn(enText || en);
      setEmailBodyIt(itText || it);
      setEmailDefectTranslations(Object.fromEntries(defectEntries));
      setEmailTranslating(false);
    }).catch(() => {
      if (translateSeqRef.current !== seq) return;
      setEmailTranslating(false);
    });
  };

  const buildBodyWithPhotos = () => {
    if (emailVersion === "v2") {
      if (emailLang === "ro") return emailShortBodyRo;
      if (emailLang === "it") return emailShortBodyIt;
      return emailShortBodyEn;
    }
    if (emailLang === "ro") return emailBodyRo;
    if (emailLang === "it") return emailBodyIt;
    return emailBodyEn;
  };

  const getEmailTableRows = (group: SupplierGroup, lang: EmailLang) => group.rows.map((r) => {
    const dif = r.is_missing ? -(parseFloat(r.cantitate_document) || 0) : calcDiferenta(r);
    const lossKg = r.is_missing ? null : calcPierdereKg(r);
    const shortageKg = dif != null && dif < 0 ? Math.abs(dif) : 0;
    // Nota de credit se raportează rotunjit la întreg, ca și Pierd. (kg)
    const creditKg = Math.round(shortageKg + (lossKg != null && lossKg > 0 ? lossKg : 0));
    const lossPercent = parseFloat(r.pierdere_calitativa_procent);
    const unit = r.unit || "kg";
    const rawDefects = [(r.defects || []).join(", "), r.observations].filter(Boolean).join(", ").trim();
    const differenceText = dif == null
      ? "—"
      : dif < 0
        ? lang === "ro" ? `${fmtKg(Math.abs(dif))}${unit} mai puțin`
          : lang === "it" ? `${fmtKg(Math.abs(dif))}${unit} in meno`
            : `${fmtKg(Math.abs(dif))}${unit} less`
        : dif > 0
          ? lang === "ro" ? `${fmtKg(dif)}${unit} în plus`
            : lang === "it" ? `${fmtKg(dif)}${unit} in più`
              : `${fmtKg(dif)}${unit} extra`
          : `0${unit}`;
    const qualityLossText = !isNaN(lossPercent) && lossPercent > 0 && lossKg != null
      ? `${fmtKg(lossPercent)}% = ${fmtKg(Math.round(lossKg))}${unit}`
      : "—";
    return {
      product: r.denumire_produs,
      producer: r.producator || group.supplierName || "—",
      document: r.cantitate_document ? `${fmtKg(parseFloat(r.cantitate_document) || 0)}${unit}` : "—",
      received: `${fmtKg(effectiveReceived(r))}${unit}`,
      difference: differenceText,
      loss: qualityLossText,
      credit: creditKg > 0 ? `${fmtKg(creditKg)}${unit}` : "—",
      defects: emailDefectTranslations[rawDefects]?.[lang] || translateKnownTerms(rawDefects, lang) || "—",
      kgConsid: r.is_missing ? "—" : `${calcKgConsiderateRotunjit(r)}${unit}`,
      photos: (r.photos || []).length > 0 ? `${r.photos.length} link` : "—",
    };
  });

  // V2 – tabel scurt asemenea Quality Report atașat
  const getEmailTableRowsV2 = (group: SupplierGroup, lang: EmailLang) => {
    const dateStr = format(date, "dd.MM.yyyy");
    return group.rows.map((r) => {
      const dif = r.is_missing ? -(parseFloat(r.cantitate_document) || 0) : calcDiferenta(r);
      const lossKg = r.is_missing ? null : calcPierdereKg(r);
      const shortageKg = dif != null && dif < 0 ? Math.abs(dif) : 0;
      // Nota de credit se raportează rotunjit la întreg, ca și Pierd. (kg)
      const creditKg = Math.round(shortageKg + (lossKg != null && lossKg > 0 ? lossKg : 0));
      const unit = r.unit || "kg";
      const rawDefects = [(r.defects || []).join(", "), r.observations].filter(Boolean).join(", ").trim();
      const defectsText = emailDefectTranslations[rawDefects]?.[lang] || translateKnownTerms(rawDefects, lang) || "-";
      const docQty = r.cantitate_document ? `${fmtKg(parseFloat(r.cantitate_document) || 0)}${unit}` : "-";
      const recvQty = `${fmtKg(effectiveReceived(r))}${unit}`;
      const diffText = dif == null || dif === 0
        ? "-"
        : dif < 0
          ? lang === "ro" ? `${fmtKg(Math.abs(dif))}${unit} mai puțin`
            : lang === "it" ? `${fmtKg(Math.abs(dif))}${unit} in meno`
              : `${fmtKg(Math.abs(dif))}${unit} less`
          : lang === "ro" ? `${fmtKg(dif)}${unit} în plus`
            : lang === "it" ? `${fmtKg(dif)}${unit} in più`
              : `${fmtKg(dif)}${unit} extra`;
      return {
        date: dateStr,
        supplier: group.supplierName || "-",
        document: group.documentNumber || "-",
        product: r.denumire_produs,
        producer: r.producator || group.supplierName || "-",
        docQty,
        recvQty,
        diff: diffText,
        defects: defectsText || "-",
        credit: creditKg > 0 ? `${fmtKg(creditKg)}${unit}` : "-",
        kgConsid: r.is_missing ? "-" : `${calcKgConsiderateRotunjit(r)}${unit}`,
      };
    });
  };

  const emailHeaders = (lang: EmailLang) => lang === "ro"
    ? ["Produs", "Producător", "Cantitate document", "Cantitate recepționată", "Diferență cantitativă", "Pierdere calitativă", "Notă de credit", "Defecte", "Poze"]
    : lang === "it"
      ? ["Prodotto", "Produttore", "Quantità documento", "Quantità ricevuta", "Differenza quantitativa", "Perdita qualitativa", "Nota di credito", "Difetti", "Foto"]
      : ["Product", "Producer", "Document quantity", "Received quantity", "Quantitative difference", "Quality loss", "Credit note", "Defects", "Photos"];

  const emailHeadersV2 = (lang: EmailLang) => lang === "ro"
    ? ["Data", "Furnizor", "Nr. Document", "Denumire produs", "Producător", "Cant. Document\n(kg/buc)", "Cant. Recepționată\n(kg/buc)", "Diferență\nCantitativă", "Probleme Calitative\nConstatate", "Notă Credit\nCalitativă (kg)"]
    : lang === "it"
      ? ["Data", "Fornitore", "N. Documento", "Nome prodotto", "Produttore", "Q.tà Documento\n(kg/pz)", "Q.tà Ricevuta\n(kg/pz)", "Differenza\nQuantitativa", "Difetti Qualitativi\nRiscontrati", "Nota Credito\nQualitativo (kg)"]
      : ["Date", "Supplier", "Document No.", "Product name", "Producer", "Document Qty\n(kg/pcs)", "Received Qty\n(kg/pcs)", "Quantity\nDifference", "Quality Defects\nIdentified", "Quality Credit\nNote (kg)"];

  const buildEmailPlainText = (group: SupplierGroup) => {
    const isV2 = emailVersion === "v2";
    const headers = isV2 ? emailHeadersV2(emailLang) : emailHeaders(emailLang);
    const photoLines = allPhotosForGroup(group).map((p) => `${p.row.denumire_produs}: ${getReceptionPhotoUrl(p.photo)}`);
    const tableTitle = emailLang === "ro"
      ? (isV2 ? "Raport calitativ:" : "Tabel recepție:")
      : emailLang === "it"
        ? (isV2 ? "Report qualitativo:" : "Tabella ricevimento:")
        : (isV2 ? "Quality report:" : "Reception table:");
    const rowLines = isV2
      ? getEmailTableRowsV2(group, emailLang).map((r) => [r.date, r.supplier, r.document, r.product, r.producer, r.docQty, r.recvQty, r.diff, r.defects, r.credit].join(" | "))
      : getEmailTableRows(group, emailLang).map((r) => [r.product, r.producer, r.document, r.received, r.difference, r.loss, r.credit, r.defects, r.photos].join(" | "));
    return [
      buildBodyWithPhotos(),
      "",
      tableTitle,
      headers.map((h) => h.replace(/\n/g, " ")).join(" | "),
      ...rowLines,
      ...(photoLines.length ? ["", emailLang === "ro" ? "Poze:" : emailLang === "it" ? "Foto:" : "Photos:", ...photoLines] : []),
    ].join("\n");
  };

  const buildEmailHtml = (group: SupplierGroup) => {
    const isV2 = emailVersion === "v2";
    const headers = isV2 ? emailHeadersV2(emailLang) : emailHeaders(emailLang);
    const photos = allPhotosForGroup(group);
    const tableTitle = emailLang === "ro"
      ? (isV2 ? "Raport calitativ" : "Tabel recepție")
      : emailLang === "it"
        ? (isV2 ? "Report qualitativo" : "Tabella ricevimento")
        : (isV2 ? "Quality report" : "Reception table");
    const bodyCells = isV2
      ? getEmailTableRowsV2(group, emailLang).map((r) => [r.date, r.supplier, r.document, r.product, r.producer, r.docQty, r.recvQty, r.diff, r.defects, r.credit])
      : getEmailTableRows(group, emailLang).map((r) => [r.product, r.producer, r.document, r.received, r.difference, r.loss, r.credit, r.defects, r.photos]);
    return `
      <div style="font-family: Arial, sans-serif; color:#111827; font-size:14px; line-height:1.45;">
        ${buildBodyWithPhotos().split("\n").map((line) => line.trim() ? `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>` : `<br />`).join("")}
        <h3 style="margin:18px 0 8px; font-size:16px;">${tableTitle}</h3>
        <table style="border-collapse:collapse; width:100%; font-size:13px;">
          <thead><tr>${headers.map((h) => `<th style="border:1px solid #d1d5db; padding:8px; background:#f3f4f6; text-align:left; white-space:pre-line;">${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${bodyCells.map((cells) => `<tr>${cells.map((v) => `<td style="border:1px solid #d1d5db; padding:8px; vertical-align:top;">${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
        ${photos.length ? `<h3 style="margin:18px 0 8px; font-size:16px;">${emailLang === "ro" ? "Poze" : emailLang === "it" ? "Foto" : "Photos"}</h3><ul style="padding-left:18px;">${photos.map((p) => `<li><a href="${escapeHtml(getReceptionPhotoUrl(p.photo))}">${escapeHtml(p.row.denumire_produs)}</a></li>`).join("")}</ul>` : ""}
      </div>`;
  };


  const syncEmailTranslations = (source: EmailLang, value: string) => {
    const seq = ++translateSeqRef.current;
    const isV2 = emailVersion === "v2";
    const setSelf = (v: string) => {
      if (source === "en") isV2 ? setEmailShortBodyEn(v) : setEmailBodyEn(v);
      else if (source === "ro") isV2 ? setEmailShortBodyRo(v) : setEmailBodyRo(v);
      else isV2 ? setEmailShortBodyIt(v) : setEmailBodyIt(v);
    };
    const setOthers = (a: string, b: string) => {
      if (source === "en") {
        isV2 ? setEmailShortBodyRo(a) : setEmailBodyRo(a);
        isV2 ? setEmailShortBodyIt(b) : setEmailBodyIt(b);
      } else if (source === "ro") {
        isV2 ? setEmailShortBodyEn(a) : setEmailBodyEn(a);
        isV2 ? setEmailShortBodyIt(b) : setEmailBodyIt(b);
      } else {
        isV2 ? setEmailShortBodyEn(a) : setEmailBodyEn(a);
        isV2 ? setEmailShortBodyRo(b) : setEmailBodyRo(b);
      }
    };
    setSelf(value);
    setEmailTranslating(true);
    const targets: EmailLang[] = source === "en" ? ["ro", "it"] : source === "ro" ? ["en", "it"] : ["en", "ro"];
    Promise.all(targets.map((t) => translateEmailText(value, t))).then(([a, b]) => {
      if (translateSeqRef.current !== seq) return;
      setOthers(a, b);
      setEmailTranslating(false);
    });
  };


  const copyEmailToClipboard = async () => {
    if (!emailDialog) return;
    const group = groups[emailDialog.groupIdx];
    try {
      const html = buildEmailHtml(group);
      const text = buildEmailPlainText(group);
      if ("ClipboardItem" in window) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
      toast({ title: "Email copiat", description: "Tabelul se lipește formatat în Gmail/Outlook." });
    } catch {
      toast({ title: "Nu s-a putut copia", variant: "destructive" });
    }
  };

  const renderMobileInfo = (label: string, value: React.ReactNode, className?: string) => (
    <div className={cn("rounded-md border bg-muted/30 p-2", className)}>
      <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold break-words">{value === null || value === undefined || value === "" ? "—" : value}</div>
    </div>
  );

  const renderDocPalletInput = (gIdx: number, rIdx: number, r: ReportRow) => {
    const { p, l, tip, bd } = parsePalDoc(r.paleti_lazi_document || "");
    if (bd.doc_pallets.length > 1) {
      return (
        <button type="button" className="text-left text-sm font-semibold underline-offset-2 hover:underline"
          onClick={() => setDetailsDialog({ groupIdx: gIdx, rowIdx: rIdx })}>
          {summarizeBreakdown(bd.doc_pallets)}
        </button>
      );
    }
    return (
      <Input type="number" min="0" step="1" placeholder="0" value={p ?? ""} disabled={r.is_missing}
        onChange={(e) => updateRow(gIdx, rIdx, "paleti_lazi_document", formatPalDoc(e.target.value === "" ? null : parseInt(e.target.value, 10), l, tip, bd))}
        className="h-11 text-base" />
    );
  };

  const renderDocCrateInput = (gIdx: number, rIdx: number, r: ReportRow) => {
    const { p, l, tip, bd } = parsePalDoc(r.paleti_lazi_document || "");
    if (bd.doc_crates.length > 1) {
      return (
        <button type="button" className="text-left text-sm font-semibold underline-offset-2 hover:underline"
          onClick={() => setDetailsDialog({ groupIdx: gIdx, rowIdx: rIdx })}>
          {summarizeBreakdown(bd.doc_crates)}
        </button>
      );
    }
    return (
      <Input type="number" min="0" step="1" placeholder="0" value={l ?? ""} disabled={r.is_missing}
        onChange={(e) => updateRow(gIdx, rIdx, "paleti_lazi_document", formatPalDoc(p, e.target.value === "" ? null : parseInt(e.target.value, 10), tip, bd))}
        className="h-11 text-base" />
    );
  };

  const renderDocCrateTypeInput = (gIdx: number, rIdx: number, r: ReportRow) => {
    const { p, l, tip, bd } = parsePalDoc(r.paleti_lazi_document || "");
    if (bd.doc_crates.length > 1) return <span className="text-sm text-muted-foreground">multi</span>;
    return (
      <Select value={tip || "__none__"} disabled={r.is_missing}
        onValueChange={(v) => updateRow(gIdx, rIdx, "paleti_lazi_document", formatPalDoc(p, l, v === "__none__" ? "" : v, bd))}>
        <SelectTrigger className="h-11 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent className="max-h-[300px] overflow-y-auto">
          <SelectItem value="__none__">—</SelectItem>
          {crateTypesList.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
    );
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
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg">Furnizor: {group.supplierName}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Nr document: {group.documentNumber || "—"} • {group.rows.length} produse
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-wrap">
                <Button size="sm" variant="outline" className="h-11 md:h-9" onClick={() => openMissingDialog(gIdx)}>
                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                  <span className="truncate">Articol lipsă</span>
                </Button>
                <Button size="sm" className="h-11 md:h-9" onClick={() => handleSaveGroup(group)}
                  disabled={savingKey === `${group.supplierName}__${group.documentNumber}`}>
                  {savingKey === `${group.supplierName}__${group.documentNumber}`
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Save className="h-4 w-4 mr-2" />}
                  Salvează
                </Button>
                <Button size="sm" variant="outline" className="h-11 md:h-9" onClick={() => exportSupplierReport(group)}>
                  <Download className="h-4 w-4 mr-2" />Exportă Excel
                </Button>
                <Button size="sm" variant="default" className="h-11 md:h-9" onClick={() => openEmailDialog(gIdx)}>
                  <Mail className="h-4 w-4 mr-2" />Email furnizor
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-3 md:px-2">
              <div className="space-y-3 md:hidden">
                {group.rows.map((r, rIdx) => {
                  const dif = r.is_missing ? null : calcDiferenta(r);
                  const pkg = r.is_missing ? null : calcPierdereKgRotunjit(r);
                  const { bd } = parsePalDoc(r.paleti_lazi_document || "");
                  const recC = bd.rec_crates;
                  const recP = bd.rec_pallets;
                  const tipLada = recC.length > 0 ? summarizeBreakdown(recC) : (r.tip_lada_culoare || "—");
                  const tipPalet = recP.length > 0 ? summarizeBreakdown(recP) : (r.tip_palet || "—");
                  const totalRecP = recP.length > 0 ? recP.reduce((s, x) => s + (x.count || 0), 0) : (r.nr_paleti_rec ?? null);
                  const totalRecL = recC.length > 0 ? recC.reduce((s, x) => s + (x.count || 0), 0) : (r.nr_lazi ?? null);
                  return (
                    <div key={r.inventory_id} className={cn("rounded-lg border bg-card p-3 shadow-sm", r.is_missing && "border-destructive/40 bg-destructive/5")}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">#{rIdx + 1}</span>
                            {r.is_missing && <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">LIPSĂ</span>}
                          </div>
                          <h3 className="mt-1 text-base font-bold leading-tight">{r.denumire_produs}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">Producător: {r.producator || "—"}</p>
                        </div>
                        {r.is_missing && r.missing_id && (
                          <Button size="sm" variant="ghost" className="h-9 w-9 shrink-0 p-0" onClick={() => handleRemoveMissing(r.missing_id!)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium uppercase text-muted-foreground">Paleți doc</p>
                          {renderDocPalletInput(gIdx, rIdx, r)}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium uppercase text-muted-foreground">Lăzi doc</p>
                          {renderDocCrateInput(gIdx, rIdx, r)}
                        </div>
                        <div className="col-span-2 space-y-1">
                          <p className="text-[11px] font-medium uppercase text-muted-foreground">Tip lăzi doc</p>
                          {renderDocCrateTypeInput(gIdx, rIdx, r)}
                        </div>
                        <div className="space-y-1 rounded-md border bg-muted/30 p-2">
                          <p className="text-[11px] font-medium uppercase text-muted-foreground">Cantitate document</p>
                          <Input type="number" step="0.01" placeholder="kg" value={r.cantitate_document} disabled={r.is_missing}
                            onChange={(e) => updateRow(gIdx, rIdx, "cantitate_document", e.target.value)} className="h-11 text-base" />
                        </div>
                        {renderMobileInfo("Cantitate recepționată", r.is_missing ? `0 ${r.unit}` : `${r.cantitate_receptionata} ${r.unit}`, r.is_missing ? "text-destructive" : "")}
                        {isOverThreshold(r) && !r.is_missing && (() => {
                          const doc = parseFloat(r.cantitate_document) || 0;
                          const surplusReal = Math.max(0, r.cantitate_receptionata - doc);
                          return (
                            <div className="col-span-2 space-y-1 rounded-md border border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 p-2">
                              <p className="text-[11px] font-medium uppercase text-blue-700 dark:text-blue-400">
                                Surplus declarat (kg) — max {surplusReal.toFixed(2)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Cât din surplus declari oficial peste cantitatea de pe document.
                              </p>
                              <Input type="number" step="0.01" min="0" max={surplusReal}
                                placeholder="kg surplus declarat" value={r.declared_quantity}
                                onChange={(e) => updateRow(gIdx, rIdx, "declared_quantity", e.target.value)} className="h-11 text-base" />
                            </div>
                          );
                        })()}
                        {renderMobileInfo("Tip ladă/culoare", tipLada)}
                        {renderMobileInfo("Tip palet", tipPalet)}
                        {renderMobileInfo("Nr paleți rec", totalRecP ?? "—")}
                        {renderMobileInfo("Nr lăzi", totalRecL ?? "—")}
                        {renderMobileInfo("Diferență", dif != null ? dif.toFixed(2) : "—", cn(dif != null && dif < 0 && "text-destructive", dif != null && dif > 0 && "text-primary"))}
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium uppercase text-muted-foreground">Pierd. %</p>
                          <Input type="number" step="0.01" disabled={r.is_missing} value={r.pierdere_calitativa_procent}
                            onChange={(e) => updateRow(gIdx, rIdx, "pierdere_calitativa_procent", e.target.value)} className="h-11 text-base" />
                        </div>
                        {renderMobileInfo("Pierdere kg", pkg != null ? String(pkg) : "—")}
                        {renderMobileInfo("Kg considerate", r.is_missing ? "—" : String(calcKgConsiderateRotunjit(r)), "text-primary")}
                        <label className="col-span-2 flex h-11 items-center justify-between rounded-md border bg-muted/30 px-3">
                          <span className="text-sm font-medium">Transmis furnizor</span>
                          <Checkbox checked={r.transmis_la_furnizor} disabled={r.is_missing} onCheckedChange={(v) => updateRow(gIdx, rIdx, "transmis_la_furnizor", Boolean(v))} />
                        </label>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <Button size="sm" variant="outline" className="h-11" disabled={r.is_missing} onClick={() => setDefectsDialog({ groupIdx: gIdx, rowIdx: rIdx })}>
                          Defecte {r.defects.length > 0 ? `${r.defects.length} ✓` : ""}
                        </Button>
                        <Button size="sm" variant="outline" className="h-11" disabled={r.is_missing} onClick={() => setPhotoDialog({ groupIdx: gIdx, rowIdx: rIdx })}>
                          <Camera className="mr-1 h-4 w-4" />{r.photos.length || "Poze"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-11" disabled={r.is_missing} onClick={() => setDetailsDialog({ groupIdx: gIdx, rowIdx: rIdx })}>
                          <Layers className="mr-1 h-4 w-4" />Detalii
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-lg border bg-muted/40 p-3 text-sm font-semibold">
                  <div className="grid grid-cols-2 gap-2">
                    <span>Total paleți doc: {totals.totalPaletiDoc || "—"}</span>
                    <span>Total lăzi doc: {totals.totalLaziDoc || "—"}</span>
                    <span>Total cant. doc: {totals.totalCantDoc > 0 ? totals.totalCantDoc.toFixed(2) : "—"}</span>
                    <span>Paleți rec: {totals.totalPaleti}</span>
                  </div>
                  {totals.ladiByType.size > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {Array.from(totals.ladiByType.entries()).map(([tip, cnt]) => <span key={tip} className="rounded border bg-background px-2 py-1">{tip}: <strong>{cnt}</strong> lăzi</span>)}
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden overflow-x-auto md:block">
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
                    <TableHead className="bg-blue-50 dark:bg-blue-950/30 min-w-[130px] w-[130px]" title="Surplus declarat în kg, peste cantitatea de pe document">Surplus decl. (kg)</TableHead>
                    <TableHead className="min-w-[110px]">Tip lada/culoare</TableHead>
                    <TableHead className="min-w-[100px]">Tip palet</TableHead>
                    <TableHead className="w-[60px]">Nr paleti rec</TableHead>
                    <TableHead className="w-[50px]">Nr Lazi</TableHead>
                    <TableHead className="w-[60px]">Diferență</TableHead>
                    <TableHead className="w-[120px]">Pierd. %</TableHead>
                    <TableHead className="w-[55px] text-center">Transmis</TableHead>
                    <TableHead className="w-[70px]">Pierd. (kg)</TableHead>
                    <TableHead className="w-[70px]">Kg consid.</TableHead>
                    <TableHead className="w-[80px]">Defecte</TableHead>
                    <TableHead className="w-[70px]">Poze</TableHead>
                    <TableHead className="w-[70px]">Detalii</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((r, rIdx) => {
                    const dif = r.is_missing ? null : calcDiferenta(r);
                    const pkg = r.is_missing ? null : calcPierdereKgRotunjit(r);
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
                            const { p, l, tip, bd } = parsePalDoc(r.paleti_lazi_document || "");
                            const multi = bd.doc_pallets.length > 1;
                            if (multi) {
                              return (
                                <button
                                  type="button"
                                  className="text-xs text-left underline-offset-2 hover:underline"
                                  onClick={() => setDetailsDialog({ groupIdx: gIdx, rowIdx: rIdx })}
                                >
                                  {summarizeBreakdown(bd.doc_pallets)}
                                </button>
                              );
                            }
                            return (
                              <Input type="number" min="0" step="1" placeholder="0"
                                value={p ?? ""} disabled={r.is_missing}
                                onChange={(e) => {
                                  const np = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  updateRow(gIdx, rIdx, "paleti_lazi_document", formatPalDoc(np, l, tip, bd));
                                }}
                                className="h-7 text-xs px-1 w-full" />
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const { p, l, tip, bd } = parsePalDoc(r.paleti_lazi_document || "");
                            const multi = bd.doc_crates.length > 1;
                            if (multi) {
                              return (
                                <button
                                  type="button"
                                  className="text-xs text-left underline-offset-2 hover:underline"
                                  onClick={() => setDetailsDialog({ groupIdx: gIdx, rowIdx: rIdx })}
                                >
                                  {summarizeBreakdown(bd.doc_crates)}
                                </button>
                              );
                            }
                            return (
                              <Input type="number" min="0" step="1" placeholder="0"
                                value={l ?? ""} disabled={r.is_missing}
                                onChange={(e) => {
                                  const nl = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  updateRow(gIdx, rIdx, "paleti_lazi_document", formatPalDoc(p, nl, tip, bd));
                                }}
                                className="h-7 text-xs px-1 w-full" />
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const { p, l, tip, bd } = parsePalDoc(r.paleti_lazi_document || "");
                            const multi = bd.doc_crates.length > 1;
                            if (multi) {
                              return <span className="text-[10px] text-muted-foreground">multi</span>;
                            }
                            return (
                              <Select
                                value={tip || "__none__"}
                                disabled={r.is_missing}
                                onValueChange={(v) => {
                                  const newTip = v === "__none__" ? "" : v;
                                  updateRow(gIdx, rIdx, "paleti_lazi_document", formatPalDoc(p, l, newTip, bd));
                                }}>
                                <SelectTrigger className="h-7 text-xs px-2 w-full">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px] overflow-y-auto">
                                  <SelectItem value="__none__">—</SelectItem>
                                  {crateTypesList.map((c) => (
                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                        <TableCell className={cn("bg-blue-50/50 dark:bg-blue-950/10", isOverThreshold(r) && !r.is_missing && "ring-1 ring-blue-400")}>
                          {isOverThreshold(r) && !r.is_missing ? (() => {
                            const doc = parseFloat(r.cantitate_document) || 0;
                            const surplusReal = Math.max(0, r.cantitate_receptionata - doc);
                            return (
                              <Input type="number" step="0.01" min="0" max={surplusReal}
                                placeholder={`≤ ${surplusReal.toFixed(2)}`}
                                title={`Surplus real ${surplusReal.toFixed(2)} kg. Declară doar cât vrei să recunoști oficial peste document.`}
                                value={r.declared_quantity}
                                onChange={(e) => updateRow(gIdx, rIdx, "declared_quantity", e.target.value)}
                                className="h-7 text-xs px-1 w-full" />
                            );
                          })() : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {(() => {
                          const { bd } = parsePalDoc(r.paleti_lazi_document || "");
                          const recC = bd.rec_crates;
                          const recP = bd.rec_pallets;
                          const tipLada = recC.length > 0 ? summarizeBreakdown(recC) : (r.tip_lada_culoare || "—");
                          const tipPalet = recP.length > 0 ? summarizeBreakdown(recP) : (r.tip_palet || "—");
                          const totalRecP = recP.length > 0 ? recP.reduce((s, x) => s + (x.count || 0), 0) : (r.nr_paleti_rec ?? null);
                          const totalRecL = recC.length > 0 ? recC.reduce((s, x) => s + (x.count || 0), 0) : (r.nr_lazi ?? null);
                          return (
                            <>
                              <TableCell className="text-[11px]">{tipLada}</TableCell>
                              <TableCell className="text-[11px]">{tipPalet}</TableCell>
                              <TableCell className="font-semibold">{totalRecP ?? "—"}</TableCell>
                              <TableCell className="font-semibold">{totalRecL ?? "—"}</TableCell>
                            </>
                          );
                        })()}
                        <TableCell className={cn("font-semibold",
                          dif != null && dif < 0 && "text-destructive",
                          dif != null && dif > 0 && "text-green-600")}>
                          {dif != null ? dif.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" disabled={r.is_missing}
                            value={r.pierdere_calitativa_procent}
                            onChange={(e) => updateRow(gIdx, rIdx, "pierdere_calitativa_procent", e.target.value)}
                            className="h-8 text-sm px-2 w-full min-w-[90px]" />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox checked={r.transmis_la_furnizor} disabled={r.is_missing}
                            onCheckedChange={(v) => updateRow(gIdx, rIdx, "transmis_la_furnizor", Boolean(v))} />
                        </TableCell>
                        <TableCell className="font-semibold">{pkg != null ? pkg : "—"}</TableCell>
                        <TableCell className="font-semibold text-green-700 dark:text-green-500">
                          {r.is_missing ? "—" : calcKgConsiderateRotunjit(r)}
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
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                            disabled={r.is_missing}
                            onClick={() => setDetailsDialog({ groupIdx: gIdx, rowIdx: rIdx })}>
                            <Layers className="h-3 w-3 mr-1" />
                            {(() => {
                              const { bd } = parsePalDoc(r.paleti_lazi_document || "");
                              const n = bd.rec_pallets.length + bd.rec_crates.length + bd.doc_pallets.length + bd.doc_crates.length;
                              return n > 0 ? n : "+";
                            })()}
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
                    <TableCell className="text-[10px] leading-tight">
                      {totals.ladiDocByType.size > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {Array.from(totals.ladiDocByType.entries()).map(([tip, cnt]) => (
                            <span key={tip}>{tip}: <strong>{cnt}</strong></span>
                          ))}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="bg-amber-50/50 dark:bg-amber-950/10 text-sm">
                      {totals.totalCantDoc > 0 ? totals.totalCantDoc.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell colSpan={3} className="text-right">Paleți rec:</TableCell>
                    <TableCell className="text-base">{totals.totalPaleti}</TableCell>
                    <TableCell colSpan={11}>
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
              </div>
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

      {/* Detalii multi-tip dialog */}
      <Dialog open={!!detailsDialog} onOpenChange={(o) => !o && setDetailsDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalii paleți & lăzi: {detailsDialog && groups[detailsDialog.groupIdx]?.rows[detailsDialog.rowIdx]?.denumire_produs}
            </DialogTitle>
          </DialogHeader>
          {detailsDialog && (() => {
            const row = groups[detailsDialog.groupIdx].rows[detailsDialog.rowIdx];
            const parsed = parsePalDoc(row.paleti_lazi_document || "");
            const bd: BreakdownPayload = {
              rec_pallets: parsed.bd.rec_pallets,
              rec_crates: parsed.bd.rec_crates,
              doc_pallets: parsed.bd.doc_pallets,
              doc_crates: parsed.bd.doc_crates,
            };
            // Fallback pentru date vechi (înainte de breakdown): folosește
            // câmpurile single-tip din înregistrare ca să pre-populeze recepția.
            if (bd.rec_pallets.length === 0 && (row.nr_paleti_rec || 0) > 0) {
              bd.rec_pallets = [{ id: null, name: row.tip_palet || "", count: Number(row.nr_paleti_rec) || 0 }];
            }
            if (bd.rec_crates.length === 0 && (row.nr_lazi || 0) > 0) {
              bd.rec_crates = [{ id: null, name: row.tip_lada_culoare || "", count: Number(row.nr_lazi) || 0 }];
            }
            const update = (next: BreakdownPayload) => {
              const encoded = encodePalDoc(next);
              updateRow(detailsDialog.groupIdx, detailsDialog.rowIdx, "paleti_lazi_document", encoded);
            };
            // Auto-rezolvă id pentru rândurile legacy cu doar name (caută în lista de tipuri).
            const resolveIds = (rows: BreakdownEntry[], types: LookupRow[]): BreakdownEntry[] =>
              rows.map((r) => {
                if (r.id) return r;
                const match = types.find(
                  (t) => t.name.trim().toLowerCase() === (r.name || "").trim().toLowerCase()
                );
                return match ? { ...r, id: match.id, name: match.name } : r;
              });
            bd.rec_pallets = resolveIds(bd.rec_pallets, palletTypesList);
            bd.rec_crates = resolveIds(bd.rec_crates, crateTypesList);
            bd.doc_pallets = resolveIds(bd.doc_pallets, palletTypesList);
            bd.doc_crates = resolveIds(bd.doc_crates, crateTypesList);

            const renderSection = (
              title: string,
              rows: BreakdownEntry[],
              opts: { key: keyof BreakdownPayload; types: LookupRow[] }
            ) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">{title}</h4>
                  <Button size="sm" variant="outline"
                    onClick={() => update({ ...bd, [opts.key]: [...rows, { id: null, name: "", count: 0 }] })}>
                    <Plus className="h-3 w-3 mr-1" /> Adaugă
                  </Button>
                </div>
                {rows.length === 0 && <p className="text-xs text-muted-foreground">Niciun rând.</p>}
                {rows.map((r2, i) => (
                  <div key={i} className="grid grid-cols-[1fr,90px,40px] gap-2 items-center">
                    <Select
                      value={r2.id || (r2.name ? `__name__${r2.name}` : "")}
                      onValueChange={(v) => {
                        const t = opts.types.find((x) => x.id === v);
                        const next = rows.map((rr, j) => j === i
                          ? { ...rr, id: t?.id || null, name: t?.name || "" }
                          : rr);
                        update({ ...bd, [opts.key]: next });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Tip" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        {opts.types.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" step="1" placeholder="Nr"
                      value={r2.count || ""}
                      onChange={(e) => {
                        const c = parseInt(e.target.value) || 0;
                        const next = rows.map((rr, j) => j === i ? { ...rr, count: c } : rr);
                        update({ ...bd, [opts.key]: next });
                      }}
                      className="h-9 text-xs" />
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0"
                      onClick={() => update({ ...bd, [opts.key]: rows.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            );
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 p-3 border rounded-md">
                  <h3 className="font-bold text-sm">Recepționat</h3>
                  {renderSection("Paleți", bd.rec_pallets, { key: "rec_pallets", types: palletTypesList })}
                  {renderSection("Lăzi", bd.rec_crates, { key: "rec_crates", types: crateTypesList })}
                </div>
                <div className="space-y-4 p-3 border rounded-md bg-amber-50/30 dark:bg-amber-950/10">
                  <h3 className="font-bold text-sm">Document</h3>
                  {renderSection("Paleți", bd.doc_pallets, { key: "doc_pallets", types: palletTypesList })}
                  {renderSection("Lăzi", bd.doc_crates, { key: "doc_crates", types: crateTypesList })}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => setDetailsDialog(null)}>Gata</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email furnizor dialog */}
      <Dialog open={!!emailDialog} onOpenChange={(o) => !o && setEmailDialog(null)}>
        <DialogContent className="w-screen h-[100dvh] max-w-none sm:w-[95vw] sm:max-w-3xl sm:h-auto sm:max-h-[95vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6 rounded-none sm:rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg pr-8 break-words">
              Email furnizor: {emailDialog && groups[emailDialog.groupIdx]?.supplierName}
            </DialogTitle>
          </DialogHeader>
          {emailDialog && (() => {
            const group = groups[emailDialog.groupIdx];
            const photos = allPhotosForGroup(group);
            const isV2 = emailVersion === "v2";
            const previewHeaders = isV2 ? emailHeadersV2(emailLang) : emailHeaders(emailLang);
            const previewRows = isV2 ? getEmailTableRowsV2(group, emailLang) : getEmailTableRows(group, emailLang);
            const bodyEn = isV2 ? emailShortBodyEn : emailBodyEn;
            const bodyRo = isV2 ? emailShortBodyRo : emailBodyRo;
            const bodyIt = isV2 ? emailShortBodyIt : emailBodyIt;
            return (
              <div className="space-y-4 min-w-0">
                <Tabs value={emailVersion} onValueChange={(v) => setEmailVersion(v as "v1" | "v2")}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="v1" className="text-xs sm:text-sm">V1 – Lung (detaliat)</TabsTrigger>
                    <TabsTrigger value="v2" className="text-xs sm:text-sm">V2 – Scurt (tabel)</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Tabs value={emailLang} onValueChange={(v) => setEmailLang(v as EmailLang)}>
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="en" className="text-xs sm:text-sm">🇬🇧 EN</TabsTrigger>
                    <TabsTrigger value="ro" className="text-xs sm:text-sm">🇷🇴 RO</TabsTrigger>
                    <TabsTrigger value="it" className="text-xs sm:text-sm">🇮🇹 IT</TabsTrigger>
                  </TabsList>
                  <TabsContent value="en" className="mt-3">
                    <Textarea rows={isV2 ? 8 : 14} value={bodyEn}
                      onChange={(e) => syncEmailTranslations("en", e.target.value)}
                      className="font-mono text-xs w-full" />
                  </TabsContent>
                  <TabsContent value="ro" className="mt-3">
                    <Textarea rows={isV2 ? 8 : 14} value={bodyRo}
                      onChange={(e) => syncEmailTranslations("ro", e.target.value)}
                      className="font-mono text-xs w-full" />
                  </TabsContent>
                  <TabsContent value="it" className="mt-3">
                    <Textarea rows={isV2 ? 8 : 14} value={bodyIt}
                      onChange={(e) => syncEmailTranslations("it", e.target.value)}
                      className="font-mono text-xs w-full" />
                  </TabsContent>
                </Tabs>

                {emailTranslating && <p className="text-xs text-muted-foreground">Se actualizează traducerile...</p>}

                <div className="space-y-2">
                  <p className="text-sm font-medium">{isV2 ? "Raport calitativ (tabel scurt)" : "Tabel recepție formatat"}</p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-muted">
                        <tr>{previewHeaders.map((h) => <th key={h} className="border px-2 py-2 text-left font-semibold whitespace-pre-line">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {previewRows.map((r: any, i) => (
                          <tr key={i}>
                            {(isV2
                              ? [r.date, r.supplier, r.document, r.product, r.producer, r.docQty, r.recvQty, r.diff, r.defects, r.credit]
                              : [r.product, r.producer, r.document, r.received, r.difference, r.loss, r.credit, r.defects, r.photos]
                            ).map((v, j) => (
                              <td key={j} className="border px-2 py-2 align-top">{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>


                {photos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Poze atașate ({photos.length}) — link-urile sunt incluse automat în textul email-ului
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-[200px] overflow-y-auto p-2 border rounded">
                      {photos.map((p, i) => {
                        const url = getReceptionPhotoUrl(p.photo);
                        return (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                            <img src={url} alt={p.row.denumire_produs}
                              className="w-full h-20 object-cover rounded border" />
                            <p className="text-[10px] mt-1 truncate" title={p.row.denumire_produs}>
                              {p.row.denumire_produs}
                            </p>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={copyEmailToClipboard} className="w-full sm:w-auto">
              {emailCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {emailCopied ? "Copiat!" : "Copiază emailul formatat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceptionReport;
