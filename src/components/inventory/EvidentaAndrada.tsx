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
const COLS: Array<{ key: keyof Row; label: string; w: string; type: "date" | "num" | "text" | "time" }> = [
  { key: "data", label: "Data", w: "w-28", type: "date" },
  { key: "lot", label: "Lot", w: "w-20", type: "text" },
  { key: "produs", label: "Produs", w: "w-28", type: "text" },
  { key: "cantitate_intrata", label: "Cant. intrată (kg)", w: "w-24", type: "num" },
  { key: "furnizor", label: "Furnizor", w: "w-28", type: "text" },
  { key: "producator", label: "Producător", w: "w-28", type: "text" },
  { key: "kg_solicitat", label: "Kg solicitat", w: "w-24", type: "num" },
  { key: "procent_cn_solicitata", label: "% CN solicitată", w: "w-24", type: "num" },
  { key: "cantitate_ramasa", label: "Cant. rămasă", w: "w-24", type: "num" },
  { key: "data_productie", label: "Data producție", w: "w-28", type: "date" },
  { key: "schimb", label: "Schimb", w: "w-24", type: "text" },
  { key: "mp_intrata_in_prod", label: "MP intrată în prod", w: "w-24", type: "num" },
  { key: "mp_utilizata_vanduta", label: "MP utilizată/vândută", w: "w-24", type: "num" },
  { key: "pierdere_totala", label: "Pierdere totală", w: "w-24", type: "num" },
  { key: "rebut", label: "Rebut", w: "w-20", type: "num" },
  { key: "retur_repozit", label: "Retur repoziț.", w: "w-20", type: "num" },
  { key: "procent_nc", label: "% NC", w: "w-20", type: "num" },
  { key: "pierdere_tehnologica", label: "Pierd. tehno (kg)", w: "w-24", type: "num" },
  { key: "procent_cantar", label: "% Cântar", w: "w-20", type: "num" },
  { key: "bucati_15g", label: "Buc 15g", w: "w-20", type: "num" },
  { key: "bucati_30g", label: "Buc 30g", w: "w-20", type: "num" },
  { key: "bucati_70g", label: "Buc 70g", w: "w-20", type: "num" },
  { key: "bucati_100g", label: "Buc 100g", w: "w-20", type: "num" },
  { key: "bucati_250g", label: "Buc 250g", w: "w-20", type: "num" },
  { key: "bucati_500g", label: "Buc 500g", w: "w-20", type: "num" },
  { key: "kg_final", label: "Kg final", w: "w-24", type: "num" },
  { key: "nr_pers", label: "Nr. pers", w: "w-16", type: "num" },
  { key: "ora_start", label: "Ora start", w: "w-24", type: "time" },
  { key: "ora_stop", label: "Ora stop", w: "w-24", type: "time" },
  { key: "pauza_min", label: "Pauza (min)", w: "w-20", type: "num" },
  { key: "observatii", label: "Observații", w: "w-40", type: "text" },
  { key: "retur", label: "Retur", w: "w-24", type: "text" },
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [producatorFilter, setProducatorFilter] = useState("");

  const dateKey = `evidenta-andrada.filter-date.${inventoryType}`;
  const [filterDate, setFilterDateState] = useState<string>(() =>
    readStoredDateKey(dateKey, "") // empty = show all
  );
  const setFilterDate = (v: string) => { setFilterDateState(v); persistDateKey(dateKey, v); };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    let q = supabaseCloud
      .from("evidenta_andrada_rows")
      .select("*")
      .eq("inventory_type", inventoryType)
      .order("data", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (filterDate) q = q.eq("data", filterDate);
    const { data, error } = await q;
    if (error) toast({ title: "Eroare", description: error.message, variant: "destructive" });
    setRows((data as any) || []);
    setLoading(false);
  }, [inventoryType, filterDate]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const addRow = async (copyFrom?: Row) => {
    const base: any = copyFrom
      ? { ...copyFrom }
      : { data: filterDate || todayKey(), inventory_type: inventoryType };
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
    () => Array.from(new Set(rows.map((r) => r.producator).filter(Boolean))) as string[],
    [rows]
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

  const handleExport = () => {
    if (!filtered.length) { toast({ title: "Nu există date" }); return; }
    const data = filtered.map((r) => {
      const out: any = {};
      COLS.forEach((c) => { out[c.label] = (r as any)[c.key] ?? ""; });
      return out;
    });
    exportToExcel(data, `Evidenta_Andrada_${inventoryType}_${filterDate || "toate"}.xlsx`);
  };

  const renderCell = (r: Row, c: typeof COLS[number]) => {
    const val = (r as any)[c.key];
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
            // recompute derived if this field affects it
            if (["mp_intrata_in_prod","mp_utilizata_vanduta","rebut","retur_repozit","bucati_15g","bucati_30g","bucati_70g","bucati_100g","bucati_250g","bucati_500g"].includes(c.key as string)) {
              const updated = { ...r, [c.key]: v };
              await commitDerived(updated as Row);
            }
          }}
          className="h-8 text-right px-1"
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
          className="h-8 px-1"
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
          className="h-8 px-1"
        />
      );
    }
    return (
      <Input
        type="text"
        value={val ?? ""}
        onChange={(e) => updateLocal(r.id, c.key, e.target.value)}
        onBlur={(e) => saveField(r.id, c.key, e.target.value || null)}
        className="h-8 px-1"
      />
    );
  };

  if (inventoryType === "ambalaje") {
    return <div className="p-8 text-center text-muted-foreground">Evidența Andrada nu este disponibilă pentru ambalaje.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
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
        <Button size="sm" onClick={() => addRow()}>
          <Plus className="h-4 w-4 mr-1" /> Rând nou
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel
        </Button>
        <div className="text-xs text-muted-foreground ml-auto">
          Se salvează automat. Formule: Pierdere totală = MP intrată − MP utilizată • Pierd. tehno = Pierd. totală − Rebut − Retur • %NC = Rebut ÷ MP intrată • Kg final = Σ(buc × g)
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Se încarcă...</div>
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
