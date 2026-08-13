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
import { AlertTriangle, ClipboardList, Clock, Download, GripVertical, Plus, Printer, Scissors, Trash2, Users, X } from "lucide-react";
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

const normName = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Linii echivalente la ambalare: un produs de pe una din ele poate merge pe oricare
const GROUP_DEFS: { id: string; label: string; test: (n: string) => boolean }[] = [
  {
    id: "grp-aromate-mica",
    label: "Aromate mică (automată + manuală)",
    test: (n) => /aromat/.test(n) && /mic/.test(n),
  },
  {
    id: "grp-flowpack-giostra",
    label: "Flowpack mare + Giostra",
    test: (n) => (/flowpack/.test(n) && /mare/.test(n)) || /giostra/.test(n),
  },
  {
    id: "grp-salate",
    label: "Salate 1 (verticala mare) + Salate 2 + Salate bio / coleslaw / fructe",
    test: (n) =>
      /salate\s*1/.test(n) ||
      /salate\s*2/.test(n) ||
      /verticala mare/.test(n) ||
      (/salate/.test(n) && /(bio|coleslo|colesla|fructe)/.test(n)) ||
      /coleslo|colesla/.test(n),
  },
];

interface LineOverride {

  norma?: number;
  oameni?: number;
  personal?: string;
  startProdus?: string;
  cantitate?: number;
  /** ore disponibile manual pe linie (ore suplimentare / program scurtat) */
  ore?: number;
}

export interface ShiftCfg {
  id: string;
  nume: string;
  start: string;
  hours: number;
  /** pauze totale în minute */
  pauza: number;
}

const DEFAULT_SHIFTS: ShiftCfg[] = [{ id: "s1", nume: "Schimb 1", start: "06:00", hours: 8, pauza: 30 }];
const SECOND_SHIFT: ShiftCfg = { id: "s2", nume: "Schimb 2", start: "14:00", hours: 8, pauza: 30 };

