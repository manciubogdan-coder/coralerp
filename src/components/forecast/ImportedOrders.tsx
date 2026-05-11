import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { format, parseISO, isValid } from "date-fns";
import { ro } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, Plus, Trash2, ChevronDown, ChevronRight, CalendarIcon, FileSpreadsheet,
  Search, Loader2, Eye, X
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";

interface Props {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
}

interface OrderRow {
  id: string;
  inventory_type: string;
  source: string;
  tip_document: string | null;
  serie: string | null;
  numar: string | null;
  data: string;
  partener: string;
  total_value: number;
  total_lines: number;
  notes: string | null;
  created_at: string;
}

interface ItemRow {
  id?: string;
  denumire_articol: string;
  descriere_articol: string | null;
  cantitate: number;
  pret_final: number;
  palet: number;
  valoare_neta: number;
  unit?: string | null;
}

const parseDateCell = (val: any): string | null => {
  if (val == null || val === "") return null;
  if (val instanceof Date) return format(val, "yyyy-MM-dd");
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  // try ISO
  const iso = parseISO(s);
  if (isValid(iso)) return format(iso, "yyyy-MM-dd");
  // try DD.MM.YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/);
  if (m) {
    const [, dd, mm, yy] = m;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
};

const num = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const ImportedOrders: React.FC<Props> = ({ inventoryType }) => {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, ItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedPartners, setCollapsedPartners] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Manual create
  const [showCreate, setShowCreate] = useState(false);
  const [mPartener, setMPartener] = useState("");
  const [mData, setMData] = useState<Date>(new Date());
  const [mSerie, setMSerie] = useState("CF");
  const [mNumar, setMNumar] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [mItems, setMItems] = useState<ItemRow[]>([
    { denumire_articol: "", descriere_articol: "", cantitate: 0, pret_final: 0, palet: 0, valoare_neta: 0 }
  ]);
  const [saving, setSaving] = useState(false);

  // Detail dialog
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("purchase_orders_imported")
        .select("*")
        .eq("inventory_type", inventoryType)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders((data || []) as OrderRow[]);
    } catch (e) {
      console.error(e);
      toast({ title: "Eroare la încărcarea comenzilor", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    setItemsByOrder({});
    setExpanded(new Set());
  }, [inventoryType]);

  const fetchItems = async (orderId: string) => {
    if (itemsByOrder[orderId]) return;
    const { data, error } = await (supabase as any)
      .from("purchase_orders_imported_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setItemsByOrder(prev => ({ ...prev, [orderId]: (data || []) as ItemRow[] }));
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else { next.add(id); fetchItems(id); }
      return next;
    });
  };

  const togglePartner = (p: string) => {
    setCollapsedPartners(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  // ===== EXCEL IMPORT =====
  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

      if (rows.length === 0) {
        toast({ title: "Fișier gol", variant: "destructive" });
        return;
      }

      // Group by Numar+Partener+Data
      const groups = new Map<string, { header: any; lines: any[] }>();
      for (const r of rows) {
        const partener = String(r.Partener ?? r.partener ?? "").trim();
        const numar = String(r.Numar ?? r.numar ?? "").trim();
        const data = parseDateCell(r.Data ?? r.data);
        if (!partener || !data) continue;
        const key = `${numar}||${partener}||${data}`;
        if (!groups.has(key)) {
          groups.set(key, {
            header: {
              tip_document: String(r.TipDocument ?? r.tip_document ?? "").trim() || null,
              serie: String(r.Serie ?? r.serie ?? "").trim() || null,
              numar: numar || null,
              data,
              partener,
            },
            lines: []
          });
        }
        groups.get(key)!.lines.push({
          denumire_articol: String(r.DenumireArticol ?? r.denumire_articol ?? "").trim(),
          descriere_articol: String(r.DescriereArticol ?? r.descriere_articol ?? "").trim() || null,
          cantitate: num(r.CantitateArticol ?? r.cantitate),
          pret_final: num(r.PretFinal ?? r.pret_final),
          palet: num(r.palet ?? r.Palet),
          valoare_neta: num(r.ValoareNeta ?? r.valoare_neta),
        });
      }

      let inserted = 0;
      for (const [, g] of groups) {
        const totalValue = g.lines.reduce((s, l) => s + (l.valoare_neta || l.cantitate * l.pret_final), 0);
        const { data: orderData, error: orderErr } = await (supabase as any)
          .from("purchase_orders_imported")
          .insert({
            inventory_type: inventoryType,
            source: "excel",
            ...g.header,
            total_value: totalValue,
            total_lines: g.lines.length,
          })
          .select("id")
          .single();
        if (orderErr) { console.error(orderErr); continue; }
        const orderId = orderData.id;
        const itemsToInsert = g.lines.filter(l => l.denumire_articol).map(l => ({ ...l, order_id: orderId }));
        if (itemsToInsert.length) {
          const { error: itErr } = await (supabase as any)
            .from("purchase_orders_imported_items")
            .insert(itemsToInsert);
          if (itErr) console.error(itErr);
        }
        inserted++;
      }

      toast({ title: `Import reușit`, description: `${inserted} comenzi importate` });
      await fetchOrders();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Eroare la import", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ===== MANUAL CREATE =====
  const addManualItem = () => setMItems(p => [...p, { denumire_articol: "", descriere_articol: "", cantitate: 0, pret_final: 0, palet: 0, valoare_neta: 0 }]);
  const updateManualItem = (i: number, patch: Partial<ItemRow>) => {
    setMItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      // Auto-compute valoare_neta if user changed qty/price
      if ("cantitate" in patch || "pret_final" in patch) {
        next.valoare_neta = +(next.cantitate * next.pret_final).toFixed(2);
      }
      return next;
    }));
  };
  const removeManualItem = (i: number) => setMItems(p => p.filter((_, idx) => idx !== i));

  const resetManual = () => {
    setMPartener(""); setMData(new Date()); setMSerie("CF"); setMNumar(""); setMNotes("");
    setMItems([{ denumire_articol: "", descriere_articol: "", cantitate: 0, pret_final: 0, palet: 0, valoare_neta: 0 }]);
  };

  const saveManual = async () => {
    if (!mPartener.trim()) { toast({ title: "Partener obligatoriu", variant: "destructive" }); return; }
    const validItems = mItems.filter(it => it.denumire_articol.trim());
    if (validItems.length === 0) { toast({ title: "Adaugă cel puțin un articol", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const totalValue = validItems.reduce((s, l) => s + (l.valoare_neta || l.cantitate * l.pret_final), 0);
      const { data: order, error } = await (supabase as any)
        .from("purchase_orders_imported")
        .insert({
          inventory_type: inventoryType,
          source: "manual",
          tip_document: "Comandă manuală",
          serie: mSerie || null,
          numar: mNumar || null,
          data: format(mData, "yyyy-MM-dd"),
          partener: mPartener.trim(),
          total_value: totalValue,
          total_lines: validItems.length,
          notes: mNotes || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itErr } = await (supabase as any)
        .from("purchase_orders_imported_items")
        .insert(validItems.map(it => ({ ...it, order_id: order.id })));
      if (itErr) throw itErr;
      toast({ title: "Comandă salvată" });
      setShowCreate(false);
      resetManual();
      await fetchOrders();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Eroare la salvare", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Ștergi această comandă?")) return;
    const { error } = await (supabase as any).from("purchase_orders_imported").delete().eq("id", id);
    if (error) { toast({ title: "Eroare", variant: "destructive" }); return; }
    toast({ title: "Comandă ștearsă" });
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  // ===== FILTER + GROUP =====
  const partners = useMemo(
    () => Array.from(new Set(orders.map(o => o.partener))).sort(),
    [orders]
  );

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (partnerFilter !== "all" && o.partener !== partnerFilter) return false;
      if (dateRange?.from && new Date(o.data) < dateRange.from) return false;
      if (dateRange?.to && new Date(o.data) > dateRange.to) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!o.partener.toLowerCase().includes(q) &&
            !(o.numar || "").toLowerCase().includes(q) &&
            !(o.serie || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [orders, partnerFilter, dateRange, search]);

  // Group by partener + data → un card = 1 furnizor pe 1 zi
  const grouped = useMemo(() => {
    const m = new Map<string, { partener: string; data: string; items: OrderRow[] }>();
    filtered.forEach(o => {
      const key = `${o.partener}||${o.data}`;
      if (!m.has(key)) m.set(key, { partener: o.partener, data: o.data, items: [] });
      m.get(key)!.items.push(o);
    });
    return Array.from(m.values())
      .map(g => ({
        ...g,
        total: g.items.reduce((s, i) => s + (Number(i.total_value) || 0), 0),
        count: g.items.length,
      }))
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.partener.localeCompare(b.partener)));
  }, [filtered]);

  // Auto-fetch items pentru toate comenzile vizibile (afișare directă, fără click)
  useEffect(() => {
    const missing = filtered.filter(o => !itemsByOrder[o.id]).map(o => o.id);
    if (missing.length === 0) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("purchase_orders_imported_items")
        .select("*")
        .in("order_id", missing)
        .order("created_at", { ascending: true });
      if (error) { console.error(error); return; }
      const byOrder: Record<string, ItemRow[]> = {};
      (data || []).forEach((it: any) => {
        if (!byOrder[it.order_id]) byOrder[it.order_id] = [];
        byOrder[it.order_id].push(it);
      });
      setItemsByOrder(prev => ({ ...prev, ...byOrder }));
    })();
  }, [filtered]);

  const deleteGroup = async (items: OrderRow[]) => {
    if (!confirm(`Ștergi toate cele ${items.length} comenzi pentru ${items[0].partener} din ${format(new Date(items[0].data), "dd MMM yyyy", { locale: ro })}?`)) return;
    const ids = items.map(i => i.id);
    const { error } = await (supabase as any).from("purchase_orders_imported").delete().in("id", ids);
    if (error) { toast({ title: "Eroare la ștergere", variant: "destructive" }); return; }
    toast({ title: `${items.length} comenzi șterse` });
    setOrders(prev => prev.filter(o => !ids.includes(o.id)));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Comenzi achiziții</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Comenzi manuale și importate din Excel, grupate pe partener.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Import Excel
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> Comandă nouă
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Caută partener / nr. comandă..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger><SelectValue placeholder="Filtrează partener" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">Toți partenerii</SelectItem>
                {partners.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <DatePickerWithRange date={dateRange} setDate={setDateRange} className="flex-1" />
              {dateRange && (
                <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{filtered.length}</div>
              <div className="text-xs text-muted-foreground">Comenzi</div>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{grouped.length}</div>
              <div className="text-xs text-muted-foreground">Parteneri</div>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">
                {filtered.reduce((s, o) => s + (Number(o.total_value) || 0), 0).toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground">Valoare totală</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nicio comandă încă. Importă din Excel sau creează manual.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(g => {
            const groupKey = `${g.partener}||${g.data}`;
            const collapsed = collapsedPartners.has(groupKey);
            return (
              <Card key={groupKey}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                      onClick={() => togglePartner(groupKey)}
                    >
                      {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                      <CardTitle className="text-base truncate">{g.partener}</CardTitle>
                      <Badge variant="outline" className="shrink-0">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {format(new Date(g.data), "dd MMM yyyy", { locale: ro })}
                      </Badge>
                      <Badge variant="secondary" className="shrink-0">{g.count} {g.count === 1 ? "comandă" : "comenzi"}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">
                        {g.total.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} lei
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteGroup(g.items)}
                        title="Șterge toate comenzile din această zi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {!collapsed && (
                  <CardContent className="pt-0 space-y-3">
                    {g.items.map(o => {
                      const items = itemsByOrder[o.id];
                      return (
                        <div key={o.id} className="border rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30">
                            <div className="flex items-center gap-2 flex-wrap text-sm">
                              {o.tip_document && <span className="text-muted-foreground text-xs">{o.tip_document}</span>}
                              <span className="font-medium">{o.serie || ""} {o.numar || ""}</span>
                              <Badge variant={o.source === "excel" ? "outline" : "secondary"} className="text-xs">
                                {o.source === "excel" ? "Excel" : "Manual"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {o.total_lines} {o.total_lines === 1 ? "articol" : "articole"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">
                                {Number(o.total_value).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} lei
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteOrder(o.id)}
                                title="Șterge această comandă"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {!items ? (
                            <div className="text-center py-3"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
                          ) : items.length === 0 ? (
                            <div className="text-center text-muted-foreground py-2 text-sm">Fără articole.</div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">Nr.</TableHead>
                                  <TableHead>Denumire articol</TableHead>
                                  <TableHead>Descriere</TableHead>
                                  <TableHead className="text-right">Cantitate</TableHead>
                                  <TableHead className="text-right">Preț</TableHead>
                                  <TableHead className="text-right">Palet</TableHead>
                                  <TableHead className="text-right">Valoare netă</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((it, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                    <TableCell className="font-medium">{it.denumire_articol}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{it.descriere_articol || "-"}</TableCell>
                                    <TableCell className="text-right">{Number(it.cantitate).toLocaleString("ro-RO", { maximumFractionDigits: 3 })}</TableCell>
                                    <TableCell className="text-right">{Number(it.pret_final).toLocaleString("ro-RO", { maximumFractionDigits: 4 })}</TableCell>
                                    <TableCell className="text-right">{Number(it.palet).toLocaleString("ro-RO")}</TableCell>
                                    <TableCell className="text-right font-medium">{Number(it.valoare_neta).toLocaleString("ro-RO", { maximumFractionDigits: 2 })}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE MANUAL DIALOG */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) resetManual(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Comandă nouă (manuală)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Partener *</label>
                <Input value={mPartener} onChange={(e) => setMPartener(e.target.value)} placeholder="Nume furnizor" />
              </div>
              <div>
                <label className="text-sm font-medium">Data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {format(mData, "dd MMM yyyy", { locale: ro })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={mData} onSelect={(d) => d && setMData(d)} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium">Serie</label>
                <Input value={mSerie} onChange={(e) => setMSerie(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Număr</label>
                <Input value={mNumar} onChange={(e) => setMNumar(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Articole</label>
                <Button size="sm" variant="outline" onClick={addManualItem}>
                  <Plus className="h-4 w-4 mr-1" /> Adaugă rând
                </Button>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Articol</TableHead>
                      <TableHead>Descriere</TableHead>
                      <TableHead className="w-24">Cant.</TableHead>
                      <TableHead className="w-24">Preț</TableHead>
                      <TableHead className="w-20">Palet</TableHead>
                      <TableHead className="w-28">Valoare</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mItems.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell><Input value={it.denumire_articol} onChange={(e) => updateManualItem(i, { denumire_articol: e.target.value })} /></TableCell>
                        <TableCell><Input value={it.descriere_articol || ""} onChange={(e) => updateManualItem(i, { descriere_articol: e.target.value })} /></TableCell>
                        <TableCell><Input type="number" value={it.cantitate} onChange={(e) => updateManualItem(i, { cantitate: num(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" value={it.pret_final} onChange={(e) => updateManualItem(i, { pret_final: num(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" value={it.palet} onChange={(e) => updateManualItem(i, { palet: num(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" value={it.valoare_neta} onChange={(e) => updateManualItem(i, { valoare_neta: num(e.target.value) })} /></TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeManualItem(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Note</label>
              <Input value={mNotes} onChange={(e) => setMNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Anulează</Button>
            <Button onClick={saveManual} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Salvează comanda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImportedOrders;
