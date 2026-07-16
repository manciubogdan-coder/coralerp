import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, FileSpreadsheet, Plus, Trash2, Copy } from "lucide-react";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excelExport";
import { toast } from "@/hooks/use-custom-toast";
import { useInventoryType } from "@/context/inventory-type";
import { persistDateKey, readStoredDateKey, todayKey } from "@/lib/persistentDate";
import { usePersistentState } from "@/hooks/use-persistent-state";

type Row = {
  id: string;
  inventory_type: string;
  data: string;
  lot: string | null;
  produs: string | null;
  cantitate_intrata: number | null;
  furnizor: string | null;
  kg_solicitat: number | null;
  procent_cn_solicitata: number | null;
  cantitate_ramasa: number | null;
  data_productie: string | null;
  schimb: string | null;
  mp_intrata_in_prod: number | null;
  mp_utilizata_vanduta: number | null;
  pierdere_totala: number | null;
  rebut: number | null;
  retur_repozit: number | null;
  procent_nc: number | null;
  pierdere_tehnologica: number | null;
  procent_cantar: number | null;
  bucati_15g: number | null;
  bucati_30g: number | null;
  bucati_70g: number | null;
  bucati_100g: number | null;
  bucati_250g: number | null;
  bucati_500g: number | null;
  kg_final: number | null;
  nr_pers: number | null;
  ora_start: string | null;
  ora_stop: string | null;
  pauza_min: number | null;
  observatii: string | null;
  retur: string | null;
  producator: string | null;
  sort_order: number | null;
};

const numFields = new Set([
  "cantitate_intrata","kg_solicitat","procent_cn_solicitata","cantitate_ramasa",
  "mp_intrata_in_prod","mp_utilizata_vanduta","pierdere_totala","rebut","retur_repozit",
  "procent_nc","pierdere_tehnologica","procent_cantar","bucati_15g","bucati_30g",
  "bucati_70g","bucati_100g","bucati_250g","bucati_500g","kg_final","nr_pers","pauza_min",
]);

// column definition: [key, label, width, type]
const COLS: Array<{ key: keyof Row; label: string; w: string; type: "date" | "num" | "text" | "time" | "int"; readonly?: boolean }> = [
  { key: "data", label: "Data recepție", w: "min-w-[140px]", type: "date", readonly: true },
  { key: "lot", label: "Lot", w: "min-w-[120px]", type: "text" },
  { key: "produs", label: "Produs", w: "min-w-[200px]", type: "text" },
  { key: "cantitate_intrata", label: "Cant. intrată (kg)", w: "min-w-[140px]", type: "num" },
  { key: "furnizor", label: "Furnizor", w: "min-w-[200px]", type: "text" },
  { key: "producator", label: "Producător", w: "min-w-[200px]", type: "text" },
  { key: "procent_cn_solicitata", label: "% CN solicitată", w: "min-w-[130px]", type: "num", readonly: true },
  { key: "kg_solicitat", label: "Kg solicitat", w: "min-w-[130px]", type: "num", readonly: true },
  { key: "cantitate_ramasa", label: "Cant. rămasă în depozit", w: "min-w-[160px]", type: "num", readonly: true },
  { key: "data_productie", label: "Data producție", w: "min-w-[160px]", type: "date" },
  { key: "schimb", label: "Schimb", w: "min-w-[110px]", type: "text" },
  { key: "mp_intrata_in_prod", label: "MP intrată în prod", w: "min-w-[140px]", type: "num" },
  { key: "mp_utilizata_vanduta", label: "MP utilizată/vândută", w: "min-w-[140px]", type: "num" },
  { key: "pierdere_totala", label: "Pierdere totală", w: "min-w-[130px]", type: "num" },
  { key: "rebut", label: "Rebut", w: "min-w-[110px]", type: "num" },
  { key: "retur_repozit", label: "Retur repoziț.", w: "min-w-[120px]", type: "num" },
  { key: "procent_nc", label: "% NC", w: "min-w-[100px]", type: "num" },
  { key: "pierdere_tehnologica", label: "Pierd. tehno (kg)", w: "min-w-[130px]", type: "num" },
  { key: "procent_cantar", label: "% Cântar", w: "min-w-[100px]", type: "num" },
  { key: "bucati_15g", label: "Buc 15g", w: "min-w-[110px]", type: "int" },
  { key: "bucati_30g", label: "Buc 30g", w: "min-w-[110px]", type: "int" },
  { key: "bucati_70g", label: "Buc 70g", w: "min-w-[110px]", type: "int" },
  { key: "bucati_100g", label: "Buc 100g", w: "min-w-[110px]", type: "int" },
  { key: "bucati_250g", label: "Buc 250g", w: "min-w-[110px]", type: "int" },
  { key: "bucati_500g", label: "Buc 500g", w: "min-w-[110px]", type: "int" },
  { key: "kg_final", label: "Kg final", w: "min-w-[120px]", type: "num" },
  { key: "nr_pers", label: "Nr. pers", w: "min-w-[100px]", type: "int" },
  { key: "ora_start", label: "Ora start", w: "min-w-[120px]", type: "time" },
  { key: "ora_stop", label: "Ora stop", w: "min-w-[120px]", type: "time" },
  { key: "pauza_min", label: "Pauza (min)", w: "min-w-[110px]", type: "int" },
  { key: "observatii", label: "Observații", w: "min-w-[280px]", type: "text" },
  { key: "retur", label: "Retur", w: "min-w-[160px]", type: "text" },
];