const parseHM = (s: string) => {
  const [h, m] = String(s || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmtHM = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};


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
  // ---- Program de lucru (1 sau 2 schimburi, configurabil) ----
  const [shifts, setShifts] = usePersistentState<ShiftCfg[]>("planner-shifts-cfg", DEFAULT_SHIFTS);
  const effOf = (s: ShiftCfg) => Math.max(0, (Number(s.hours) || 0) - (Number(s.pauza) || 0) / 60);
  // ---- Rotație: „zilnic” (toți lucrează în fiecare zi) sau „2 cu 2” (schimburile alternează) ----
  const [rotation, setRotation] = usePersistentState<{ mode: "zilnic" | "2x2"; ref: string; first: string }>(
    "planner-rotation",
    { mode: "zilnic", ref: today, first: "s1" }
  );
  const rotationShiftId = useMemo(() => {
    if (rotation.mode !== "2x2" || shifts.length < 2) return null;
    const d = Math.floor((Date.parse(startDate) - Date.parse(rotation.ref)) / 86400000);
    const cycle = ((d % 4) + 4) % 4;
    const other = shifts.find((s) => s.id !== rotation.first)?.id || "s2";
    return cycle < 2 ? rotation.first : other;
  }, [rotation, shifts, startDate]);
  /** schimburile care lucrează efectiv în ziua planificată */
  const dayShifts = rotationShiftId ? shifts.filter((s) => s.id === rotationShiftId) : shifts;
  const shiftHours = dayShifts.reduce((a, s) => a + effOf(s), 0);
  const updateShift = (id: string, patch: Partial<ShiftCfg>) =>
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const setShiftCount = (n: number) =>
    setShifts((prev) => (n === 1 ? [prev[0] || DEFAULT_SHIFTS[0]] : [prev[0] || DEFAULT_SHIFTS[0], prev[1] || SECOND_SHIFT]));
  /** ora la care se termină după `h` ore de lucru efectiv (ține cont de pauze și de trecerea în schimbul următor) */
  const clockAfter = (h: number) => {
    let rest = Math.max(0, h);
    for (const s of dayShifts) {
      const eff = effOf(s);
      if (rest <= eff + 1e-6) {
        return fmtHM(parseHM(s.start) + rest * 60 + (eff > 0 ? (rest / eff) * (Number(s.pauza) || 0) : 0));
      }
      rest -= eff;
    }
    const last = dayShifts[dayShifts.length - 1];
    return last ? fmtHM(parseHM(last.start) + (Number(last.hours) || 0) * 60 + rest * 60) : "-";
  };
  // mutări valabile doar pentru ziua planificată: personId -> slot ("none" = scos de pe linie)
  const [dayAssign, setDayAssign] = usePersistentState<Record<string, string>>(`planner-day-assign-${startDate}`, {});
  // schimbul în care lucrează fiecare om în ziua planificată
  const [personShift, setPersonShift] = usePersistentState<Record<string, string>>(`planner-person-shift-${startDate}`, {});
  const [activeShift, setActiveShift] = useState<string>("s1");
  const currentShift = dayShifts.some((s) => s.id === activeShift) ? activeShift : dayShifts[0]?.id || "s1";
  const [saveAsDefault, setSaveAsDefault] = usePersistentState<boolean>("planner-save-default-line", false);

  const [showClients, setShowClients] = useState(true);
  const [groupDialog, setGroupDialog] = useState<string | null>(null);
  const [lineDialog, setLineDialog] = useState<string | null>(null);

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

  // Rețete (produs -> ingrediente) pentru verificarea acoperirii cu materie primă
  const { data: recipeMap } = useQuery({
    queryKey: ["planner-recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productie_produse")
        .select(
          `id, nume, productie_retete(productie_retete_ingrediente(cantitate_necesara, unitate_masura, productie_ingrediente(nume, unitate_masura)))`
        );
      if (error) throw error;
      const m = new Map<string, { nume: string; qty: number; unit: string }[]>();
      ((data as any[]) || []).forEach((p) => {
        const ing: { nume: string; qty: number; unit: string }[] = [];
        (p.productie_retete || []).forEach((r: any) =>
          (r.productie_retete_ingrediente || []).forEach((i: any) =>
            ing.push({
              nume: i.productie_ingrediente?.nume || "—",
              qty: Number(i.cantitate_necesara) || 0,
              unit: i.unitate_masura || i.productie_ingrediente?.unitate_masura || "",
            })
          )
        );
        m.set(p.id, ing);
      });
      return m;
    },
    staleTime: 300_000,
  });

  // Stoc depozit materii prime (agregat pe denumire)
  const { data: stocDepozit } = useQuery({
    queryKey: ["planner-warehouse-stock"],
    queryFn: async () => {
      const rows: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.from("inventory").select("name, quantity").range(offset, offset + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
      }
      const map = new Map<string, number>();
      rows.forEach((r) => {
        const qty = Number(r.quantity) || 0;
        if (qty <= 0) return;
        const key = normName(r.name);
        if (!key) return;
        map.set(key, (map.get(key) || 0) + qty);
      });
      return map;
    },
    staleTime: 60_000,
  });

  const getStoc = (nume: string): number | null => {
    if (!stocDepozit) return null;
    const key = normName(nume);
    if (!key) return null;
    if (stocDepozit.has(key)) return stocDepozit.get(key)!;
    let total = 0;
    let found = false;
    stocDepozit.forEach((qty, n) => {
      if (n.includes(key) || key.includes(n)) {
        total += qty;
        found = true;
      }
    });
    return found ? total : null;
  };


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
  /** schimbul persoanei: override de zi > schimbul permanent din nomenclator > primul schimb al zilei */
  const shiftOf = (p: Person) => {
    const ov = personShift[p.id];
    if (shifts.some((x) => x.id === ov)) return ov;
    const perm = (p as any).schimb as string | null | undefined;
    if (perm && shifts.some((x) => x.id === perm)) return perm;
    return dayShifts[0]?.id || shifts[0]?.id || "s1";
  };
  /** în rotația 2 cu 2, cine e alocat permanent pe schimbul liber nu lucrează în ziua planificată */
  const worksToday = (p: Person) => !rotationShiftId || shiftOf(p) === rotationShiftId;
  const activePeople = people.filter((p) => p.status === "activ" && worksToday(p));
  const offTodayPeople = people.filter((p) => p.status === "activ" && !worksToday(p));
  const unavailablePeople = people.filter((p) => p.status !== "activ");
  const peopleFor = (slot: string) => activePeople.filter((p) => slotOf(p) === slot);
  const unassignedPeople = activePeople.filter((p) => !slotOf(p));
  const peopleForShift = (slot: string, sid: string) => peopleFor(slot).filter((p) => shiftOf(p) === sid);
  /** Orele disponibile efectiv pe o linie: doar schimburile în care linia are oameni.
   *  Dacă nu e nimeni pe linie, linia nu se folosește la repartizarea automată. */
  const lineHours = (lineId: string) => {
    const ov = overrides[lineId] || {};
    if (ov.ore != null) return Math.max(0, ov.ore);
    const withPeople = dayShifts.filter((s) => peopleForShift(lineId, s.id).length > 0);
    if (withPeople.length) return withPeople.reduce((a, s) => a + effOf(s), 0);
    return (ov.oameni || 0) > 0 ? shiftHours : 0;
  };


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
    if (slot) setPersonShift((prev) => ({ ...prev, [id]: currentShift }));
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
      const dispo = lineHours(line.id);
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
        dispo,
        assigned,
        overHours: dispo > 0 ? ore > dispo + 0.01 : ore > 0,
        personal: ov.personal || "",
        startProdus: ov.startProdus || (topProdus ? `${topProdus[0]} – ${Math.round(topProdus[1]).toLocaleString()} buc` : ""),
      };
    });
  }, [lines, overrides, perLine, people, shifts, rotationShiftId, personShift, dayAssign, cuts]);





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
    const body: any[][] = balancedRows.map((r) => [
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
      [`Clienți incluși: ${clients.filter((c) => isIncluded(c.key)).length}/${clients.length} | Program: ${shifts.map((s) => `${s.nume} ${s.start} ${s.hours}h (pauze ${s.pauza}min)`).join("; ")} = ${formatOre(shiftHours)} efectiv`],
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

  // ---- Grupuri de linii echivalente (un produs de pe o linie poate merge pe oricare din grup) ----
  const rowsByLine = useMemo(() => {
    const m = new Map<string, (typeof rows)[number]>();
    rows.forEach((r) => m.set(r.line.id, r));
    return m;
  }, [rows]);

  const groups = useMemo(() => {
    const out: { id: string; label: string; lines: typeof lines }[] = [];
    const used = new Set<string>();
    GROUP_DEFS.forEach((g) => {
      const ls = (lines as any[]).filter((l) => g.test(normName(l.nume)));
      if (!ls.length) return;
      ls.forEach((l) => used.add(l.id));
      out.push({ id: g.id, label: g.label, lines: ls as any });
    });
    (lines as any[])
      .filter((l) => !used.has(l.id))
      .forEach((l) => out.push({ id: `single:${l.id}`, label: l.nume, lines: [l] as any }));
    return out;
  }, [lines]);

  const groupOfLine = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => g.lines.forEach((l: any) => m.set(l.id, g.id)));
    return m;
  }, [groups]);

  // Produse agregate pe grup (comenzile se împart pe liniile grupului)
  const groupPlans = useMemo(() => {
    return groups.map((g) => {
      const map = new Map<string, { key: string; nume: string; qty: number; original: number; taiat: number; orders: any[] }>();
      g.lines.forEach((l: any) => {
        (lineProducts.get(l.id) || []).forEach((p) => {
          const e = map.get(p.key) || { key: p.key, nume: p.nume, qty: 0, original: 0, taiat: 0, orders: [] };
          e.qty += p.qty;
          e.original += p.original;
          e.taiat += p.taiat;
          e.orders.push(...p.orders);
          map.set(p.key, e);
        });
      });
      const order = lineOrder[g.id] || [];
      const prods = Array.from(map.values()).sort((a, b) => {
        const ia = order.indexOf(a.key);
        const ib = order.indexOf(b.key);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return b.qty - a.qty;
      });
      const norma = g.lines.reduce((s: number, l: any) => s + (rowsByLine.get(l.id)?.norma || 0), 0);
      const qty = prods.reduce((s, p) => s + p.qty, 0);

      // Repartizare automată echilibrată DOAR pe liniile care au oameni în ziua respectivă.
      // Fiecare linie primește proporțional cu capacitatea ei (normă × ore disponibile),
      // astfel încât toate să termine cam la aceeași oră.
      const buckets = g.lines.map((l: any) => ({
        line: l,
        norma: rowsByLine.get(l.id)?.norma || 0,
        hours: rowsByLine.get(l.id)?.dispo || 0,
        items: [] as { nume: string; qty: number }[],
        qty: 0,
        ore: 0,
        target: 0,
      }));
      const usable = buckets.filter((b) => b.norma > 0 && b.hours > 0);
      const capacity = usable.reduce((s, b) => s + b.norma * b.hours, 0);
      const normaActiva = usable.reduce((s, b) => s + b.norma, 0);
      const ore = normaActiva > 0 ? qty / normaActiva : 0;
      let rest = 0;
      if (usable.length) {
        const frac = capacity > 0 ? Math.min(1, qty / capacity) : 0;
        usable.forEach((b) => {
          b.target = b.norma * b.hours * frac;
        });

        const capOf = (b: typeof usable[number], strict: boolean) =>
          Math.max(0, (strict ? b.target : b.norma * b.hours) - b.qty);

        prods.forEach((p) => {
          let remaining = p.qty;
          for (const strict of [true, false]) {
            while (remaining > 0.5) {
              const cands = usable
                .filter((b) => capOf(b, strict) > 0.5)
                .sort((a, b) => a.qty / (a.norma * a.hours) - b.qty / (b.norma * b.hours));
              if (!cands.length) break;
              const b = cands[0];
              const take = Math.min(remaining, capOf(b, strict));
              const ex = b.items.find((it) => it.nume === p.nume);
              if (ex) ex.qty += take; else b.items.push({ nume: p.nume, qty: take });
              b.qty += take;
              b.ore = b.qty / b.norma;
              remaining -= take;
            }
            if (remaining <= 0.5) break;
          }
          if (remaining > 0.5) rest += remaining;
        });
      } else {
        rest = qty;
      }
      const moved = buckets.some((b, i) => i > 0 && b.qty > 0);
      const inactive = buckets.filter((b) => b.norma > 0 && b.hours <= 0);
      // ore suplimentare necesare dacă marfa nu încape pe liniile cu oameni
      const overtime = rest > 0.5 && normaActiva > 0 ? rest / normaActiva : 0;
      const capHours = usable.length ? Math.max(...usable.map((b) => b.hours)) : 0;

      return {
        ...g,
        prods,
        norma,
        normaActiva,
        qty,
        ore,
        capHours,
        capacity,
        over: capacity > 0 ? qty > capacity + 1 : qty > 0,
        buckets,
        usableCount: usable.length,
        inactive,
        overtime,
        rest,
        moved,
      };
    });
  }, [groups, lineProducts, lineOrder, rowsByLine, shifts, rotationShiftId]);

  // Rândurile din tabelul principal folosesc repartizarea automată echilibrată pe liniile grupului
  const balancedRows = useMemo(() => {
    const bal = new Map<string, { qty: number; items: { nume: string; qty: number }[] }>();
    groupPlans.forEach((g: any) =>
      g.buckets.forEach((b: any) => bal.set(b.line.id, { qty: b.qty, items: b.items }))
    );
    return rows.map((r) => {
      const ov = overrides[r.line.id] || {};
      const b = bal.get(r.line.id);
      if (ov.cantitate != null || !b) return { ...r, balanced: false };
      const cantitate = Math.round(b.qty);
      const ore = r.norma > 0 ? cantitate / r.norma : 0;
      const top = [...b.items].sort((a, c) => c.qty - a.qty)[0];
      return {
        ...r,
        cantitate,
        ore,
        overHours: r.dispo > 0 ? ore > r.dispo + 0.01 : ore > 0,
        startProdus:
          ov.startProdus ||
          (top ? `${top.nume} – ${Math.round(top.qty).toLocaleString()} buc` : r.startProdus),
        balanced: Math.abs(cantitate - r.autoCant) > 1,
      };
    });
  }, [rows, groupPlans, overrides, shifts, rotationShiftId]);


  const balancedByLine = useMemo(
    () => new Map(balancedRows.map((r) => [r.line.id, r])),
    [balancedRows]
  );

  const overLines = balancedRows.filter((r) => r.overHours);

  const totals = useMemo(() => {
    const norma = balancedRows.reduce((s, r) => s + (r.norma || 0), 0);
    const oameniLinii = balancedRows.reduce((s, r) => s + (r.oameni || 0), 0);
    const cantitate = balancedRows.reduce((s, r) => s + (r.cantitate || 0), 0);
    const oameniExtra = extras.reduce(
      (s, e) => s + (e.oameni != null && e.oameni > 0 ? e.oameni : peopleFor(`extra:${e.id}`).length),
      0
    );
    return { norma, oameniLinii, cantitate, oameniExtra, oameniTotal: oameniLinii + oameniExtra };
  }, [balancedRows, extras, people]);



  // Detaliu deschis: fie un grup, fie o singură linie
  const detail = useMemo(() => {
    if (lineDialog) {
      const l = (lines as any[]).find((x) => x.id === lineDialog);
      return l ? { label: l.nume, lineIds: [l.id] } : null;
    }
    const g = groupPlans.find((x) => x.id === groupDialog);
    return g ? { label: g.label, lineIds: g.lines.map((l: any) => l.id) } : null;
  }, [lineDialog, groupDialog, groupPlans, lines]);

  const activeGroup = useMemo(() => groupPlans.find((g) => g.id === groupDialog) || null, [groupPlans, groupDialog]);

  const groupOrders = useMemo(() => {
    if (!detail) return [] as any[];
    const ids = new Set(detail.lineIds);
    return filteredOrders
      .filter((o: any) => o.linie_id && ids.has(o.linie_id))
      .sort((a: any, b: any) => String(a.data_productie).localeCompare(String(b.data_productie)));
  }, [detail, filteredOrders]);

  // Necesar materie primă pentru grupul / linia deschisă
  const groupNeeds = useMemo(() => {
    if (!detail || !recipeMap) return [] as { nume: string; necesar: number; unit: string; stoc: number | null }[];
    const acc = new Map<string, { nume: string; necesar: number; unit: string }>();
    groupOrders.forEach((o: any) => {
      const ings = recipeMap.get(o.produs_id) || [];
      const q = effQty(o);
      ings.forEach((i) => {
        let qty = i.qty * q;
        const u = (i.unit || "").trim().toLowerCase();
        let unit = u;
        if (["g", "gr", "grame", "gram"].includes(u)) { qty = qty / 1000; unit = "kg"; }
        else if (["ml", "mililitri"].includes(u)) { qty = qty / 1000; unit = "l"; }
        else if (["kilograme", "kg"].includes(u)) { unit = "kg"; }
        else if (["litri", "l"].includes(u)) { unit = "l"; }
        const e = acc.get(i.nume) || { nume: i.nume, necesar: 0, unit };
        e.necesar += qty;
        acc.set(i.nume, e);
      });

    });
    return Array.from(acc.values())
      .map((e) => ({ ...e, stoc: getStoc(e.nume) }))
      .sort((a, b) => a.nume.localeCompare(b.nume, "ro"));
  }, [detail, groupOrders, recipeMap, stocDepozit, cuts]);

  const printGroups = (gs: typeof groupPlans) => {
    const html = gs
      .map((g) => {
        let cum = 0;
        const rowsHtml = g.prods
          .map((p, i) => {
            const gn = (g as any).normaActiva || g.norma;
            const ore = gn > 0 ? p.qty / gn : 0;
            cum += ore;
            return `<tr><td>${i + 1}</td><td>${p.nume}</td><td style="text-align:right">${Math.round(p.qty).toLocaleString()}</td><td style="text-align:right">${formatOre(ore)}</td><td style="text-align:right">${clockAfter(cum)}</td></tr>`;
          })
          .join("");
        return `<h3>${g.label} – ${(g as any).normaActiva || g.norma || 0} buc/oră (linii cu oameni: ${(g as any).usableCount ?? g.lines.length}/${g.lines.length})</h3>
        <table><thead><tr><th>#</th><th>Produs</th><th>Cantitate</th><th>Ore</th><th>Gata la</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><th colspan="2">Subtotal</th><th style="text-align:right">${Math.round(g.qty).toLocaleString()}</th><th colspan="2" style="text-align:right">${formatOre(g.ore)} / ${formatOre((g as any).capHours || 0)}${(g as any).overtime > 0 ? ` (+${formatOre((g as any).overtime)} supl.)` : ""}</th></tr></tfoot></table>`;
      })
      .join("");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<html><head><title>Ordinea comenzilor pe linii</title>
      <style>body{font-family:Arial,sans-serif;padding:16px;font-size:12px}h2{margin:0 0 8px}h3{margin:16px 0 4px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #999;padding:4px}
      thead th{background:#eee}</style></head><body>
      <h2>Ordinea comenzilor pe linii – ${fmtRo(startDate)} - ${fmtRo(endDate)}</h2>
      <p>${shifts.map((s) => `${s.nume}: ${s.start}, ${s.hours}h, pauze ${s.pauza} min (efectiv ${formatOre(effOf(s))})`).join(" | ")}</p>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
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
      {shifts.length > 1 && (
        <button
          type="button"
          title="Schimbă schimbul"
          className="rounded bg-primary/15 px-1 text-[10px] font-semibold"
          onClick={() =>
            setPersonShift((prev) => {
              const idx = shifts.findIndex((s) => s.id === shiftOf(p));
              return { ...prev, [p.id]: shifts[(idx + 1) % shifts.length].id };
            })
          }
        >
          {shifts.findIndex((s) => s.id === shiftOf(p)) + 1}
        </button>
      )}
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
              <Clock className="h-3 w-3" /> Program disponibil: {formatOre(shiftHours)}
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" /> Total oameni: {totals.oameniTotal}
            </Badge>
            {overLines.length > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {overLines.length} linii peste programul lor
              </Badge>
            )}
          </div>

          {/* Program de lucru configurabil (1 sau 2 schimburi, ore de start, pauze) */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" /> Program de lucru
              </span>
              <Button size="sm" variant={shifts.length === 1 ? "default" : "outline"} onClick={() => setShiftCount(1)}>
                1 schimb
              </Button>
              <Button size="sm" variant={shifts.length === 2 ? "default" : "outline"} onClick={() => setShiftCount(2)}>
                2 schimburi
              </Button>
              <span className="text-xs text-muted-foreground">
                Total efectiv (fără pauze): {formatOre(shiftHours)}
              </span>
            </div>

            {shifts.length > 1 && (
              <div className="flex flex-wrap items-end gap-2 rounded border bg-muted/30 p-2 text-xs">
                <span className="font-medium pb-2">Rotație:</span>
                <Button
                  size="sm"
                  className="h-7"
                  variant={rotation.mode === "zilnic" ? "default" : "outline"}
                  onClick={() => setRotation((r) => ({ ...r, mode: "zilnic" }))}
                >
                  Zilnic (ambele schimburi)
                </Button>
                <Button
                  size="sm"
                  className="h-7"
                  variant={rotation.mode === "2x2" ? "default" : "outline"}
                  onClick={() => setRotation((r) => ({ ...r, mode: "2x2" }))}
                >
                  2 cu 2 (alternativ)
                </Button>
                {rotation.mode === "2x2" && (
                  <>
                    <div>
                      <Label className="text-[10px]">Prima zi de ciclu</Label>
                      <Input
                        type="date"
                        className="h-8 w-36"
                        value={rotation.ref}
                        onChange={(e) => setRotation((r) => ({ ...r, ref: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Începe cu</Label>
                      <select
                        className="h-8 rounded border bg-background px-2"
                        value={rotation.first}
                        onChange={(e) => setRotation((r) => ({ ...r, first: e.target.value }))}
                      >
                        {shifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nume}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Badge className="mb-1">
                      {fmtRo(startDate)}: lucrează {shifts.find((s) => s.id === rotationShiftId)?.nume || "-"}
                    </Badge>
                    {offTodayPeople.length > 0 && (
                      <span className="pb-2 text-muted-foreground">
                        {offTodayPeople.length} oameni liberi azi (celălalt schimb)
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="grid gap-2 md:grid-cols-2">
              {shifts.map((s) => (
                <div
                  key={s.id}
                  className={`rounded border p-2 space-y-2 ${
                    rotationShiftId && s.id !== rotationShiftId ? "opacity-60 bg-muted/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 w-32"
                      value={s.nume}
                      onChange={(e) => updateShift(s.id, { nume: e.target.value })}
                    />
                    {shifts.length > 1 && (
                      <Badge
                        variant={currentShift === s.id ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setActiveShift(s.id)}
                      >
                        {currentShift === s.id ? "schimb activ" : "fă activ"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2 text-xs">
                    <div>
                      <Label className="text-[10px]">Start</Label>
                      <Input
                        type="time"
                        className="h-8 w-28"
                        value={s.start}
                        onChange={(e) => updateShift(s.id, { start: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Ore</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        className="h-8 w-20 text-center"
                        value={s.hours || ""}
                        onChange={(e) => updateShift(s.id, { hours: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Pauze (min)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="5"
                        className="h-8 w-24 text-center"
                        value={s.pauza || ""}
                        onChange={(e) => updateShift(s.id, { pauza: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <span className="text-muted-foreground pb-2">
                      efectiv {formatOre(effOf(s))} • {s.start}–{fmtHM(parseHM(s.start) + (Number(s.hours) || 0) * 60)} •{" "}
                      {activePeople.filter((p) => shiftOf(p) === s.id && slotOf(p)).length} oameni
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Oamenii trași pe linii intră în „{shifts.find((s) => s.id === currentShift)?.nume || "schimbul activ"}”. O linie e
              folosită la repartizarea automată doar dacă are oameni în cel puțin un schimb; altfel marfa rămâne pe liniile
              acoperite și se calculează orele suplimentare necesare.
            </p>
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
                    <div key={c.key} className="flex items-center gap-2 text-sm py-1">
                      <Checkbox checked={isIncluded(c.key)} onCheckedChange={() => toggleClient(c.key)} />
                      <button
                        type="button"
                        onClick={() => setClientDialog(c.key)}
                        className="flex-1 truncate text-left hover:underline"
                        title="Vezi produsele acestui magazin"
                      >
                        {c.label}
                      </button>
                      <span className="text-xs text-muted-foreground">{Math.round(c.total).toLocaleString()}</span>
                    </div>
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
                    <TableHead className="min-w-[240px]">Personal</TableHead>
                    <TableHead className="min-w-[200px]">Se începe cu produsul</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g) => {
                    const gRows = g.lines.map((l) => balancedByLine.get(l.id)).filter(Boolean) as typeof balancedRows;
                    const sub = {
                      norma: gRows.reduce((s, r) => s + (r.norma || 0), 0),
                      oameni: gRows.reduce((s, r) => s + (r.oameni || 0), 0),
                      cantitate: gRows.reduce((s, r) => s + (r.cantitate || 0), 0),
                    };
                    return (
                      <React.Fragment key={g.id}>
                        <TableRow className="border-0 hover:bg-transparent">
                          <TableCell colSpan={7} className="p-0">
                            <div className="h-3" />
                          </TableCell>
                        </TableRow>
                        {g.lines.length > 1 && (
                          <TableRow className="bg-primary/5 hover:bg-primary/10">
                            <TableCell colSpan={7} className="py-1.5">
                              <button
                                type="button"
                                className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
                                onClick={() => { setLineDialog(null); setGroupDialog(g.id); }}
                              >
                                {g.label}
                              </button>
                            </TableCell>
                          </TableRow>
                        )}
                        {gRows.map((r) => (
                          <TableRow
                            key={r.line.id}
                            onDragOver={allowDrop}
                            onDrop={onDrop(r.line.id)}
                            className={r.overHours ? "bg-destructive/10" : undefined}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1">
                                {r.overHours && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                <button
                                  type="button"
                                  className="text-left hover:underline"
                                  title="Vezi comenzile de pe această linie"
                                  onClick={() => { setGroupDialog(null); setLineDialog(r.line.id); }}
                                >
                                  {r.line.nume}
                                </button>
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
                              <div className="text-[10px] text-muted-foreground">
                                din {formatOre(r.dispo)} {r.dispo > 0 ? `• gata ${clockAfter(r.ore)}` : "• fără oameni"}
                              </div>
                              {r.overHours && r.dispo > 0 && (
                                <div className="text-[10px]">+{formatOre(r.ore - r.dispo)} suplimentar</div>
                              )}
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                className="h-7 mt-1 text-center text-xs"
                                placeholder="ore disp."
                                value={(overrides[r.line.id] || {}).ore ?? ""}
                                onChange={(e) =>
                                  setOverride(r.line.id, { ore: e.target.value === "" ? undefined : Number(e.target.value) })
                                }
                              />
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
                        {g.lines.length > 1 && (
                          <TableRow className="bg-primary/5 border-b-2 border-primary/30 text-sm">
                            <TableCell className="font-semibold">Subtotal: {g.label}</TableCell>
                            <TableCell className="text-center">{sub.norma.toLocaleString()}</TableCell>
                            <TableCell className="text-center">{sub.oameni}</TableCell>
                            <TableCell className="text-center">{Math.round(sub.cantitate).toLocaleString()}</TableCell>
                            <TableCell className="text-center">{formatOre(sub.norma > 0 ? sub.cantitate / sub.norma : 0)}</TableCell>
                            <TableCell colSpan={2} />
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
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
          {shifts.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">Trag oamenii în:</span>
              {shifts.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={currentShift === s.id ? "default" : "outline"}
                  className="h-7"
                  onClick={() => setActiveShift(s.id)}
                >
                  {s.nume} ({s.start})
                </Button>
              ))}
              <span className="text-muted-foreground">
                Click pe cifra din dreptul numelui ca să muți omul în celălalt schimb.
              </span>
            </div>
          )}
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

      {/* Ordinea produselor pe grupuri de linii */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-base flex-wrap">
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Ordinea comenzilor pe linii
            </span>
            <Button size="sm" variant="outline" onClick={() => printGroups(groupPlans.filter((g) => g.prods.length > 0))}>
              <Printer className="h-4 w-4 mr-1" /> Printează tot
            </Button>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Liniile echivalente sunt grupate (produsul poate merge pe oricare din ele), cu subtotal pe grup. Trage produsele ca să
            stabilești ordinea; ce depășește programul liniilor cu oameni e marcat roșu. Click pe numele grupului ca să vezi
            comenzile și dacă ajunge marfa.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupPlans.filter((g) => g.prods.length > 0).map((g) => {
            const keys = g.prods.map((p) => p.key);
            let cum = 0;
            return (
              <div key={g.id} className="border-2 rounded-lg shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-primary/10 text-sm font-medium">
                  <button type="button" className="text-left hover:underline" onClick={() => { setLineDialog(null); setGroupDialog(g.id); }}>
                    {g.label} • {g.normaActiva || 0} buc/oră activ
                    {g.lines.length > 1 && <Badge variant="secondary" className="ml-2 font-normal">{g.usableCount}/{g.lines.length} linii cu oameni</Badge>}
                  </button>
                  <span className="flex items-center gap-2">
                    <span className={g.over ? "text-destructive" : "text-muted-foreground"}>
                      Subtotal {Math.round(g.qty).toLocaleString()} buc • {formatOre(g.ore)} / {formatOre(g.capHours)}
                      {g.overtime > 0 && ` (+${formatOre(g.overtime)} supl. → ${clockAfter(g.ore)})`}
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => printGroups([g])} title="Printează grupul">
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </div>
                {g.lines.length > 1 && (
                  <div className="px-3 py-2 bg-muted/30 border-b text-xs space-y-1">
                    <div className="font-medium">
                      Repartizare automată doar pe liniile cu oameni ({g.usableCount} din {g.lines.length})
                    </div>
                    {g.buckets.map((b: any) => (
                      <div key={b.line.id} className={`rounded border px-2 py-1 ${b.hours > 0 ? "bg-background/60" : "bg-muted/50 opacity-70"}`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="flex-1 min-w-0 truncate text-left font-medium hover:underline"
                            onClick={() => { setGroupDialog(null); setLineDialog(b.line.id); }}
                          >
                            {b.line.nume}
                          </button>
                          {b.hours <= 0 ? (
                            <span className="shrink-0 text-muted-foreground">fără oameni – nefolosită</span>
                          ) : (
                            <>
                              <span className="shrink-0 tabular-nums">{Math.round(b.qty).toLocaleString()} buc</span>
                              <span className={`shrink-0 tabular-nums ${b.ore > b.hours + 0.01 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                {formatOre(b.ore)} / {formatOre(b.hours)} • gata {clockAfter(b.ore)}
                              </span>
                            </>
                          )}
                        </div>
                        {b.hours > 0 && (
                          <div className="mt-0.5 text-muted-foreground break-words line-clamp-2">
                            {b.items.length ? b.items.map((i: any) => `${i.nume} (${Math.round(i.qty).toLocaleString()})`).join(" · ") : "—"}
                          </div>
                        )}
                      </div>
                    ))}

                    {g.rest > 0.5 && (
                      <div className="text-destructive font-medium">
                        ⚠️ {Math.round(g.rest).toLocaleString()} buc nu încap pe liniile cu oameni – trebuie{" "}
                        {formatOre(g.overtime)} ore suplimentare (până la {clockAfter(g.ore)}) sau tăiere.
                      </div>
                    )}
                    {g.rest <= 0.5 && g.moved && (
                      <div className="text-emerald-700">
                        ✔ Totul încape în program prin mutarea automată pe liniile din aceeași grupă care au oameni.
                      </div>
                    )}
                  </div>
                )}
                <div className="divide-y">

                  {g.prods.map((p, idx) => {
                    const gNorma = g.normaActiva || g.norma;
                    const ore = gNorma > 0 ? p.qty / gNorma : 0;
                    cum += ore;
                    const over = g.capHours > 0 && cum > g.capHours;
                    const surplus = over && gNorma > 0 ? Math.max(0, Math.round((cum - g.capHours) * gNorma)) : 0;
                    const fitCut = Math.min(p.qty, surplus);
                    const dk = `${g.id}::${p.key}`;

                    return (
                      <div
                        key={p.key}
                        draggable
                        onDragStart={() => setDragProd({ lineId: g.id, key: p.key })}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragProd && dragProd.lineId === g.id) {
                            moveProduct(g.id, keys, keys.indexOf(dragProd.key), idx);
                          }
                          setDragProd(null);
                        }}
                        className={`flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm ${over ? "bg-destructive/10" : ""}`}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <span className="w-6 text-xs text-muted-foreground">{idx + 1}.</span>
                        <span className={`flex-1 min-w-[120px] truncate ${p.qty <= 0 ? "line-through text-muted-foreground" : ""}`}>
                          {p.nume}
                        </span>
                        <span className="text-xs w-24 text-right">
                          {Math.round(p.qty).toLocaleString()}
                          {p.taiat > 0 && <span className="line-through ml-1 text-muted-foreground">{Math.round(p.original).toLocaleString()}</span>}
                        </span>
                        <span className="text-xs w-20 text-right text-muted-foreground">{formatOre(ore)}</span>
                        <span className={`text-xs w-24 text-right ${over ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                          gata la {formatOre(cum)} ({clockAfter(cum)})
                        </span>
                        <Input
                          type="number"
                          className="h-7 w-20 text-xs"
                          placeholder="taie"
                          value={lineCutDraft[dk] ?? (p.taiat || "")}
                          onChange={(e) => setLineCutDraft((prev) => ({ ...prev, [dk]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={async () => {
                            await applyCutOrders(p.nume, p.orders, Number(lineCutDraft[dk] ?? p.taiat) || 0);
                            setLineCutDraft((prev) => { const n = { ...prev }; delete n[dk]; return n; });
                          }}
                        >
                          <Scissors className="h-3 w-3" />
                        </Button>
                        {fitCut > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive"
                            onClick={() => applyCutOrders(p.nume, p.orders, p.taiat + fitCut)}
                          >
                            taie {fitCut.toLocaleString()} ca să încapă
                          </Button>
                        )}
                        <div className="flex gap-0.5">
                          <Button size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={() => moveProduct(g.id, keys, idx, idx - 1)}>↑</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={() => moveProduct(g.id, keys, idx, idx + 1)}>↓</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {groupPlans.every((g) => g.prods.length === 0) && (
            <div className="text-sm text-muted-foreground py-4 text-center">Nicio comandă alocată pe linii în perioada selectată.</div>
          )}
        </CardContent>
      </Card>

      {/* Comenzile unui grup de linii + acoperire materie primă */}
      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) { setGroupDialog(null); setLineDialog(null); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{detail?.label || "Linie"} – comenzi și acoperire marfă</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Necesar materie primă vs stoc depozit</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Necesar</TableHead>
                    <TableHead className="text-right">Stoc</TableHead>
                    <TableHead className="text-right">Diferență</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupNeeds.map((n) => (
                    <TableRow key={n.nume} className={n.stoc != null && n.stoc < n.necesar ? "bg-destructive/10" : ""}>
                      <TableCell>{n.nume}</TableCell>
                      <TableCell className="text-right">{n.necesar.toFixed(2)} {n.unit}</TableCell>
                      <TableCell className="text-right">{n.stoc == null ? "-" : n.stoc.toFixed(2)}</TableCell>
                      <TableCell className={`text-right ${n.stoc != null && n.stoc < n.necesar ? "text-destructive font-semibold" : ""}`}>
                        {n.stoc == null ? "-" : (n.stoc - n.necesar).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {groupNeeds.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                        Nicio rețetă definită pentru produsele din acest grup.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Comenzi ({groupOrders.length})</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Produs</TableHead>
                    <TableHead className="text-right">Cantitate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupOrders.map((o: any) => {
                    const key = `${o.magazin || "—"}||${o.punct_livrare || ""}`;
                    const nick = nickMap.get(key);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="whitespace-nowrap">{o.data_productie ? fmtRo(o.data_productie) : "-"}</TableCell>
                        <TableCell>{nick ? `${nick} (${o.magazin})` : `${o.magazin || "—"}${o.punct_livrare ? ` – ${o.punct_livrare}` : ""}`}</TableCell>
                        <TableCell>{o.productie_produse?.nume || "—"}</TableCell>
                        <TableCell className="text-right">{Math.round(effQty(o)).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Produsele unui magazin */}
      <Dialog open={!!clientDialog} onOpenChange={(v) => !v && setClientDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {clients.find((c) => c.key === clientDialog)?.label || "Magazin"} – produse ({clientProducts.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y">
            {clientProducts.map((p) => {
              const dk = `cl::${clientDialog}::${p.key}`;
              return (
                <div key={p.key} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                  <span className={`flex-1 min-w-[160px] truncate ${p.qty <= 0 ? "line-through text-muted-foreground" : ""}`}>{p.nume}</span>
                  <span className="text-xs w-24 text-right">
                    {Math.round(p.qty).toLocaleString()}
                    {p.taiat > 0 && <span className="line-through ml-1 text-muted-foreground">{Math.round(p.original).toLocaleString()}</span>}
                  </span>
                  <Input
                    type="number"
                    className="h-7 w-24 text-xs"
                    placeholder="taie..."
                    value={clientCutDraft[dk] ?? (p.taiat || "")}
                    onChange={(e) => setClientCutDraft((prev) => ({ ...prev, [dk]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={async () => {
                      await applyCutOrders(p.nume, p.orders, Number(clientCutDraft[dk] ?? p.taiat) || 0);
                      setClientCutDraft((prev) => { const n = { ...prev }; delete n[dk]; return n; });
                    }}
                  >
                    <Scissors className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => applyCutOrders(p.nume, p.orders, p.original)}>
                    exclude tot
                  </Button>
                  {p.taiat > 0 && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => applyCutOrders(p.nume, p.orders, 0)}>
                      anulează
                    </Button>
                  )}
                </div>
              );
            })}
            {clientProducts.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">Nicio comandă pentru acest magazin.</div>
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t text-xs">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={!!clientDialog && isIncluded(clientDialog)}
                onCheckedChange={() => clientDialog && toggleClient(clientDialog)}
              />
              Include acest magazin în plan
            </label>
            <Button size="sm" variant="outline" onClick={() => setClientDialog(null)}>Închide</Button>
          </div>
        </DialogContent>
      </Dialog>



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
