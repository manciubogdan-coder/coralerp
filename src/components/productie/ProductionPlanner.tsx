import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useProductionLines } from "@/hooks/productie/useProductionData";
import { usePersistentState } from "@/hooks/use-persistent-state";
import PersonnelManagement, { PlannerPerson, statusLabel, usePlannerPersonnel, isAuxSlot, auxLabel } from "./PersonnelManagement";
import { AlertTriangle, ClipboardList, Clock, Download, Plus, Printer, Scissors, Trash2, Users, X } from "lucide-react";
import { useOrderCuts, useSetOrderCut, distributeCut } from "@/hooks/productie/useOrderCuts";
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

type Person = PlannerPerson;

const ProductionPlanner: React.FC = () => {
  const today = fmtDate(new Date());
  const qc = useQueryClient();
  const [startDate, setStartDate] = usePersistentState("planner-start", today);
  const [endDate, setEndDate] = usePersistentState("planner-end", today);
  const [excluded, setExcluded] = usePersistentState<string[]>("planner-excluded-clients", []);
  const [overrides, setOverrides] = usePersistentState<Record<string, LineOverride>>("planner-line-overrides", {});
  const [extras, setExtras] = usePersistentState<ExtraRow[]>("planner-extra-rows", []);
  const [shiftHours, setShiftHours] = usePersistentState<number>("planner-shift-hours", 8);
  // mutări valabile doar pentru ziua planificată: personId -> slot ("none" = scos de pe linie)
  const [dayAssign, setDayAssign] = usePersistentState<Record<string, string>>(`planner-day-assign-${startDate}`, {});
  const [saveAsDefault, setSaveAsDefault] = usePersistentState<boolean>("planner-save-default-line", false);
  const [showClients, setShowClients] = useState(true);
  const [showProducts, setShowProducts] = useState(false);
  const [prodCutDraft, setProdCutDraft] = useState<Record<string, string>>({});
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [clientDialog, setClientDialog] = useState<string | null>(null);
  const [clientCutDraft, setClientCutDraft] = useState<Record<string, string>>({});
  const [lineOrder, setLineOrder] = usePersistentState<Record<string, string[]>>(`planner-line-order-${startDate}`, {});
  const [dragProd, setDragProd] = useState<{ lineId: string; key: string } | null>(null);
  const [lineCutDraft, setLineCutDraft] = useState<Record<string, string>>({});

  const { data: people = [] } = usePlannerPersonnel();
  const { data: cuts } = useOrderCuts();
  const setCutMutation = useSetOrderCut();
  const cutOf = (id: string) => Number(cuts?.get(id)?.cantitate_taiata) || 0;
  const effQty = (o: any) => Math.max(0, (Number(o.cantitate) || 0) - cutOf(o.id));

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

  // Produse din perioadă (după filtrul de clienți) – pentru tăieri / excluderi parțiale
  const products = useMemo(() => {
    const map = new Map<string, { key: string; nume: string; orders: any[]; original: number; taiat: number; efectiv: number }>();
    for (const o of filteredOrders) {
      const key = o.produs_id || o.productie_produse?.nume || "—";
      const e = map.get(key) || { key, nume: o.productie_produse?.nume || "—", orders: [], original: 0, taiat: 0, efectiv: 0 };
      e.orders.push(o);
      e.original += Number(o.cantitate) || 0;
      e.taiat += cutOf(o.id);
      e.efectiv += effQty(o);
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => a.nume.localeCompare(b.nume, "ro"));
  }, [filteredOrders, cuts]);

  const applyCutOrders = async (nume: string, ords: any[], totalCut: number) => {
    const original = ords.reduce((s, o) => s + (Number(o.cantitate) || 0), 0);
    const dist = distributeCut(
      ords.map((o: any) => ({ id: o.id, cantitate: Number(o.cantitate) || 0 })),
      Math.max(0, Math.min(totalCut, original))
    );
    try {
      await setCutMutation.mutateAsync(
        ords.map((o: any) => ({
          comanda_id: o.id,
          cantitate_taiata: dist[o.id] || 0,
          produs_nume: nume,
        }))
      );
      toast.success(totalCut > 0 ? `Tăiat ${Math.round(totalCut)} buc din „${nume}”` : `Tăierea pentru „${nume}” a fost anulată`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const applyProductCut = async (prod: { nume: string; orders: any[]; original: number }, totalCut: number) => {
    await applyCutOrders(prod.nume, prod.orders, totalCut);
    setProdCutDraft((prev) => {
      const next = { ...prev };
      delete next[prod.orders[0]?.produs_id || prod.nume];
      return next;
    });
  };

  const totalTaiat = useMemo(() => products.reduce((s, p) => s + p.taiat, 0), [products]);


  // Cantitate necesară + produs principal per linie
  const perLine = useMemo(() => {
    const map = new Map<string, { total: number; produse: Map<string, number> }>();
    for (const o of filteredOrders) {
      if (!o.linie_id) continue;
      const e = map.get(o.linie_id) || { total: 0, produse: new Map<string, number>() };
      const qty = effQty(o);
      if (qty <= 0) continue;
      e.total += qty;
      const nume = o.productie_produse?.nume || "—";
      e.produse.set(nume, (e.produse.get(nume) || 0) + qty);
      map.set(o.linie_id, e);
    }
    return map;
  }, [filteredOrders, cuts]);

  // Produse per linie (pentru secvențiere + tăieri)
  const lineProducts = useMemo(() => {
    const map = new Map<string, Map<string, { key: string; nume: string; qty: number; original: number; taiat: number; orders: any[] }>>();
    for (const o of filteredOrders) {
      if (!o.linie_id) continue;
      const key = o.produs_id || o.productie_produse?.nume || "—";
      const inner = map.get(o.linie_id) || new Map();
      const e = inner.get(key) || { key, nume: o.productie_produse?.nume || "—", qty: 0, original: 0, taiat: 0, orders: [] };
      e.qty += effQty(o);
      e.original += Number(o.cantitate) || 0;
      e.taiat += cutOf(o.id);
      e.orders.push(o);
      inner.set(key, e);
      map.set(o.linie_id, inner);
    }
    const out = new Map<string, { key: string; nume: string; qty: number; original: number; taiat: number; orders: any[] }[]>();
    map.forEach((inner, lineId) => {
      const arr = Array.from(inner.values());
      const order = lineOrder[lineId] || [];
      arr.sort((a, b) => {
        const ia = order.indexOf(a.key);
        const ib = order.indexOf(b.key);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return b.qty - a.qty;
      });
      out.set(lineId, arr);
    });
    return out;
  }, [filteredOrders, cuts, lineOrder]);

  // Produse pentru clientul deschis în dialog
  const clientProducts = useMemo(() => {
    if (!clientDialog) return [] as { key: string; nume: string; qty: number; original: number; taiat: number; orders: any[] }[];
    const map = new Map<string, { key: string; nume: string; qty: number; original: number; taiat: number; orders: any[] }>();
    for (const o of orders as any[]) {
      if (`${o.magazin || "—"}||${o.punct_livrare || ""}` !== clientDialog) continue;
      const key = o.produs_id || o.productie_produse?.nume || "—";
      const e = map.get(key) || { key, nume: o.productie_produse?.nume || "—", qty: 0, original: 0, taiat: 0, orders: [] };
      e.qty += effQty(o);
      e.original += Number(o.cantitate) || 0;
      e.taiat += cutOf(o.id);
      e.orders.push(o);
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => a.nume.localeCompare(b.nume, "ro"));
  }, [clientDialog, orders, cuts]);



  const unassignedOrders = useMemo(
    () => filteredOrders.filter((o) => !o.linie_id),
    [filteredOrders]
  );

  const nealocate = useMemo(
    () => unassignedOrders.reduce((s, o) => s + effQty(o), 0),
    [unassignedOrders, cuts]
  );

  const setOverride = (lineId: string, patch: LineOverride) =>
    setOverrides((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));

  // ---- Oameni ----
  // slotul curent: override de zi, altfel linia implicită din nomenclatorul de personal
  const slotOf = (p: Person): string | null => {
    const ov = dayAssign[p.id];
    if (ov === "none") return null;
    if (ov) return ov;
    if (isAuxSlot(p.linie_id)) return `extra:${p.linie_id}`;
    return p.linie_id || null;
  };
  const activePeople = people.filter((p) => p.status === "activ");
  const unavailablePeople = people.filter((p) => p.status !== "activ");
  const peopleFor = (slot: string) => activePeople.filter((p) => slotOf(p) === slot);
  const unassignedPeople = activePeople.filter((p) => !slotOf(p));

  // Posturile neproductive folosite de personal apar automat ca rânduri auxiliare
  useEffect(() => {
    const needed = Array.from(
      new Set(activePeople.map((p) => p.linie_id).filter((v) => isAuxSlot(v)) as string[])
    );
    if (!needed.length) return;
    setExtras((prev) => {
      const missing = needed.filter((n) => !prev.some((e) => e.id === n));
      if (!missing.length) return prev;
      return [...prev, ...missing.map((n) => ({ id: n, nume: auxLabel(n) }))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people]);

  const assignPerson = async (id: string, slot: string | null) => {
    setDayAssign((prev) => ({ ...prev, [id]: slot ?? "none" }));
    if (saveAsDefault) {
      const isExtra = !!slot && slot.startsWith("extra:");
      const extraKey = isExtra ? slot!.slice("extra:".length) : null;
      const isAux = isAuxSlot(extraKey);
      const isLine = !!slot && !isExtra;
      await supabaseCloud
        .from("planner_personal")
        .update({
          linie_id: isLine ? slot : isAux ? extraKey : null,
          linie_nume: isLine
            ? (lines as any[]).find((l) => l.id === slot)?.nume || null
            : isAux
            ? auxLabel(extraKey!)
            : null,
        })
        .eq("id", id);
      qc.invalidateQueries({ queryKey: ["planner-personnel"] });
    }
  };

  const onDrop = (slot: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) assignPerson(id, slot);
    setDragId(null);
  };
  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  const rows = useMemo(() => {
    return lines.map((line) => {
      const ov = overrides[line.id] || {};
      const data = perLine.get(line.id);
      const autoCant = data?.total || 0;
      const cantitate = ov.cantitate != null ? ov.cantitate : autoCant;
      const norma = ov.norma != null ? ov.norma : Number(line.capacitate_ora) || 0;
      const assigned = peopleFor(line.id);
      const oameni = ov.oameni != null ? ov.oameni : assigned.length;
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
        assigned,
        overHours: shiftHours > 0 && ore > shiftHours,
        personal: ov.personal || "",
        startProdus: ov.startProdus || (topProdus ? `${topProdus[0]} – ${Math.round(topProdus[1]).toLocaleString()} buc` : ""),
      };
    });
  }, [lines, overrides, perLine, people, shiftHours, cuts]);

  const overLines = rows.filter((r) => r.overHours);

  const totals = useMemo(() => {
    const norma = rows.reduce((s, r) => s + (r.norma || 0), 0);
    const oameniLinii = rows.reduce((s, r) => s + (r.oameni || 0), 0);
    const cantitate = rows.reduce((s, r) => s + (r.cantitate || 0), 0);
    const oameniExtra = extras.reduce(
      (s, e) => s + (e.oameni != null && e.oameni > 0 ? e.oameni : peopleFor(`extra:${e.id}`).length),
      0
    );
    return { norma, oameniLinii, cantitate, oameniExtra, oameniTotal: oameniLinii + oameniExtra };
  }, [rows, extras, people]);

  const personalText = (slot: string, manual: string) => {
    const names = peopleFor(slot).map((p) => p.nume);
    return [names.join(", "), manual].filter(Boolean).join(" | ");
  };

  const addExtra = () =>
    setExtras((prev) => [...prev, { id: crypto.randomUUID(), nume: "", oameni: 0, personal: "" }]);
  const updateExtra = (id: string, patch: Partial<ExtraRow>) =>
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeExtra = (id: string) => {
    setExtras((prev) => prev.filter((e) => e.id !== id));
    setDayAssign((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === `extra:${id}`) next[k] = "none";
      });
      return next;
    });
  };

  const buildMatrix = () => {
    const header = ["Linie", "Norma/oră", "Oameni", "Cant. necesară", "Nr. ore necesar", "Personal", "Se începe producția cu produsul"];
    const body: any[][] = rows.map((r) => [
      r.line.nume + (r.overHours ? " (!)" : ""),
      r.norma || "",
      r.oameni || "",
      r.cantitate || "",
      r.norma > 0 && r.cantitate > 0 ? Number(r.ore.toFixed(2)) : "",
      personalText(r.line.id, r.personal),
      r.startProdus,
    ]);
    body.push(["TOTAL LINII", totals.norma, totals.oameniLinii, totals.cantitate, "", "", ""]);
    if (extras.length) {
      body.push([]);
      extras.forEach((e) =>
        body.push([
          e.nume,
          e.norma || "",
          e.oameni || peopleFor(`extra:${e.id}`).length || "",
          "",
          "",
          personalText(`extra:${e.id}`, e.personal || ""),
          "",
        ])
      );
      body.push(["TOTAL AUXILIAR", "", totals.oameniExtra, "", "", "", ""]);
    }
    body.push([]);
    body.push(["TOTAL OAMENI", "", totals.oameniTotal, "", "", "", ""]);
    return [
      [`Planificator producție ${fmtRo(startDate)} - ${fmtRo(endDate)}`],
      [`Clienți incluși: ${clients.filter((c) => isIncluded(c.key)).length}/${clients.length} | Program schimb: ${shiftHours}h`],
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

  const moveProduct = (lineId: string, keys: string[], from: number, to: number) => {
    if (from === to || to < 0 || to >= keys.length) return;
    const next = keys.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setLineOrder((prev) => ({ ...prev, [lineId]: next }));
  };


  const PersonChip: React.FC<{ p: Person }> = ({ p }) => (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", p.id);
        setDragId(p.id);
      }}
      title={p.post || undefined}
      className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2 py-0.5 text-xs cursor-grab active:cursor-grabbing"
    >
      {p.nume}
      {slotOf(p) && (
        <button type="button" onClick={() => assignPerson(p.id, null)}>
          <X className="h-3 w-3 opacity-60 hover:opacity-100" />
        </button>
      )}
    </span>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">Planificare</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-4 mt-4">
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
            <div>
              <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Program schimb (ore)</Label>
              <Input
                type="number"
                step="0.5"
                min="1"
                className="w-24"
                value={shiftHours || ""}
                onChange={(e) => setShiftHours(Number(e.target.value) || 0)}
              />
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" /> Total oameni: {totals.oameniTotal}
            </Badge>
            {overLines.length > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {overLines.length} linii peste {shiftHours}h
              </Badge>
            )}
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

          <div className="border rounded-md">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
              onClick={() => setShowProducts((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <Scissors className="h-4 w-4" /> Produse în perioadă: {products.length}
                {totalTaiat > 0 && (
                  <Badge variant="destructive">-{Math.round(totalTaiat).toLocaleString()} buc tăiate</Badge>
                )}
              </span>
              <span className="text-muted-foreground text-xs">{showProducts ? "ascunde" : "arată"}</span>
            </button>
            {showProducts && (
              <div className="px-3 pb-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Taie complet sau parțial cantitatea unui produs. Tăierea se salvează pe comenzi și se vede și în Consumuri.
                </p>
                <div className="max-h-72 overflow-y-auto divide-y">
                  {products.map((p) => {
                    const draftKey = p.orders[0]?.produs_id || p.nume;
                    const excluded = p.efectiv <= 0;
                    return (
                      <div key={p.key} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                        <span className={`flex-1 min-w-[180px] truncate ${excluded ? "line-through text-muted-foreground" : ""}`}>
                          {p.nume}
                        </span>
                        <span className="text-xs text-muted-foreground w-28 text-right">
                          {Math.round(p.efectiv).toLocaleString()}
                          {p.taiat > 0 && <span className="line-through ml-1">{Math.round(p.original).toLocaleString()}</span>}
                        </span>
                        <Input
                          type="number"
                          className="h-7 w-24 text-xs"
                          placeholder="taie..."
                          value={prodCutDraft[draftKey] ?? (p.taiat || "")}
                          onChange={(e) => setProdCutDraft((prev) => ({ ...prev, [draftKey]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => applyProductCut(p, Number(prodCutDraft[draftKey] ?? p.taiat) || 0)}
                        >
                          <Scissors className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => applyProductCut(p, p.original)}>
                          exclude tot
                        </Button>
                        {p.taiat > 0 && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => applyProductCut(p, 0)}>
                            anulează
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {products.length === 0 && (
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
                    <TableHead className="min-w-[240px]">Personal</TableHead>
                    <TableHead className="min-w-[200px]">Se începe cu produsul</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.line.id}
                      onDragOver={allowDrop}
                      onDrop={onDrop(r.line.id)}
                      className={r.overHours ? "bg-destructive/10" : undefined}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {r.overHours && <AlertTriangle className="h-4 w-4 text-destructive" />}
                          {r.line.nume}
                        </div>
                      </TableCell>
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
                      <TableCell className={`text-center text-sm ${r.overHours ? "text-destructive font-semibold" : ""}`}>
                        {formatOre(r.ore)}
                        {r.overHours && (
                          <div className="text-[10px]">+{formatOre(r.ore - shiftHours)} peste program</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {r.assigned.map((p) => (
                            <PersonChip key={p.id} p={p} />
                          ))}
                        </div>
                        <Input
                          className="h-8"
                          placeholder="Trage oameni aici sau scrie"
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
            <button
              type="button"
              onClick={() => setShowUnassigned(true)}
              className="text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              ⚠️ {Math.round(nealocate).toLocaleString()} buc din comenzi nu sunt alocate pe nicio linie ({unassignedOrders.length} comenzi) – click pentru detalii
            </button>
          )}
        </CardContent>
      </Card>

      {/* Oameni disponibili */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Oameni disponibili ({unassignedPeople.length} nealocați / {people.length} total)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={saveAsDefault} onCheckedChange={(v) => setSaveAsDefault(!!v)} />
            Salvează mutările ca linie implicită (altfel se aplică doar pentru {fmtRo(startDate)})
          </label>
          <div
            onDragOver={allowDrop}
            onDrop={onDrop(null)}
            className="min-h-[64px] rounded-md border border-dashed p-2 flex flex-wrap gap-1"
          >
            {unassignedPeople.map((p) => (
              <PersonChip key={p.id} p={p} />
            ))}
            {unassignedPeople.length === 0 && (
              <span className="text-xs text-muted-foreground">Toți oamenii activi sunt alocați. Trage aici ca să eliberezi pe cineva.</span>
            )}
          </div>
          {unavailablePeople.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1">Indisponibili ({unavailablePeople.length})</div>
              <div className="flex flex-wrap gap-1">
                {unavailablePeople.map((p) => (
                  <Badge key={p.id} variant="outline" className="text-[10px] font-normal">
                    {p.nume} – {statusLabel(p.status)}
                    {p.status_note ? ` (${p.status_note})` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Oamenii apar automat pe linia lor implicită (setată în sub-tab-ul Personal). Trage numele pe altă linie sau pe un post auxiliar pentru a-l muta; X îl scoate de pe linie.
          </p>
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
                  <TableRow key={e.id} onDragOver={allowDrop} onDrop={onDrop(`extra:${e.id}`)}>
                    <TableCell>
                      <Input className="h-8" placeholder="ex. Linie Spălat" value={e.nume} onChange={(ev) => updateExtra(e.id, { nume: ev.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="h-8 text-center" value={e.norma || ""} onChange={(ev) => updateExtra(e.id, { norma: ev.target.value === "" ? undefined : Number(ev.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8 text-center"
                        value={e.oameni || peopleFor(`extra:${e.id}`).length || ""}
                        onChange={(ev) => updateExtra(e.id, { oameni: ev.target.value === "" ? undefined : Number(ev.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {peopleFor(`extra:${e.id}`).map((p) => (
                          <PersonChip key={p.id} p={p} />
                        ))}
                      </div>
                      <Input className="h-8" placeholder="Trage oameni aici sau scrie" value={e.personal || ""} onChange={(ev) => updateExtra(e.id, { personal: ev.target.value })} />
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

      <Dialog open={showUnassigned} onOpenChange={setShowUnassigned}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Comenzi nealocate pe linie ({unassignedOrders.length} • {Math.round(nealocate).toLocaleString()} buc)
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data producție</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Produs</TableHead>
                  <TableHead className="text-right">Cantitate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedOrders
                  .slice()
                  .sort((a, b) => String(a.data_productie).localeCompare(String(b.data_productie)))
                  .map((o) => {
                    const key = `${o.magazin || "—"}||${o.punct_livrare || ""}`;
                    const nick = nickMap.get(key);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="whitespace-nowrap">{o.data_productie ? fmtRo(o.data_productie) : "-"}</TableCell>
                        <TableCell>{nick ? `${nick} (${o.magazin})` : `${o.magazin || "—"}${o.punct_livrare ? ` – ${o.punct_livrare}` : ""}`}</TableCell>
                        <TableCell>{o.productie_produse?.nume || "—"}</TableCell>
                        <TableCell className="text-right">
                          {Math.round(Number(o.cantitate) || 0).toLocaleString()} {o.productie_produse?.unitate_masura || ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {unassignedOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Toate comenzile sunt alocate.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="personal">
          <PersonnelManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionPlanner;
