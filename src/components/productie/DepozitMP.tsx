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
import { Plus, Search, FileDown, Trash2 } from "lucide-react";
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

// Lot automat: nr. săptămână ISO (2 cifre) + nr. zi din săptămână (1 = luni ... 7 = duminică)
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
  return `${String(week).padStart(2, "0")}${dayNum}`;
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
  const [form, setForm] = useState({
    occurred_at: toLocalInput(new Date()),
    produs_nume: "",
    cantitate: "",
    unitate: "bucati",
    partener: "",
    observatii: "",
  });

  const reset = () =>
    setForm({
      occurred_at: toLocalInput(new Date()),
      produs_nume: "",
      cantitate: "",
      unitate: "bucati",
      partener: "",
      observatii: "",
    });

  const lot = useMemo(
    () => autoLot(form.occurred_at ? new Date(form.occurred_at) : new Date()),
    [form.occurred_at]
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!form.produs_nume.trim()) throw new Error("Alege produsul");
      const qty = Number(form.cantitate);
      if (!qty || qty <= 0) throw new Error("Cantitatea trebuie să fie > 0");

      const base = {
        occurred_at: new Date(form.occurred_at).toISOString(),
        produs_nume: form.produs_nume.trim(),
        cantitate: qty,
        unitate: form.unitate || "bucati",
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
              <Label>Lot (automat)</Label>
              <Input value={lot} readOnly className="bg-muted" />
            </div>
          </div>

          <div>
            <Label>Produs</Label>
            <Input
              list="depozit-mp-produse"
              value={form.produs_nume}
              onChange={(e) => {
                const name = e.target.value;
                const p = (nom?.produse || []).find(
                  (x: any) => x.nume === name
                );
                setForm((f) => ({
                  ...f,
                  produs_nume: name,
                  unitate: p?.unitate_masura || f.unitate,
                }));
              }}
              placeholder="Caută produs finit..."
            />
            <datalist id="depozit-mp-produse">
              {(nom?.produse || []).map((p: any) => (
                <option key={p.id} value={p.nume} />
              ))}
            </datalist>
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

  const stock = useMemo(() => {
    const map = new Map<
      string,
      {
        produs_nume: string;
        unitate: string;
        intrat: number;
        iesit: number;
        stoc: number;
        prima: string | null;
        ultima: string | null;
      }
    >();
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
        });
      return map.get(key)!;
    };
    intrari.forEach((r) => {
      const e = get(r.produs_nume, r.unitate || "kg");
      e.intrat += Number(r.cantitate || 0);
      if (!e.prima || r.occurred_at < e.prima) e.prima = r.occurred_at;
      if (!e.ultima || r.occurred_at > e.ultima) e.ultima = r.occurred_at;
    });
    iesiri.forEach((r) => {
      const e = get(r.produs_nume, r.unitate || "kg");
      e.iesit += Number(r.cantitate || 0);
    });
    return Array.from(map.values())
      .map((e) => ({ ...e, stoc: e.intrat - e.iesit }))
      .filter((e) =>
        !searchStock.trim()
          ? true
          : e.produs_nume.toLowerCase().includes(searchStock.toLowerCase())
      )
      .sort((a, b) => a.produs_nume.localeCompare(b.produs_nume));
  }, [intrari, iesiri, searchStock]);

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

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingIn && (
                      <TableRow>
                        <TableCell colSpan={7}>Se încarcă...</TableCell>
                      </TableRow>
                    )}
                    {!loadingIn && filteredIn.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
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
                        <TableCell>{r.furnizor || "-"}</TableCell>
                        <TableCell>{r.document || "-"}</TableCell>
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
                      <TableHead>Produs</TableHead>
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
                          colSpan={6}
                          className="text-muted-foreground"
                        >
                          Nu există stoc înregistrat.
                        </TableCell>
                      </TableRow>
                    )}
                    {page(stock, pageStock, sizeStock).map((r) => (
                      <TableRow key={`${r.produs_nume}|${r.unitate}`}>
                        <TableCell>{r.produs_nume}</TableCell>
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
                    ))}
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