// derive computed values (client-side, non-persistent unless user edits)
const computeDerived = (r: Row): Partial<Row> => {
  const kgFinalCalc =
    ((r.bucati_15g || 0) * 15 +
      (r.bucati_30g || 0) * 30 +
      (r.bucati_70g || 0) * 70 +
      (r.bucati_100g || 0) * 100 +
      (r.bucati_250g || 0) * 250 +
      (r.bucati_500g || 0) * 500) / 1000;

  const mpIn = r.mp_intrata_in_prod || 0;
  const mpOut = r.mp_utilizata_vanduta || 0;
  const pierdereTotal = mpIn && mpOut ? +(mpIn - mpOut).toFixed(2) : r.pierdere_totala;
  const rebut = r.rebut || 0;
  const returRep = r.retur_repozit || 0;
  const pierdTeh = pierdereTotal !== null && pierdereTotal !== undefined
    ? +(pierdereTotal - rebut - returRep).toFixed(2)
    : null;
  const procNC = mpIn > 0 ? +((rebut / mpIn) * 100).toFixed(2) : null;

  return {
    kg_final: kgFinalCalc > 0 ? +kgFinalCalc.toFixed(2) : r.kg_final,
    pierdere_totala: pierdereTotal ?? null,
    pierdere_tehnologica: pierdTeh ?? r.pierdere_tehnologica,
    procent_nc: procNC ?? r.procent_nc,
  };
};

