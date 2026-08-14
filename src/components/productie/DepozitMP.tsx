import React, { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, FileDown, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Intrare = {
  id: string;
  occurred_at: string;
  produs_nume: string;
  cantitate: number;
  unitate: string;
  lot?: string | null;
  furnizor?: string | null;
  document?: string | null;
  observatii?: string | null;
};

type Iesire = {
  id: string;
  occurred_at: string;
  produs_nume: string;
  cantitate: number;
  unitate: string;
  lot?: string | null;
  client?: string | null;
  document?: string | null;
  observatii?: string | null;
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

// Lot automat: nr. săptămână ISO (2 cifre) + nr. zi din săptămână pe 2 cifre (01 = luni ... 07 = duminică)
export const autoLot = (date: Date) => {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${String(week).padStart(2, "0")}${String(dayNum).padStart(2, "0")}`;
};

/* ---------------- stock computation ---------------- */

export type StockLot = {
  lot: string;
  intrat: number;
  iesit: number;
  stoc: number;
  prima: string | null;
  ultima: string | null;
};

export type StockRow = {
  produs_nume: string;
  unitate: string;
  intrat: number;
  iesit: number;
  stoc: number;
  prima: string | null;
  ultima: string | null;
  loturi: StockLot[];
};

export const computeStock = (
  intrari: { produs_nume: string; unitate?: string | null; cantitate: number; lot?: string | null; occurred_at: string }[],
  iesiri: { produs_nume: string; unitate?: string | null; cantitate: number; lot?: string | null; occurred_at: string }[]
): StockRow[] => {
  const map = new Map<string, StockRow>();
  const get = (name: string, unit: string) => {
    const key = `${name}|${unit}`;
    if (!map.has(key))
      map.set(key, {
        produs_nume: name,
        unitate: unit,
        intrat: 0,
        iesit: 0,
        stoc: 0,
        prima: null,
        ultima: null,
        loturi: [],
      });
    return map.get(key)!;
  };
  const getLot = (row: StockRow, lot: string) => {
    let l = row.loturi.find((x) => x.lot === lot);
    if (!l) {
      l = { lot, intrat: 0, iesit: 0, stoc: 0, prima: null, ultima: null };
      row.loturi.push(l);
    }
    return l;
  };

  intrari.forEach((r) => {
    const e = get(r.produs_nume, r.unitate || "bucati");
    const qty = Number(r.cantitate || 0);
    e.intrat += qty;
    if (!e.prima || r.occurred_at < e.prima) e.prima = r.occurred_at;
    if (!e.ultima || r.occurred_at > e.ultima) e.ultima = r.occurred_at;
    const l = getLot(e, r.lot || "-");
    l.intrat += qty;
    if (!l.prima || r.occurred_at < l.prima) l.prima = r.occurred_at;
    if (!l.ultima || r.occurred_at > l.ultima) l.ultima = r.occurred_at;
  });
  iesiri.forEach((r) => {
    const e = get(r.produs_nume, r.unitate || "bucati");
    const qty = Number(r.cantitate || 0);
    e.iesit += qty;
    getLot(e, r.lot || "-").iesit += qty;
  });

  return Array.from(map.values())
    .map((e) => ({
      ...e,
      stoc: e.intrat - e.iesit,
      loturi: e.loturi
        .map((l) => ({ ...l, stoc: l.intrat - l.iesit }))
        .sort((a, b) => a.lot.localeCompare(b.lot)),
    }))
    .sort((a, b) => a.produs_nume.localeCompare(b.produs_nume));
};

/* ---------------- data hooks ---------------- */

const useNomenclatoare = () =>
  useQuery({
    queryKey: ["depozit-mp-nomenclatoare"],
    queryFn: async () => {
      const [{ data: produse }, { data: clienti }] = await Promise.all([
        supabase
          .from("productie_produse")
          .select("id, nume, unitate_masura")
          .order("nume"),
        supabase
          .from("productie_clienti")
          .select("id, nume_magazin, punct_livrare, nickname")
          .order("nume_magazin"),
      ]);
      return {
        produse: (produse || []) as any[],
        clienti: (clienti || []) as any[],
      };
    },
    staleTime: 5 * 60 * 1000,
  });


const useIntrari = () =>
  useQuery({
    queryKey: ["depozit-mp-intrari"],
    queryFn: async () => {
      const { data, error } = await supabaseCloud
        .from("depozit_mp_intrari")
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Intrare[];
    },
  });

const useIesiri = () =>
  useQuery({
    queryKey: ["depozit-mp-iesiri"],
    queryFn: async () => {
      const { data, error } = await supabaseCloud
        .from("depozit_mp_iesiri")
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Iesire[];
    },
  });

/* ---------------- pagination ---------------- */

const Paginator = ({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
      <span className="text-muted-foreground">
        {total} înregistrări · pagina {page} / {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {[25, 50, 100, 200].map((s) => (
            <option key={s} value={s}>
              {s} / pagină
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Înapoi
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Înainte
        </Button>
      </div>
    </div>
  );
};

const exportExcel = (rows: any[], filename: string, sheet = "Raport") => {
  if (!rows.length) {
    toast.error("Nu există date de exportat");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, filename);
};

/* ---------------- movement dialog ---------------- */

const MovementDialog = ({
  open,
  onOpenChange,
  type,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: "intrare" | "iesire";
}) => {
  const qc = useQueryClient();
  const { data: nom } = useNomenclatoare();
  const { data: intrari = [] } = useIntrari();
  const { data: iesiri = [] } = useIesiri();
  const [form, setForm] = useState({
    occurred_at: toLocalInput(new Date()),
    produs_nume: "",
    cantitate: "",
    unitate: "bucati",
    partener: "",
    observatii: "",
    lot_sel: "",
  });

  const reset = () =>
    setForm({
      occurred_at: toLocalInput(new Date()),
      produs_nume: "",
      cantitate: "",
      unitate: "bucati",
      partener: "",
      observatii: "",
      lot_sel: "",
    });

  const stock = useMemo(
    () => computeStock(intrari as any, iesiri as any).filter((s) => s.stoc > 0),
    [intrari, iesiri]
  );
  const stockForProduct = useMemo(
    () => stock.find((s) => s.produs_nume === form.produs_nume.trim()),
    [stock, form.produs_nume]
  );
  const lotsAvailable = useMemo(
    () => (stockForProduct?.loturi || []).filter((l) => l.stoc > 0),
    [stockForProduct]
  );
  const selectedLot = useMemo(
    () =>
      lotsAvailable.find((l) => l.lot === form.lot_sel) ||
      lotsAvailable[0] ||
      null,
    [lotsAvailable, form.lot_sel]
  );

  const autoLotValue = useMemo(
    () => autoLot(form.occurred_at ? new Date(form.occurred_at) : new Date()),
    [form.occurred_at]
  );
  const lot = type === "intrare" ? autoLotValue : selectedLot?.lot || "";

  const save = useMutation({
    mutationFn: async () => {
      if (!form.produs_nume.trim()) throw new Error("Alege produsul");
      const qty = Number(form.cantitate);
      if (!qty || qty <= 0) throw new Error("Cantitatea trebuie să fie > 0");

      if (type === "iesire") {
        if (!stockForProduct)
          throw new Error("Produsul nu există în stocul depozitului");
        if (!selectedLot) throw new Error("Alege lotul din care scoți marfa");
        if (qty > selectedLot.stoc)
          throw new Error(
            `Stoc insuficient pe lotul ${selectedLot.lot}: disponibil ${selectedLot.stoc}`
          );
      }

      const base = {
        occurred_at: new Date(form.occurred_at).toISOString(),
        produs_nume: form.produs_nume.trim(),
        cantitate: qty,
        unitate:
          (type === "iesire" ? stockForProduct?.unitate : form.unitate) ||
          form.unitate ||
          "bucati",
        lot,
        observatii: form.observatii || null,
      };
      const table =
        type === "intrare" ? "depozit_mp_intrari" : "depozit_mp_iesiri";
      const payload =
        type === "intrare"
          ? base
          : { ...base, client: form.partener || null };

      const { error } = await supabaseCloud.from(table).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depozit-mp-intrari"] });
      qc.invalidateQueries({ queryKey: ["depozit-mp-iesiri"] });
      toast.success(
        type === "intrare" ? "Intrare înregistrată" : "Ieșire înregistrată"
      );
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {type === "intrare"
              ? "Adaugă intrare în depozit MP"
              : "Adaugă ieșire din depozit MP"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data și ora</Label>
              <Input
                type="datetime-local"
                value={form.occurred_at}
                onChange={(e) =>
                  setForm({ ...form, occurred_at: e.target.value })
                }
              />
            </div>
            <div>
              <Label>
                {type === "intrare" ? "Lot (automat)" : "Lot din stoc"}
              </Label>
              {type === "intrare" ? (
                <Input value={lot} readOnly className="bg-muted" />
              ) : (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedLot?.lot || ""}
                  onChange={(e) =>
                    setForm({ ...form, lot_sel: e.target.value })
                  }
                  disabled={lotsAvailable.length === 0}
                >
                  {lotsAvailable.length === 0 && (
                    <option value="">Fără stoc</option>
                  )}
                  {lotsAvailable.map((l) => (
                    <option key={l.lot} value={l.lot}>
                      {l.lot} ({l.stoc.toLocaleString("ro-RO")})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <Label>Produs</Label>
            <Input
              list="depozit-mp-produse"
              value={form.produs_nume}
              onChange={(e) => {
                const name = e.target.value;
                const s = stock.find((x) => x.produs_nume === name);
                const p = (nom?.produse || []).find(
                  (x: any) => x.nume === name
                );
                setForm((f) => ({
                  ...f,
                  produs_nume: name,
                  lot_sel: "",
                  unitate:
                    (type === "iesire" ? s?.unitate : p?.unitate_masura) ||
                    p?.unitate_masura ||
                    f.unitate,
                }));
              }}
              placeholder={
                type === "intrare"
                  ? "Caută produs finit..."
                  : "Caută produs din stoc..."
              }
            />
            <datalist id="depozit-mp-produse">
              {type === "intrare"
                ? (nom?.produse || []).map((p: any) => (
                    <option key={p.id} value={p.nume} />
                  ))
                : stock.map((s) => (
                    <option
                      key={`${s.produs_nume}|${s.unitate}`}
                      value={s.produs_nume}
                    >
                      {`stoc ${s.stoc.toLocaleString("ro-RO")} ${s.unitate}`}
                    </option>
                  ))}
            </datalist>
            {type === "iesire" && form.produs_nume.trim() && !stockForProduct && (
              <p className="text-xs text-destructive mt-1">
                Acest produs nu există în stocul depozitului.
              </p>
            )}
            {type === "iesire" && selectedLot && (
              <p className="text-xs text-muted-foreground mt-1">
                Disponibil pe lot {selectedLot.lot}:{" "}
                {selectedLot.stoc.toLocaleString("ro-RO")}{" "}
                {stockForProduct?.unitate}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cantitate</Label>
              <Input
                type="number"
                step="1"
                value={form.cantitate}
                onChange={(e) =>
                  setForm({ ...form, cantitate: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Unitate</Label>
              <Input
                value={form.unitate}
                onChange={(e) => setForm({ ...form, unitate: e.target.value })}
              />
            </div>
          </div>

          {type === "iesire" && (
            <div>
              <Label>Client</Label>
              <Input
                list="depozit-mp-clienti"
                value={form.partener}
                onChange={(e) =>
                  setForm({ ...form, partener: e.target.value })
                }
                placeholder="Caută client..."
              />
              <datalist id="depozit-mp-clienti">
                {(nom?.clienti || []).map((c: any) => (
                  <option
                    key={c.id}
                    value={`${c.nume_magazin}${
                      c.punct_livrare ? ` - ${c.punct_livrare}` : ""
                    }`}
                  />
                ))}
              </datalist>
            </div>
          )}

          <div>
            <Label>Observații</Label>
            <Textarea
              rows={2}
              value={form.observatii}
              onChange={(e) =>
                setForm({ ...form, observatii: e.target.value })
              }
            />
          </div>
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- shared toolbar ---------------- */

const Toolbar = ({
  search,
  setSearch,
  onAddIntrare,
  onAddIesire,
  onExport,
}: {
  search: string;
  setSearch: (v: string) => void;
  onAddIntrare: () => void;
  onAddIesire: () => void;
  onExport: () => void;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="relative min-w-[220px] flex-1">
      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-8"
        placeholder="Caută produs, lot, document, partener..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
    <Button size="sm" onClick={onAddIntrare}>
      <Plus className="mr-1 h-4 w-4" /> Adaugă intrare
    </Button>
    <Button size="sm" variant="secondary" onClick={onAddIesire}>
      <Plus className="mr-1 h-4 w-4" /> Adaugă ieșire
    </Button>
    <Button size="sm" variant="outline" onClick={onExport}>
      <FileDown className="mr-1 h-4 w-4" /> Export Excel
    </Button>
  </div>
);

/* ---------------- main ---------------- */

const DepozitMP: React.FC = () => {
  const qc = useQueryClient();
  const { data: intrari = [], isLoading: loadingIn } = useIntrari();
  const { data: iesiri = [], isLoading: loadingOut } = useIesiri();

  const [dialog, setDialog] = useState<null | "intrare" | "iesire">(null);

  const [searchIn, setSearchIn] = useState("");
  const [pageIn, setPageIn] = useState(1);
  const [sizeIn, setSizeIn] = useState(25);

  const [searchOut, setSearchOut] = useState("");
  const [pageOut, setPageOut] = useState(1);
  const [sizeOut, setSizeOut] = useState(25);

  const [searchStock, setSearchStock] = useState("");
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [pageStock, setPageStock] = useState(1);
  const [sizeStock, setSizeStock] = useState(25);

  const del = useMutation({
    mutationFn: async ({
      table,
      id,
    }: {
      table: "depozit_mp_intrari" | "depozit_mp_iesiri";
      id: string;
    }) => {
      const { error } = await supabaseCloud.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depozit-mp-intrari"] });
      qc.invalidateQueries({ queryKey: ["depozit-mp-iesiri"] });
      toast.success("Înregistrare ștearsă");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const match = (row: any, q: string) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [
      row.produs_nume,
      row.lot,
      row.document,
      row.furnizor,
      row.client,
      row.observatii,
    ]
      .filter(Boolean)
      .some((v: string) => String(v).toLowerCase().includes(s));
  };

  const filteredIn = useMemo(
    () => intrari.filter((r) => match(r, searchIn)),
    [intrari, searchIn]
  );
  const filteredOut = useMemo(
    () => iesiri.filter((r) => match(r, searchOut)),
    [iesiri, searchOut]
  );

  const stock = useMemo(
    () =>
      computeStock(intrari as any, iesiri as any).filter((e) =>
        !searchStock.trim()
          ? true
          : e.produs_nume.toLowerCase().includes(searchStock.toLowerCase())
      ),
    [intrari, iesiri, searchStock]
  );

  const page = <T,>(rows: T[], p: number, s: number) =>
    rows.slice((p - 1) * s, p * s);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="intrari" className="w-full">
        <TabsList>
          <TabsTrigger value="intrari">Intrare în depozit</TabsTrigger>
          <TabsTrigger value="stoc">Stoc depozit MP</TabsTrigger>
          <TabsTrigger value="iesiri">Ieșire din depozit MP</TabsTrigger>
        </TabsList>

        {/* INTRARI */}
        <TabsContent value="intrari">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Istoric intrări</CardTitle>
              <Toolbar
                search={searchIn}
                setSearch={(v) => {
                  setSearchIn(v);
                  setPageIn(1);
                }}
                onAddIntrare={() => setDialog("intrare")}
                onAddIesire={() => setDialog("iesire")}
                onExport={() =>
                  exportExcel(
                    filteredIn.map((r) => ({
                      Data: fmtDate(r.occurred_at),
                      Produs: r.produs_nume,
                      Cantitate: Number(r.cantitate || 0),
                      UM: r.unitate,
                      Lot: r.lot || "",
                      Observații: r.observatii || "",
                    })),
                    "intrari-depozit-mp.xlsx",
                    "Intrari"
                  )
                }
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data / ora</TableHead>
                      <TableHead>Produs</TableHead>
                      <TableHead className="text-right">Cantitate</TableHead>
                      <TableHead>Lot</TableHead>
                      <TableHead>Observații</TableHead>
                      <TableHead />


                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingIn && (
                      <TableRow>
                        <TableCell colSpan={6}>Se încarcă...</TableCell>
                      </TableRow>
                    )}
                    {!loadingIn && filteredIn.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-muted-foreground"
                        >
                          Nicio intrare înregistrată.
                        </TableCell>
                      </TableRow>
                    )}
                    {page(filteredIn, pageIn, sizeIn).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {fmtDate(r.occurred_at)}
                        </TableCell>
                        <TableCell>{r.produs_nume}</TableCell>
                        <TableCell className="text-right">
                          {Number(r.cantitate).toLocaleString("ro-RO")}{" "}
                          {r.unitate}
                        </TableCell>
                        <TableCell>{r.lot || "-"}</TableCell>
                        <TableCell>{r.observatii || "-"}</TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              del.mutate({
                                table: "depozit_mp_intrari",
                                id: r.id,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Paginator
                page={pageIn}
                pageSize={sizeIn}
                total={filteredIn.length}
                onPage={setPageIn}
                onPageSize={(s) => {
                  setSizeIn(s);
                  setPageIn(1);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* STOC */}
        <TabsContent value="stoc">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stoc depozit MP</CardTitle>
              <Toolbar
                search={searchStock}
                setSearch={(v) => {
                  setSearchStock(v);
                  setPageStock(1);
                }}
                onAddIntrare={() => setDialog("intrare")}
                onAddIesire={() => setDialog("iesire")}
                onExport={() =>
                  exportExcel(
                    stock.map((r) => ({
                      Produs: r.produs_nume,
                      UM: r.unitate,
                      Intrat: r.intrat,
                      Ieșit: r.iesit,
                      Stoc: r.stoc,
                      "Prima intrare": r.prima ? fmtDate(r.prima) : "",
                      "Ultima intrare": r.ultima ? fmtDate(r.ultima) : "",
                    })),
                    "stoc-depozit-mp.xlsx",
                    "Stoc"
                  )
                }
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Produs</TableHead>
                      <TableHead className="text-right">Loturi</TableHead>
                      <TableHead className="text-right">Intrat</TableHead>
                      <TableHead className="text-right">Ieșit</TableHead>
                      <TableHead className="text-right">Stoc</TableHead>
                      <TableHead>Prima intrare</TableHead>
                      <TableHead>Ultima intrare</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stock.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-muted-foreground"
                        >
                          Nu există stoc înregistrat.
                        </TableCell>
                      </TableRow>
                    )}
                    {page(stock, pageStock, sizeStock).map((r) => {
                      const key = `${r.produs_nume}|${r.unitate}`;
                      const open = expandedStock === key;
                      const loturiCuStoc = r.loturi.filter((l) => l.stoc !== 0);
                      return (
                        <React.Fragment key={key}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() =>
                              setExpandedStock(open ? null : key)
                            }
                          >
                            <TableCell className="w-8 text-muted-foreground">
                              {open ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell>{r.produs_nume}</TableCell>
                            <TableCell className="text-right">
                              {loturiCuStoc.length}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.intrat.toLocaleString("ro-RO")} {r.unitate}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.iesit.toLocaleString("ro-RO")} {r.unitate}
                            </TableCell>
                            <TableCell
                              className={`text-right font-semibold ${
                                r.stoc <= 0 ? "text-destructive" : ""
                              }`}
                            >
                              {r.stoc.toLocaleString("ro-RO")} {r.unitate}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {r.prima ? fmtDate(r.prima) : "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {r.ultima ? fmtDate(r.ultima) : "-"}
                            </TableCell>
                          </TableRow>
                          {open && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={8} className="p-0">
                                <div className="p-3">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Lot</TableHead>
                                        <TableHead className="text-right">
                                          Intrat
                                        </TableHead>
                                        <TableHead className="text-right">
                                          Ieșit
                                        </TableHead>
                                        <TableHead className="text-right">
                                          Stoc
                                        </TableHead>
                                        <TableHead>Prima intrare</TableHead>
                                        <TableHead>Ultima intrare</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {r.loturi.map((l) => (
                                        <TableRow key={l.lot}>
                                          <TableCell className="font-mono">
                                            {l.lot}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {l.intrat.toLocaleString("ro-RO")}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {l.iesit.toLocaleString("ro-RO")}
                                          </TableCell>
                                          <TableCell
                                            className={`text-right font-semibold ${
                                              l.stoc <= 0
                                                ? "text-muted-foreground"
                                                : ""
                                            }`}
                                          >
                                            {l.stoc.toLocaleString("ro-RO")}{" "}
                                            {r.unitate}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap">
                                            {l.prima ? fmtDate(l.prima) : "-"}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap">
                                            {l.ultima ? fmtDate(l.ultima) : "-"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Paginator
                page={pageStock}
                pageSize={sizeStock}
                total={stock.length}
                onPage={setPageStock}
                onPageSize={(s) => {
                  setSizeStock(s);
                  setPageStock(1);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* IESIRI */}
        <TabsContent value="iesiri">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ieșiri din depozit MP</CardTitle>
              <Toolbar
                search={searchOut}
                setSearch={(v) => {
                  setSearchOut(v);
                  setPageOut(1);
                }}
                onAddIntrare={() => setDialog("intrare")}
                onAddIesire={() => setDialog("iesire")}
                onExport={() =>
                  exportExcel(
                    filteredOut.map((r) => ({
                      Data: fmtDate(r.occurred_at),
                      Produs: r.produs_nume,
                      Cantitate: Number(r.cantitate || 0),
                      UM: r.unitate,
                      Lot: r.lot || "",
                      Client: r.client || "",
                      Document: r.document || "",
                      Observații: r.observatii || "",
                    })),
                    "iesiri-depozit-mp.xlsx",
                    "Iesiri"
                  )
                }
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data / ora</TableHead>
                      <TableHead>Produs</TableHead>
                      <TableHead className="text-right">Cantitate</TableHead>
                      <TableHead>Lot</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingOut && (
                      <TableRow>
                        <TableCell colSpan={7}>Se încarcă...</TableCell>
                      </TableRow>
                    )}
                    {!loadingOut && filteredOut.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-muted-foreground"
                        >
                          Nicio ieșire înregistrată.
                        </TableCell>
                      </TableRow>
                    )}
                    {page(filteredOut, pageOut, sizeOut).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {fmtDate(r.occurred_at)}
                        </TableCell>
                        <TableCell>{r.produs_nume}</TableCell>
                        <TableCell className="text-right">
                          {Number(r.cantitate).toLocaleString("ro-RO")}{" "}
                          {r.unitate}
                        </TableCell>
                        <TableCell>{r.lot || "-"}</TableCell>
                        <TableCell>{r.client || "-"}</TableCell>
                        <TableCell>{r.document || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              del.mutate({
                                table: "depozit_mp_iesiri",
                                id: r.id,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Paginator
                page={pageOut}
                pageSize={sizeOut}
                total={filteredOut.length}
                onPage={setPageOut}
                onPageSize={(s) => {
                  setSizeOut(s);
                  setPageOut(1);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MovementDialog
        open={dialog === "intrare"}
        onOpenChange={(v) => setDialog(v ? "intrare" : null)}
        type="intrare"
      />
      <MovementDialog
        open={dialog === "iesire"}
        onOpenChange={(v) => setDialog(v ? "iesire" : null)}
        type="iesire"
      />
    </div>
  );
};

export default DepozitMP;
