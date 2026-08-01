import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useInventoryType } from "@/context/inventory-type";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { exportToExcel } from "@/lib/excelExport";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";


interface Session {
  id: string;
  inventory_type: string;
  name: string;
  status: string;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
}

interface SessionItem {
  id: string;
  session_id: string;
  inventory_row_id: string | null;
  name: string;
  lot_number: string | null;
  supplier: string | null;
  manufacturer: string | null;
  unit: string | null;
  scriptic: number;
  fizic: number | null;
  applied: boolean;
}

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n)
    ? "-"
    : (Math.round(n * 100) / 100).toLocaleString("ro-RO");

const fmtDate = (d: string) =>
  new Date(d).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const StockCountManagement: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<Session | null>(null);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [applying, setApplying] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [savingRow, setSavingRow] = useState(false);
  const [newRow, setNewRow] = useState({
    name: "",
    lot_number: "",
    supplier: "",
    manufacturer: "",
    unit: "kg",
    fizic: "",
  });
  const [nomen, setNomen] = useState<{ products: string[]; suppliers: string[]; manufacturers: string[] }>({
    products: [],
    suppliers: [],
    manufacturers: [],
  });


  const legacyTable =
    inventoryType === "ambalaje"
      ? "ambalaje_inventory"
      : inventoryType === "etichete"
      ? "etichete_inventory"
      : "inventory";

  const prefix =
    inventoryType === "ambalaje" ? "ambalaje_" : inventoryType === "etichete" ? "etichete_" : "";
  const productsTable = `${prefix}products`;
  const suppliersTable = `${prefix}suppliers`;
  const manufacturersTable = `${prefix}manufacturers`;

  const typeLabel =
    inventoryType === "ambalaje"
      ? "Ambalaje"
      : inventoryType === "etichete"
      ? "Etichete"
      : "Materii Prime";

  useEffect(() => {
    (async () => {
      const [p, s, m] = await Promise.all([
        supabase.from(productsTable).select("name").order("name"),
        supabase.from(suppliersTable).select("name").order("name"),
        supabase.from(manufacturersTable).select("name").order("name"),
      ]);
      setNomen({
        products: ((p.data as any[]) || []).map((x) => x.name).filter(Boolean),
        suppliers: ((s.data as any[]) || []).map((x) => x.name).filter(Boolean),
        manufacturers: ((m.data as any[]) || []).map((x) => x.name).filter(Boolean),
      });
    })();
  }, [productsTable, suppliersTable, manufacturersTable]);


  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabaseCloud
      .from("inventar_sessions")
      .select("*")
      .eq("inventory_type", inventoryType)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: "Eroare", description: error.message });
    } else {
      setSessions((data || []) as Session[]);
    }
    setLoading(false);
  }, [inventoryType]);

  useEffect(() => {
    setActive(null);
    setItems([]);
    fetchSessions();
  }, [fetchSessions]);

  const loadItems = async (session: Session) => {
    setItemsLoading(true);
    setActive(session);
    const pageSize = 1000;
    let all: SessionItem[] = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabaseCloud
        .from("inventar_session_items")
        .select("*")
        .eq("session_id", session.id)
        .order("name")
        .range(offset, offset + pageSize - 1);
      if (error) {
        toast({ variant: "destructive", title: "Eroare", description: error.message });
        break;
      }
      all = all.concat((data || []) as SessionItem[]);
      if (!data || data.length < pageSize) break;
      offset += pageSize;
    }
    setItems(all);
    setItemsLoading(false);
  };

  const startInventory = async () => {
    setCreating(true);
    try {
      // 1. snapshot stoc scriptic din depozit
      const pageSize = 1000;
      let rows: any[] = [];
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from(legacyTable)
          .select(
            `id, name, quantity, unit, lot_number, supplier,
             suppliers:supplier_id (name),
             manufacturers:manufacturer_id (name)`
          )
          .gt("quantity", 0)
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        rows = rows.concat(data || []);
        if (!data || data.length < pageSize) break;
        offset += pageSize;
      }

      if (rows.length === 0) {
        toast({ variant: "destructive", title: "Nu există stoc", description: "Depozitul nu are produse cu cantitate pozitivă." });
        return;
      }

      const now = new Date();
      const { data: sess, error: sErr } = await supabaseCloud
        .from("inventar_sessions")
        .insert({
          inventory_type: inventoryType,
          name: `Inventar ${typeLabel} – ${now.toLocaleDateString("ro-RO")} ${now.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`,
          status: "open",
        })
        .select()
        .single();
      if (sErr) throw sErr;

      const payload = rows.map((r: any) => ({
        session_id: (sess as any).id,
        inventory_row_id: r.id,
        name: r.name,
        lot_number: r.lot_number || null,
        supplier: r.suppliers?.name || r.supplier || null,
        manufacturer: r.manufacturers?.name || null,
        unit: r.unit || null,
        scriptic: Number(r.quantity) || 0,
        fizic: null,
      }));

      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabaseCloud
          .from("inventar_session_items")
          .insert(payload.slice(i, i + 500));
        if (error) throw error;
      }

      toast({ title: "Inventar creat", description: `${payload.length} poziții de numărat.` });
      await fetchSessions();
      await loadItems(sess as Session);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Eroare la creare inventar", description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const setFizic = (id: string, value: string) => {
    const num = value === "" ? null : Number(value.replace(",", "."));
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, fizic: num === null || Number.isNaN(num) ? null : num } : it))
    );
  };

  const persistFizic = async (item: SessionItem) => {
    const { error } = await supabaseCloud
      .from("inventar_session_items")
      .update({ fizic: item.fizic, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) toast({ variant: "destructive", title: "Eroare la salvare", description: error.message });
  };

  const copyScriptic = async () => {
    const updated = items.map((it) => (it.fizic === null ? { ...it, fizic: it.scriptic } : it));
    setItems(updated);
    for (const it of updated) {
      await supabaseCloud.from("inventar_session_items").update({ fizic: it.fizic }).eq("id", it.id);
    }
    toast({ title: "Completat", description: "Cantitățile fizice lipsă au fost egalate cu cele scriptice." });
  };

  const diffs = useMemo(
    () => items.filter((it) => it.fizic !== null && Number(it.fizic) !== Number(it.scriptic)),
    [items]
  );

  const addManualRow = async () => {
    if (!active) return;
    if (!newRow.name.trim()) {
      toast({ variant: "destructive", title: "Produs lipsă", description: "Alege sau scrie denumirea produsului." });
      return;
    }
    setSavingRow(true);
    try {
      const { data, error } = await supabaseCloud
        .from("inventar_session_items")
        .insert({
          session_id: active.id,
          inventory_row_id: null,
          name: newRow.name.trim(),
          lot_number: newRow.lot_number.trim() || null,
          supplier: newRow.supplier.trim() || null,
          manufacturer: newRow.manufacturer.trim() || null,
          unit: newRow.unit.trim() || null,
          scriptic: 0,
          fizic: newRow.fizic === "" ? null : Number(newRow.fizic.replace(",", ".")),
        })
        .select()
        .single();
      if (error) throw error;
      setItems((prev) => [...prev, data as SessionItem]);
      setNewRow({ name: "", lot_number: "", supplier: "", manufacturer: "", unit: newRow.unit, fizic: "" });
      setAddOpen(false);
      toast({ title: "Rând adăugat", description: "Poziția a fost adăugată în lista de numărare." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Eroare", description: e.message });
    } finally {
      setSavingRow(false);
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabaseCloud.from("inventar_session_items").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Eroare", description: error.message });
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const changeStatus = async (session: Session, status: "open" | "closed") => {
    const { error } = await supabaseCloud
      .from("inventar_sessions")
      .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
      .eq("id", session.id);
    if (error) {
      toast({ variant: "destructive", title: "Eroare", description: error.message });
      return;
    }
    const updated = { ...session, status, closed_at: status === "closed" ? new Date().toISOString() : null };
    if (active?.id === session.id) setActive(updated);
    setSessions((prev) => prev.map((s) => (s.id === session.id ? updated : s)));
    toast({ title: status === "closed" ? "Inventar finalizat" : "Inventar redeschis" });
  };

  const resolveId = async (table: string, name: string): Promise<string | null> => {
    if (!name) return null;
    const { data } = await supabase.from(table).select("id, name").ilike("name", name).limit(1);
    return (data as any[])?.[0]?.id || null;
  };

  const applyAdjustments = async () => {
    if (!active) return;
    setApplying(true);
    try {
      for (const it of diffs) {
        if (it.inventory_row_id) {
          const { error } = await supabase
            .from(legacyTable)
            .update({ quantity: it.fizic })
            .eq("id", it.inventory_row_id);
          if (error) throw error;
        } else {
          if (!it.fizic || Number(it.fizic) <= 0) continue;
          const [product_id, supplier_id, manufacturer_id] = await Promise.all([
            resolveId(productsTable, it.name),
            resolveId(suppliersTable, it.supplier || ""),
            resolveId(manufacturersTable, it.manufacturer || ""),
          ]);
          const { data: inserted, error } = await supabase
            .from(legacyTable)
            .insert({
              name: it.name,
              product_id,
              supplier_id,
              supplier: it.supplier || null,
              manufacturer_id,
              lot_number: it.lot_number || null,
              quantity: it.fizic,
              unit: it.unit || "kg",
              document_number: "INVENTAR",
              receipt_date: new Date().toISOString(),
            } as any)
            .select("id")
            .single();
          if (error) throw error;
          await supabaseCloud
            .from("inventar_session_items")
            .update({ inventory_row_id: (inserted as any).id })
            .eq("id", it.id);
        }
        await supabaseCloud.from("inventar_session_items").update({ applied: true }).eq("id", it.id);
      }
      await supabaseCloud
        .from("inventar_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", active.id);
      toast({ title: "Stoc reglat", description: `${diffs.length} poziții au fost aduse la cantitatea fizică.` });
      await fetchSessions();
      const refreshed = { ...active, status: "closed" } as Session;
      await loadItems(refreshed);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Eroare la reglare", description: e.message });
    } finally {
      setApplying(false);
      setConfirmApply(false);
    }
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabaseCloud.from("inventar_sessions").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Eroare", description: error.message });
      return;
    }
    if (active?.id === id) {
      setActive(null);
      setItems([]);
    }
    setDeleteId(null);
    fetchSessions();
  };


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.name, it.lot_number, it.supplier, it.manufacturer]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  const totals = useMemo(() => {
    const scriptic = items.reduce((s, i) => s + Number(i.scriptic || 0), 0);
    const fizic = items.reduce((s, i) => s + Number(i.fizic ?? 0), 0);
    const counted = items.filter((i) => i.fizic !== null).length;
    return { scriptic, fizic, counted, diff: fizic - scriptic };
  }, [items]);

  const exportSession = () => {
    if (!active) return;
    exportToExcel(
      items.map((it) => ({
        Produs: it.name,
        Lot: it.lot_number || "-",
        Furnizor: it.supplier || "-",
        Producător: it.manufacturer || "-",
        UM: it.unit || "-",
        "Cantitate scriptică": Math.round(Number(it.scriptic) * 100) / 100,
        "Cantitate fizică": it.fizic === null ? "" : Math.round(Number(it.fizic) * 100) / 100,
        Diferență:
          it.fizic === null ? "" : Math.round((Number(it.fizic) - Number(it.scriptic)) * 100) / 100,
      })),
      `${active.name.replace(/[^\w\s-]/g, "")}.xlsx`
    );
  };

  /* ---------------- list view ---------------- */
  if (!active) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Inventare {typeLabel}</h3>
            <p className="text-xs text-muted-foreground">
              Pornește un inventar nou și compară stocul scriptic cu cel numărat fizic.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchSessions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Reîmprospătează
            </Button>
            <Button size="sm" onClick={startInventory} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Fă inventarul acum
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Se încarcă...</div>
        ) : sessions.length === 0 ? (
          <Card className="p-8 text-center">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nu există niciun inventar. Apasă „Fă inventarul acum" pentru a începe.
            </p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {sessions.map((s) => (
              <Card key={s.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{s.name}</span>
                    <Badge variant={s.status === "open" ? "secondary" : "default"}>
                      {s.status === "open" ? "În lucru" : "Finalizat"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Creat: {fmtDate(s.created_at)}
                    {s.closed_at ? ` · Finalizat: ${fmtDate(s.closed_at)}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadItems(s)}>
                    Deschide
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ștergi inventarul?</AlertDialogTitle>
              <AlertDialogDescription>
                Se șterge lista de numărare. Stocul din depozit nu este afectat.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anulează</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteId && deleteSession(deleteId)}>Șterge</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>

        </AlertDialog>
      </div>
    );
  }

  /* ---------------- detail view ---------------- */
  const readOnly = active.status !== "open";

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="outline" size="sm" onClick={() => { setActive(null); setItems([]); }}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Înapoi
          </Button>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{active.name}</div>
            <div className="text-xs text-muted-foreground">
              {items.length} poziții · {totals.counted} numărate · {diffs.length} diferențe
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportSession}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" onClick={copyScriptic}>
                <Wand2 className="h-4 w-4 mr-1" /> Completează cu scripticul
              </Button>
              <Button size="sm" onClick={() => setConfirmApply(true)} disabled={diffs.length === 0 || applying}>
                {applying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Reglează stocul ({diffs.length})
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-2">
          <div className="text-[11px] text-muted-foreground">Total scriptic</div>
          <div className="text-sm font-semibold">{fmt(totals.scriptic)}</div>
        </Card>
        <Card className="p-2">
          <div className="text-[11px] text-muted-foreground">Total fizic</div>
          <div className="text-sm font-semibold">{fmt(totals.fizic)}</div>
        </Card>
        <Card className="p-2">
          <div className="text-[11px] text-muted-foreground">Diferență totală</div>
          <div className={`text-sm font-semibold ${totals.diff < 0 ? "text-destructive" : totals.diff > 0 ? "text-green-600" : ""}`}>
            {fmt(totals.diff)}
          </div>
        </Card>
        <Card className="p-2">
          <div className="text-[11px] text-muted-foreground">Poziții cu diferențe</div>
          <div className="text-sm font-semibold">{diffs.length}</div>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9 text-sm"
          placeholder="Caută produs, lot, furnizor, producător..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-auto max-h-[65vh]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="p-2 text-left">Produs</th>
              <th className="p-2 text-left">Lot</th>
              <th className="p-2 text-left">Furnizor</th>
              <th className="p-2 text-left">Producător</th>
              <th className="p-2 text-right">Scriptic</th>
              <th className="p-2 text-right w-28">Fizic</th>
              <th className="p-2 text-right">Diferență</th>
            </tr>
          </thead>
          <tbody>
            {itemsLoading ? (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Se încarcă...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nicio poziție.</td></tr>
            ) : (
              filtered.map((it) => {
                const diff = it.fizic === null ? null : Number(it.fizic) - Number(it.scriptic);
                return (
                  <tr key={it.id} className={`border-t ${diff ? "bg-amber-50" : ""}`}>
                    <td className="p-2">{it.name}</td>
                    <td className="p-2">{it.lot_number || "-"}</td>
                    <td className="p-2">{it.supplier || "-"}</td>
                    <td className="p-2">{it.manufacturer || "-"}</td>
                    <td className="p-2 text-right">{fmt(Number(it.scriptic))} {it.unit || ""}</td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        className="h-7 text-xs text-right"
                        value={it.fizic === null ? "" : String(it.fizic)}
                        onChange={(e) => setFizic(it.id, e.target.value)}
                        onBlur={() => persistFizic(items.find((x) => x.id === it.id)!)}
                      />
                    </td>
                    <td className={`p-2 text-right font-medium ${diff === null ? "" : diff < 0 ? "text-destructive" : diff > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                      {diff === null ? "-" : fmt(diff)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reglezi stocul din depozit?</AlertDialogTitle>
            <AlertDialogDescription>
              {diffs.length} poziții vor fi actualizate la cantitatea fizică numărată. Inventarul va fi marcat ca
              finalizat. Acțiunea nu poate fi anulată automat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={applyAdjustments}>Reglează stocul</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockCountManagement;