export const EvidentaAndrada: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const [rows, setRows] = useState<Row[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = usePersistentState(`evidenta-andrada.search.${inventoryType}`, "");
  const [producatorFilter, setProducatorFilter] = usePersistentState(`evidenta-andrada.producator.${inventoryType}`, "");
  const [viewMode, setViewMode] = usePersistentState<"detaliat" | "centralizat">(`evidenta-andrada.viewmode.${inventoryType}`, "detaliat");

  const dateKey = `evidenta-andrada.filter-date.${inventoryType}`;
  const [filterDate, setFilterDateState] = useState<string>(() =>
    readStoredDateKey(dateKey, "") // empty = show all; filters on data_productie
  );
  const setFilterDate = (v: string) => { setFilterDateState(v); persistDateKey(dateKey, v); };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    // Fetch ALL rows for inventory_type (needed for centralized view + lot lookups)
    const { data: allData, error: allErr } = await supabaseCloud
      .from("evidenta_andrada_rows")
      .select("*")
      .eq("inventory_type", inventoryType)
      .order("data_productie", { ascending: true, nullsFirst: true })
      .order("data", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (allErr) toast({ title: "Eroare", description: allErr.message, variant: "destructive" });
    const all = (allData as any) || [];
    setAllRows(all);
    // Apply date filter for detailed view
    const filtered = filterDate
      ? all.filter((r: Row) => (r.data_productie === filterDate) || (!r.data_productie && r.data === filterDate))
      : all;
    setRows(filtered);
    setLoading(false);
  }, [inventoryType, filterDate]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Lookup: `${product}||${lot}` -> { pct, kg, remaining, receiptDate }
  // Keyed by product+lot because the same lot_number is reused across many products.
  const [lotInfo, setLotInfo] = useState<Record<string, { pct: number | null; kg: number | null; remaining: number | null; receiptDate: string | null }>>({});
  const lotKey = (product: string | null | undefined, lot: string | null | undefined) => `${(product ?? "").trim()}||${(lot ?? "").trim()}`;
  useEffect(() => {
    const src = viewMode === "centralizat" ? allRows : rows;
    const lots = Array.from(new Set(src.map((r) => r.lot).filter(Boolean))) as string[];
    if (lots.length === 0) { setLotInfo({}); return; }
    (async () => {
      const info: Record<string, { pct: number | null; kg: number | null; remaining: number | null; receiptDate: string | null }> = {};
      // 1) inventory rows (lot -> id, name, quantity) — key by product+lot
      const { data: inv } = await (supabase as any)
        .from("inventory")
        .select("id, name, lot_number, quantity")
        .in("lot_number", lots);
      const invRows = (inv || []) as any[];
      const invIdToKey: Record<string, string> = {};
      invRows.forEach((r: any) => {
        const key = lotKey(r.name, r.lot_number);
        invIdToKey[r.id] = key;
        if (!info[key]) info[key] = { pct: null, kg: null, remaining: 0, receiptDate: null };
        info[key].remaining = (info[key].remaining || 0) + Number(r.quantity || 0);
      });

      // 2) reception_report_data by inventory_id (batched)
      const invIds = Object.keys(invIdToKey);
      for (let i = 0; i < invIds.length; i += 50) {
        const slice = invIds.slice(i, i + 50);
        const { data: rec } = await (supabase as any)
          .from("reception_report_data")
          .select("inventory_id, pierdere_calitativa_procent, cantitate_receptionata, cantitate_document, declared_quantity")
          .in("inventory_id", slice);
        (rec || []).forEach((r: any) => {
          const key = invIdToKey[r.inventory_id];
          if (!key) return;
          const pct = r.pierdere_calitativa_procent != null ? Number(r.pierdere_calitativa_procent) : null;
          const declared = Number(r.declared_quantity || 0);
          const rec_q = Number(r.cantitate_receptionata || 0);
          const doc_q = Number(r.cantitate_document || 0);
          const effective = rec_q - Math.max(0, (rec_q - doc_q) - declared);
          const underTol = rec_q < doc_q;
          const base = underTol ? doc_q : effective;
          const kg = pct != null ? +((base * pct) / 100).toFixed(2) : null;
          if (!info[key]) info[key] = { pct: null, kg: null, remaining: null, receiptDate: null };
          info[key].pct = info[key].pct ?? pct;
          info[key].kg = (info[key].kg || 0) + (kg || 0);
        });
      }

      // 3) receipt_date from reception_records by lot_number (per inventory type)
      //    Attach to every product-keyed entry that shares this lot.
      const recTable = inventoryType === "etichete"
        ? "etichete_reception_records"
        : inventoryType === "ambalaje"
          ? "ambalaje_reception_records"
          : "reception_records";
      const dateByLot: Record<string, string> = {};
      for (let i = 0; i < lots.length; i += 50) {
        const slice = lots.slice(i, i + 50);
        const { data: rr } = await (supabase as any)
          .from(recTable)
          .select("lot_number, receipt_date")
          .in("lot_number", slice)
          .not("receipt_date", "is", null)
          .order("receipt_date", { ascending: false });
        (rr || []).forEach((row: any) => {
          if (!row.lot_number) return;
          if (!dateByLot[row.lot_number]) {
            dateByLot[row.lot_number] = String(row.receipt_date).split("T")[0];
          }
        });
      }
      Object.keys(info).forEach((k) => {
        const lotPart = k.split("||")[1] || "";
        if (!info[k].receiptDate && dateByLot[lotPart]) info[k].receiptDate = dateByLot[lotPart];
      });
      setLotInfo(info);
    })();
  }, [rows, allRows, viewMode, inventoryType]);

  const derivedFromLot = (r: Row) => {
    const info = lotInfo[lotKey(r.produs, r.lot)];
    const pct = info?.pct ?? null;
    const kg = info?.kg ?? null;
    const remaining = info?.remaining ?? null;
    const receiptDate = info?.receiptDate ?? null;
    return { pt: pct, kgSolicitat: kg, remaining: remaining != null ? +remaining.toFixed(2) : null, receiptDate };
  };


  const addRow = async (copyFrom?: Row) => {
    const base: any = copyFrom
      ? { ...copyFrom }
      : { data: todayKey(), data_productie: filterDate || null, inventory_type: inventoryType };
    delete base.id;
    delete base.created_at;
    delete base.updated_at;
    const { data, error } = await supabaseCloud
      .from("evidenta_andrada_rows")
      .insert({ inventory_type: inventoryType, ...base })
      .select()
      .single();
    if (error) { toast({ title: "Eroare", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => [...prev, data as any]);
  };

  const deleteRow = async (id: string) => {
    if (!confirm("Ștergi acest rând?")) return;
    const { error } = await supabaseCloud.from("evidenta_andrada_rows").delete().eq("id", id);
    if (error) { toast({ title: "Eroare", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // debounced-ish save on blur
  const saveField = async (id: string, field: keyof Row, value: any) => {
    const patch: any = { [field]: value };
    const { error } = await supabaseCloud
      .from("evidenta_andrada_rows")
      .update(patch)
      .eq("id", id);
    if (error) toast({ title: "Eroare la salvare", description: error.message, variant: "destructive" });
  };

  const updateLocal = (id: string, field: keyof Row, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const commitDerived = async (r: Row) => {
    const d = computeDerived(r);
    const patch: any = {};
    (Object.keys(d) as (keyof Row)[]).forEach((k) => {
      if (d[k] !== r[k] && d[k] !== null && d[k] !== undefined) patch[k] = d[k];
    });
    if (Object.keys(patch).length === 0) return;
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    await supabaseCloud.from("evidenta_andrada_rows").update(patch).eq("id", r.id);
  };

  const producatoriList = useMemo(
    () => Array.from(new Set((viewMode === "centralizat" ? allRows : rows).map((r) => r.producator).filter(Boolean))) as string[],
    [rows, allRows, viewMode]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (producatorFilter && r.producator !== producatorFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [r.lot, r.produs, r.furnizor, r.producator, r.observatii].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, producatorFilter, search]);

  // Centralized aggregation: group by lot + produs + producator + furnizor
  const NUM_AGG_KEYS: (keyof Row)[] = [
    "cantitate_intrata","mp_intrata_in_prod","mp_utilizata_vanduta","pierdere_totala",
    "rebut","retur_repozit","pierdere_tehnologica",
    "bucati_15g","bucati_30g","bucati_70g","bucati_100g","bucati_250g","bucati_500g","kg_final",
  ];
  type Agg = {
    key: string;
    lot: string | null; produs: string | null; producator: string | null; furnizor: string | null;
    count: number;
    firstDate: string | null; lastDate: string | null;
    pct: number | null; kgSolicitat: number | null; remaining: number | null; receiptDate: string | null;
    procent_cantar_sum: number; procent_cantar_n: number;
    sums: Record<string, number>;
  };
  const centralized = useMemo<Agg[]>(() => {
    const src = allRows.filter((r) => {
      if (producatorFilter && r.producator !== producatorFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [r.lot, r.produs, r.furnizor, r.producator, r.observatii].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const map = new Map<string, Agg>();
    for (const r of src) {
      const key = `${r.produs ?? ""}||${r.lot ?? ""}||${r.producator ?? ""}||${r.furnizor ?? ""}`;
      let a = map.get(key);
      if (!a) {
        const info = lotInfo[lotKey(r.produs, r.lot)];
        a = {
          key,
          lot: r.lot, produs: r.produs, producator: r.producator, furnizor: r.furnizor,
          count: 0, firstDate: null, lastDate: null,
          pct: info?.pct ?? null, kgSolicitat: info?.kg ?? null,
          remaining: info?.remaining != null ? +info.remaining.toFixed(2) : null,
          receiptDate: info?.receiptDate ?? null,
          procent_cantar_sum: 0, procent_cantar_n: 0,
          sums: {},
        };
        NUM_AGG_KEYS.forEach((k) => (a!.sums[k as string] = 0));
        map.set(key, a);
      }
      a.count += 1;
      const dp = r.data_productie || r.data;
      if (dp) {
        if (!a.firstDate || dp < a.firstDate) a.firstDate = dp;
        if (!a.lastDate || dp > a.lastDate) a.lastDate = dp;
      }
      NUM_AGG_KEYS.forEach((k) => {
        const v = (r as any)[k];
        if (v != null && !isNaN(Number(v))) a!.sums[k as string] += Number(v);
      });
      if (r.procent_cantar != null && !isNaN(Number(r.procent_cantar))) {
        a.procent_cantar_sum += Number(r.procent_cantar);
        a.procent_cantar_n += 1;
      }
    }
    // compute %NC = rebut / mp_intrata_in_prod * 100 at aggregate level
    return Array.from(map.values()).sort((x, y) => {
      const a = `${x.produs ?? ""} ${x.lot ?? ""}`;
      const b = `${y.produs ?? ""} ${y.lot ?? ""}`;
      return a.localeCompare(b);
    });
  }, [allRows, lotInfo, producatorFilter, search]);


  const handleExport = () => {
    if (!filtered.length) { toast({ title: "Nu există date" }); return; }
    const data = filtered.map((r) => {
      const d = derivedFromLot(r);
      const out: any = {};
      COLS.forEach((c) => {
        if (c.key === "procent_cn_solicitata") out[c.label] = d.pt ?? "";
        else if (c.key === "kg_solicitat") out[c.label] = d.kgSolicitat ?? "";
        else if (c.key === "cantitate_ramasa") out[c.label] = d.remaining ?? "";
        else if (c.key === "data") out[c.label] = d.receiptDate ?? r.data ?? "";
        else out[c.label] = (r as any)[c.key] ?? "";
      });
      return out;
    });
    exportToExcel(data, `Evidenta_Andrada_${inventoryType}_${filterDate || "toate"}.xlsx`);
  };

  const renderCell = (r: Row, c: typeof COLS[number]) => {
    // Auto-derived read-only cells based on lot + cantitate_intrata
    if (c.readonly) {
      const d = derivedFromLot(r);
      let display: string | number = "";
      if (c.key === "procent_cn_solicitata") display = d.pt != null ? `${d.pt}%` : "—";
      else if (c.key === "kg_solicitat") display = d.kgSolicitat != null ? d.kgSolicitat.toFixed(2) : "—";
      else if (c.key === "cantitate_ramasa") display = d.remaining != null ? d.remaining.toFixed(2) : "—";
      else if (c.key === "data") {
        const d2 = d.receiptDate || r.data;
        if (d2) {
          const [y, m, day] = String(d2).split("-");
          display = day && m && y ? `${day}.${m}.${y}` : d2;
        } else display = "—";
      }
      const align = c.key === "data" ? "justify-start" : "justify-end";
      return (
        <div className={`h-8 px-2 flex items-center ${align} text-sm bg-muted/40 rounded font-medium`}>
          {display}
        </div>
      );
    }
    const val = (r as any)[c.key];
    if (c.type === "int") {
      return (
        <Input
          type="number"
          step="1"
          min="0"
          value={val ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") { updateLocal(r.id, c.key, null); return; }
            const n = parseInt(raw, 10);
            updateLocal(r.id, c.key, isNaN(n) ? null : n);
          }}
          onBlur={async (e) => {
            const raw = e.target.value;
            const v = raw === "" ? null : (isNaN(parseInt(raw, 10)) ? null : parseInt(raw, 10));
            await saveField(r.id, c.key, v);
            if (["bucati_15g","bucati_30g","bucati_70g","bucati_100g","bucati_250g","bucati_500g"].includes(c.key as string)) {
              await commitDerived({ ...r, [c.key]: v } as Row);
            }
          }}
          className="h-8 text-right px-2"
        />
      );
    }
    if (c.type === "num") {
      return (
        <Input
          type="number"
          step="0.01"
          value={val ?? ""}
          onChange={(e) => updateLocal(r.id, c.key, e.target.value === "" ? null : parseFloat(e.target.value))}
          onBlur={async (e) => {
            const v = e.target.value === "" ? null : parseFloat(e.target.value);
            await saveField(r.id, c.key, v);
            if (["mp_intrata_in_prod","mp_utilizata_vanduta","rebut","retur_repozit"].includes(c.key as string)) {
              const updated = { ...r, [c.key]: v };
              await commitDerived(updated as Row);
            }
          }}
          className="h-8 text-right px-2"
        />
      );
    }

    if (c.type === "date") {
      return (
        <Input
          type="date"
          value={val ?? ""}
          onChange={(e) => updateLocal(r.id, c.key, e.target.value || null)}
          onBlur={(e) => saveField(r.id, c.key, e.target.value || null)}
          className="h-8 px-2"
        />
      );
    }
    if (c.type === "time") {
      return (
        <Input
          type="time"
          value={val ?? ""}
          onChange={(e) => updateLocal(r.id, c.key, e.target.value || null)}
          onBlur={(e) => saveField(r.id, c.key, e.target.value || null)}
          className="h-8 px-2"
        />
      );
    }
    return (
      <Input
        type="text"
        value={val ?? ""}
        onChange={(e) => updateLocal(r.id, c.key, e.target.value)}
        onBlur={(e) => saveField(r.id, c.key, e.target.value || null)}
        className="h-8 px-2"
      />
    );
  };

  if (inventoryType === "ambalaje") {
    return <div className="p-8 text-center text-muted-foreground">Evidența Andrada nu este disponibilă pentru ambalaje.</div>;
  }

  // Centralized export
  const handleExportCentralized = () => {
    if (!centralized.length) { toast({ title: "Nu există date" }); return; }
    const data = centralized.map((a) => {
      const mpIn = a.sums["mp_intrata_in_prod"] || 0;
      const procNC = mpIn > 0 ? +((a.sums["rebut"] / mpIn) * 100).toFixed(2) : null;
      return {
        "Produs": a.produs ?? "",
        "Lot": a.lot ?? "",
        "Producător": a.producator ?? "",
        "Furnizor": a.furnizor ?? "",
        "Data recepție": a.receiptDate ?? "",
        "Prima zi prod.": a.firstDate ?? "",
        "Ultima zi prod.": a.lastDate ?? "",
        "Status lot": a.remaining != null && a.remaining <= 0.01 ? "Terminat" : (a.count > 0 ? "În lucru" : "Neînceput"),
        "Data terminării lotului": (a.remaining != null && a.remaining <= 0.01) ? (a.lastDate ?? "") : "",
        "Nr. zile / rânduri": a.count,
        "Cant. intrată (kg)": +a.sums["cantitate_intrata"].toFixed(2),
        "% CN solicitată": a.pct ?? "",
        "Kg solicitat (pierd. prevăzută)": a.kgSolicitat ?? "",
        "Cant. rămasă în depozit": a.remaining ?? "",
        "MP intrată în prod. (Σ)": +a.sums["mp_intrata_in_prod"].toFixed(2),
        "MP utilizată/vândută (Σ)": +a.sums["mp_utilizata_vanduta"].toFixed(2),
        "Pierdere totală (Σ)": +a.sums["pierdere_totala"].toFixed(2),
        "Rebut (Σ)": +a.sums["rebut"].toFixed(2),
        "Retur repoziț. (Σ)": +a.sums["retur_repozit"].toFixed(2),
        "% NC realizat": procNC ?? "",
        "Pierd. tehno realizată (kg)": +a.sums["pierdere_tehnologica"].toFixed(2),
        "% Cântar mediu": a.procent_cantar_n ? +(a.procent_cantar_sum / a.procent_cantar_n).toFixed(2) : "",
        "Buc 15g (Σ)": a.sums["bucati_15g"],
        "Buc 30g (Σ)": a.sums["bucati_30g"],
        "Buc 70g (Σ)": a.sums["bucati_70g"],
        "Buc 100g (Σ)": a.sums["bucati_100g"],
        "Buc 250g (Σ)": a.sums["bucati_250g"],
        "Buc 500g (Σ)": a.sums["bucati_500g"],
        "Kg final (Σ)": +a.sums["kg_final"].toFixed(2),
      };
    });
    exportToExcel(data, `Evidenta_Andrada_Centralizat_${inventoryType}.xlsx`);
  };

  if ((inventoryType as string) === "ambalaje") {
    return <div className="p-8 text-center text-muted-foreground">Evidența Andrada nu este disponibilă pentru ambalaje.</div>;
  }

  const fmt = (n: number, dec = 2) => (n === 0 ? "—" : n.toFixed(dec));
  const fmtInt = (n: number) => (n === 0 ? "—" : String(n));
  const fmtDate = (s: string | null) => {
    if (!s) return "—";
    const [y, m, d] = s.split("-");
    return d && m && y ? `${d}.${m}.${y}` : s;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-md border overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("detaliat")}
            className={`px-3 py-2 text-sm ${viewMode === "detaliat" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            Detaliat
          </button>
          <button
            type="button"
            onClick={() => setViewMode("centralizat")}
            className={`px-3 py-2 text-sm border-l ${viewMode === "centralizat" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            Centralizat
          </button>
        </div>
        {viewMode === "detaliat" && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            />
            {filterDate && (
              <Button size="sm" variant="ghost" onClick={() => setFilterDate("")}>
                Toate
              </Button>
            )}
          </div>
        )}
        <select
          value={producatorFilter}
          onChange={(e) => setProducatorFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">Toți producătorii</option>
          {producatoriList.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <Input
          placeholder="Caută (lot, produs, furnizor, obs)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        {viewMode === "detaliat" && (
          <Button size="sm" onClick={() => addRow()}>
            <Plus className="h-4 w-4 mr-1" /> Rând nou
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={viewMode === "centralizat" ? handleExportCentralized : handleExport}
        >
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel
        </Button>
        <div className="text-xs text-muted-foreground ml-auto">
          {viewMode === "centralizat"
            ? "Totaluri pe Produs + Lot + Producător + Furnizor (ignoră filtrul de dată)."
            : "Se salvează automat. Formule: Pierd. totală = MP intr. − MP utiliz. • Pierd. tehno = Pierd. tot. − Rebut − Retur • %NC = Rebut ÷ MP intr. • Kg final = Σ(buc × g)"}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Se încarcă...</div>
      ) : viewMode === "centralizat" ? (
        <div className="border rounded-lg overflow-auto max-h-[75vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[180px]">Produs</TableHead>
                <TableHead className="min-w-[120px]">Lot</TableHead>
                <TableHead className="min-w-[160px]">Producător</TableHead>
                <TableHead className="min-w-[160px]">Furnizor</TableHead>
                <TableHead className="min-w-[110px]">Data recepție</TableHead>
                <TableHead className="min-w-[110px]">Prima zi</TableHead>
                <TableHead className="min-w-[110px]">Ultima zi</TableHead>
                <TableHead className="min-w-[120px]">Status lot</TableHead>
                <TableHead className="min-w-[120px]">Data terminării</TableHead>
                <TableHead className="min-w-[70px] text-right">Zile</TableHead>
                <TableHead className="min-w-[110px] text-right">Cant. intr.</TableHead>
                <TableHead className="min-w-[100px] text-right">% CN sol.</TableHead>
                <TableHead className="min-w-[110px] text-right">Kg solicit.</TableHead>
                <TableHead className="min-w-[110px] text-right">Rămas depozit</TableHead>
                <TableHead className="min-w-[120px] text-right bg-blue-50">MP intr. prod (Σ)</TableHead>
                <TableHead className="min-w-[120px] text-right bg-blue-50">MP utiliz. (Σ)</TableHead>
                <TableHead className="min-w-[110px] text-right bg-orange-50">Pierd. tot. (Σ)</TableHead>
                <TableHead className="min-w-[90px] text-right bg-red-50">Rebut (Σ)</TableHead>
                <TableHead className="min-w-[100px] text-right bg-orange-50">Retur (Σ)</TableHead>
                <TableHead className="min-w-[90px] text-right">% NC</TableHead>
                <TableHead className="min-w-[120px] text-right bg-orange-50">Pierd. tehno (Σ)</TableHead>
                <TableHead className="min-w-[100px] text-right">% Cântar med.</TableHead>
                <TableHead className="min-w-[80px] text-right">15g (Σ)</TableHead>
                <TableHead className="min-w-[80px] text-right">30g (Σ)</TableHead>
                <TableHead className="min-w-[80px] text-right">70g (Σ)</TableHead>
                <TableHead className="min-w-[80px] text-right">100g (Σ)</TableHead>
                <TableHead className="min-w-[80px] text-right">250g (Σ)</TableHead>
                <TableHead className="min-w-[80px] text-right">500g (Σ)</TableHead>
                <TableHead className="min-w-[100px] text-right bg-green-50">Kg final (Σ)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centralized.map((a) => {
                const mpIn = a.sums["mp_intrata_in_prod"] || 0;
                const procNC = mpIn > 0 ? +((a.sums["rebut"] / mpIn) * 100).toFixed(2) : null;
                const cantarMed = a.procent_cantar_n ? +(a.procent_cantar_sum / a.procent_cantar_n).toFixed(2) : null;
                return (
                  <TableRow key={a.key}>
                    <TableCell className="font-medium">{a.produs ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{a.lot ?? "—"}</TableCell>
                    <TableCell>{a.producator ?? "—"}</TableCell>
                    <TableCell>{a.furnizor ?? "—"}</TableCell>
                    <TableCell>{fmtDate(a.receiptDate)}</TableCell>
                    <TableCell>{fmtDate(a.firstDate)}</TableCell>
                    <TableCell>{fmtDate(a.lastDate)}</TableCell>
                    {(() => {
                      const done = a.remaining != null && a.remaining <= 0.01;
                      const started = a.count > 0;
                      return (
                        <>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${done ? "bg-red-100 text-red-700" : started ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                              {done ? "Terminat" : started ? "În lucru" : "Neînceput"}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{done ? fmtDate(a.lastDate) : "—"}</TableCell>
                        </>
                      );
                    })()}
                    <TableCell className="text-right">{a.count}</TableCell>
                    <TableCell className="text-right">{fmt(a.sums["cantitate_intrata"])}</TableCell>
                    <TableCell className="text-right">{a.pct != null ? `${a.pct}%` : "—"}</TableCell>
                    <TableCell className="text-right">{a.kgSolicitat != null ? a.kgSolicitat.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right">{a.remaining != null ? a.remaining.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right bg-blue-50/50 font-semibold">{fmt(a.sums["mp_intrata_in_prod"])}</TableCell>
                    <TableCell className="text-right bg-blue-50/50 font-semibold">{fmt(a.sums["mp_utilizata_vanduta"])}</TableCell>
                    <TableCell className="text-right bg-orange-50/50">{fmt(a.sums["pierdere_totala"])}</TableCell>
                    <TableCell className="text-right bg-red-50/50">{fmt(a.sums["rebut"])}</TableCell>
                    <TableCell className="text-right bg-orange-50/50">{fmt(a.sums["retur_repozit"])}</TableCell>
                    <TableCell className="text-right">{procNC != null ? `${procNC}%` : "—"}</TableCell>
                    <TableCell className="text-right bg-orange-50/50">{fmt(a.sums["pierdere_tehnologica"])}</TableCell>
                    <TableCell className="text-right">{cantarMed != null ? `${cantarMed}%` : "—"}</TableCell>
                    <TableCell className="text-right">{fmtInt(a.sums["bucati_15g"])}</TableCell>
                    <TableCell className="text-right">{fmtInt(a.sums["bucati_30g"])}</TableCell>
                    <TableCell className="text-right">{fmtInt(a.sums["bucati_70g"])}</TableCell>
                    <TableCell className="text-right">{fmtInt(a.sums["bucati_100g"])}</TableCell>
                    <TableCell className="text-right">{fmtInt(a.sums["bucati_250g"])}</TableCell>
                    <TableCell className="text-right">{fmtInt(a.sums["bucati_500g"])}</TableCell>
                    <TableCell className="text-right bg-green-50/50 font-semibold">{fmt(a.sums["kg_final"])}</TableCell>
                  </TableRow>
                );
              })}
              {centralized.length === 0 && (
                <TableRow>
                  <TableCell colSpan={29} className="text-center text-muted-foreground py-6">
                    Niciun rând.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[75vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-16">Acțiuni</TableHead>
                {COLS.map((c) => (
                  <TableHead key={c.key as string} className={c.w}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplică rând" onClick={() => addRow(r)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Șterge" onClick={() => deleteRow(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  {COLS.map((c) => (
                    <TableCell key={c.key as string} className="p-1">{renderCell(r, c)}</TableCell>
                  ))}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLS.length + 1} className="text-center text-muted-foreground py-6">
                    Niciun rând. Apasă „Rând nou" ca să începi.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default EvidentaAndrada;
