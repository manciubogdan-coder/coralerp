import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useCreateAdvanceOrdersBulk, useProducts } from "@/hooks/productie/useProductionData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Loader2, Plus, Trash2, CalendarClock, History, Grid3X3, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AvansProductPicker from "./AvansProductPicker";
import { useGrupareAmbalare } from "@/hooks/productie/useGrupareAmbalare";
import { buildGroupResolver, matrixFromHistory, type HistoryOrder } from "@/lib/productie/avansGrouping";

const WEEKDAYS = [
  { value: 1, label: "Luni" },
  { value: 2, label: "Marți" },
  { value: 3, label: "Miercuri" },
  { value: 4, label: "Joi" },
  { value: 5, label: "Vineri" },
  { value: 6, label: "Sâmbătă" },
  { value: 7, label: "Duminică" },
];

const todayBucharest = () => {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
  return new Date(`${s}T12:00:00`);
};
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

type GridItem = {
  produs_id: string | null;
  produs_nume: string;
  cantitate: number;
  linie_id: string | null;
  linie_nume: string | null;
  baxare?: string | null;
};

const cloud = supabaseCloud as any;

// Comenzile de avans din ultimele `days` zile (paginat, peste limita de 1000 rânduri).
const loadAvansHistory = async (fromIso: string): Promise<HistoryOrder[]> => {
  const out: HistoryOrder[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await supabase
      .from("productie_comenzi")
      .select("produs_id, linie_id, cantitate, data_productie, baxare, productie_produse(nume), productie_linii(nume)")
      .eq("magazin", "PRODUCTIE_AVANS")
      .gte("data_productie", fromIso)
      .order("id")
      .range(off, off + 999);
    if (error) throw error;
    for (const r of (data || []) as any[]) {
      if (!r.produs_id || !r.data_productie) continue;
      out.push({
        produs_id: r.produs_id, produs_nume: r.productie_produse?.nume ?? null,
        linie_id: r.linie_id ?? null, linie_nume: r.productie_linii?.nume ?? null,
        cantitate: Number(r.cantitate) || 0, data_productie: String(r.data_productie).slice(0, 10), baxare: r.baxare ?? null,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
};

const AdvanceAutomation = ({ onGenerated }: { onGenerated?: () => void }) => {
  const queryClient = useQueryClient();
  const { data: products } = useProducts();
  const createBulk = useCreateAdvanceOrdersBulk();
  const { data: grupMap } = useGrupareAmbalare();
  const productList = useMemo(() => ((products || []) as any[]).map((p) => ({ id: p.id as string, nume: String(p.nume || "") })), [products]);
  const groupOf = useMemo(() => buildGroupResolver(grupMap || {}, productList), [grupMap, productList]);
  const [recalc, setRecalc] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [targetDate, setTargetDate] = useState(() => isoDay(new Date(todayBucharest().getTime() + 86400000)));
  const [grid, setGrid] = useState<GridItem[]>([]);
  const [gridSource, setGridSource] = useState<string>("");
  const [building, setBuilding] = useState(false);

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["avans-settings"],
    queryFn: async () => {
      const { data } = await cloud.from("productie_avans_settings").select("*").eq("id", true).maybeSingle();
      return data as { auto_enabled: boolean; run_time: string } | null;
    },
  });

  const { data: matrix, refetch: refetchMatrix } = useQuery({
    queryKey: ["avans-matrix"],
    queryFn: async () => {
      const { data } = await cloud.from("productie_avans_matrix").select("*").order("position");
      return (data || []) as any[];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["avans-log"],
    queryFn: async () => {
      const { data } = await cloud.from("productie_avans_log").select("*").order("created_at", { ascending: false }).limit(50);
      return (data || []) as any[];
    },
  });

  const { data: lines } = useQuery({
    queryKey: ["avans-linii"],
    queryFn: async () => {
      const { data } = await supabase.from("productie_linii").select("id, nume").eq("status", "activa").order("nume");
      return (data || []) as { id: string; nume: string }[];
    },
  });

  const toggleAuto = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await cloud.from("productie_avans_settings").update({ auto_enabled: enabled, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: (_d, enabled) => {
      refetchSettings();
      toast.success(enabled
        ? "Generarea automată este ACTIVĂ — comenzile pentru ziua următoare se creează singure zilnic la 16:50."
        : "Generarea automată este OPRITĂ — revii la generare manuală cu butonul.");
    },
    onError: (e: any) => toast.error(`Nu am putut salva setarea: ${e.message}`),
  });

  const buildGrid = async () => {
    setBuilding(true);
    try {
      const target = new Date(`${targetDate}T12:00:00`);
      const wd = isoWeekday(target);
      const rows = (matrix || []).filter((m) => m.weekday === wd);
      let items: GridItem[] = [];
      if (rows.length > 0) {
        items = rows.map((r) => ({
          produs_id: r.produs_id, produs_nume: r.produs_nume, cantitate: Number(r.cantitate),
          linie_id: r.linie_id, linie_nume: r.linie_nume, baxare: r.baxare,
        }));
        setGridSource(`matricea de ${WEEKDAYS.find((w) => w.value === wd)?.label}`);
      } else {
        // Fallback: media istoricului pe aceeași zi a săptămânii, ultimele 8 săptămâni, pe grupe de produse
        const from = isoDay(new Date(target.getTime() - 56 * 86400000));
        const hist = (await loadAvansHistory(from)).filter((o) => o.data_productie < targetDate);
        items = matrixFromHistory(hist, groupOf)
          .filter((r) => r.weekday === wd)
          .map((r) => ({ produs_id: r.produs_id, produs_nume: r.produs_nume, cantitate: r.cantitate, linie_id: r.linie_id, linie_nume: r.linie_nume, baxare: r.baxare }));
        setGridSource(`istoricul ultimelor 8 săptămâni (${WEEKDAYS.find((w) => w.value === wd)?.label})`);
      }
      setGrid(items);
      setGenOpen(true);
      if (items.length === 0) toast.info("Nu am găsit nimic de generat pentru ziua aleasă — adaugă rânduri manual în grilă sau în matrice.");
    } catch (e: any) {
      toast.error(`Eroare la generarea grilei: ${e.message}`);
    } finally {
      setBuilding(false);
    }
  };

  const confirmGrid = async () => {
    const valid = grid.filter((g) => g.produs_id && g.cantitate > 0);
    if (valid.length === 0) { toast.error("Grila nu are rânduri valide (produs + cantitate)."); return; }
    try {
      const created = await createBulk.mutateAsync(valid.map((g) => ({
        produs_id: g.produs_id!, cantitate: g.cantitate, baxare: g.baxare || undefined,
        linie_id: g.linie_id, data_productie: targetDate,
      })));
      await cloud.from("productie_avans_log").insert({
        target_date: targetDate, source: "manual", orders_created: created.length,
        details: { sursa: gridSource, items: valid.map((g) => ({ produs: g.produs_nume, cantitate: g.cantitate, linie: g.linie_nume })) },
      });
      queryClient.invalidateQueries({ queryKey: ["avans-log"] });
      toast.success(`${created.length} comenzi de producție în avans create pentru ${targetDate}.`);
      setGenOpen(false);
      onGenerated?.();
    } catch (e: any) {
      toast.error(`Eroare la crearea comenzilor: ${e.message}`);
    }
  };

  const updateGridRow = (idx: number, patch: Partial<GridItem>) =>
    setGrid((g) => g.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const addMatrixRow = async (weekday: number) => {
    const { error } = await cloud.from("productie_avans_matrix").insert({ weekday, produs_nume: "", cantitate: 100, position: (matrix || []).filter((m) => m.weekday === weekday).length + 1 });
    if (error) toast.error(error.message); else refetchMatrix();
  };
  const updateMatrixRow = async (id: string, patch: any) => {
    // Actualizăm local imediat, fără să reîncărcăm toată matricea
    queryClient.setQueryData(["avans-matrix"], (old: any[] | undefined) => (old || []).map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const { error } = await cloud.from("productie_avans_matrix").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); refetchMatrix(); }
  };
  const pickMatrixProduct = (row: any, p: { id: string; nume: string }) => {
    const g = groupOf(p.id, p.nume);
    const dup = (matrix || []).find((m) => m.weekday === row.weekday && m.id !== row.id && groupOf(m.produs_id, m.produs_nume).toLowerCase() === g.toLowerCase());
    if (dup) {
      toast.error(`„${g}" există deja în ziua aceasta (${dup.produs_nume}). Modifică cantitatea acolo.`);
      return;
    }
    updateMatrixRow(row.id, { produs_id: p.id, produs_nume: p.nume });
  };
  const recalcFromHistory = async () => {
    if (!window.confirm("Recalculez toată matricea (Luni–Duminică) din istoricul ultimelor 10 săptămâni, câte un rând pe grupă de produs? Modificările manuale din matrice se vor înlocui.")) return;
    setRecalc(true);
    try {
      const from = isoDay(new Date(todayBucharest().getTime() - 70 * 86400000));
      const hist = await loadAvansHistory(from);
      const rows = matrixFromHistory(hist, groupOf);
      if (!rows.length) { toast.error("Nu am găsit istoric de producție în avans."); return; }
      const { error: delErr } = await cloud.from("productie_avans_matrix").delete().gte("weekday", 1).lte("weekday", 7);
      if (delErr) throw delErr;
      const payload = rows.map(({ grup, ...r }) => r);
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await cloud.from("productie_avans_matrix").insert(payload.slice(i, i + 200));
        if (error) throw error;
      }
      toast.success(`Matrice recalculată: ${rows.length} rânduri, câte unul pe grupă și zi.`);
      refetchMatrix();
    } catch (e: any) {
      toast.error(`Nu am putut recalcula matricea: ${e.message}`);
      refetchMatrix();
    } finally {
      setRecalc(false);
    }
  };
  const deleteMatrixRow = async (id: string) => {
    const { error } = await cloud.from("productie_avans_matrix").delete().eq("id", id);
    if (error) toast.error(error.message); else refetchMatrix();
  };
  const copyWeekdayToAll = async (weekday: number) => {
    const rows = (matrix || []).filter((m) => m.weekday === weekday);
    if (!rows.length) return;
    const targets = WEEKDAYS.map((w) => w.value).filter((w) => w !== weekday);
    const inserts = targets.flatMap((w) => rows.map((r) => ({
      weekday: w, produs_id: r.produs_id, produs_nume: r.produs_nume, cantitate: r.cantitate,
      linie_id: r.linie_id, linie_nume: r.linie_nume, baxare: r.baxare, position: r.position,
    })));
    const { error } = await cloud.from("productie_avans_matrix").insert(inserts);
    if (error) toast.error(error.message);
    else { toast.success(`Am copiat ${rows.length} rânduri pe celelalte 6 zile.`); refetchMatrix(); }
  };

  const autoEnabled = settings?.auto_enabled ?? false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" /> Automatizare Producție în Avans
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-44" />
            <Button onClick={buildGrid} disabled={building} className="bg-blue-600 hover:bg-blue-700">
              {building ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Generează Producție în Avans
            </Button>
            <span className="text-sm text-muted-foreground">
              Grila se propune din matricea zilei săptămânii (sau din istoric), o poți edita înainte de confirmare.
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch checked={autoEnabled} onCheckedChange={(v) => toggleAuto.mutate(v)} disabled={toggleAuto.isPending} />
            <div>
              <div className="font-medium flex items-center gap-2">
                Generare automată zilnică (16:50)
                <Badge variant={autoEnabled ? "default" : "secondary"}>{autoEnabled ? "ACTIVĂ" : "INACTIVĂ"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Când e activă, comenzile pentru ziua următoare se generează singure în fiecare zi la 16:50 (ora României).
                Dacă există deja comenzi de avans pentru ziua respectivă, nu se mai generează. Poți opri oricând și reveni la manual.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="matrice" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="matrice"><Grid3X3 className="h-4 w-4 mr-2" />Matrice săptămânală</TabsTrigger>
          <TabsTrigger value="jurnal"><History className="h-4 w-4 mr-2" />Jurnal</TabsTrigger>
        </TabsList>

        <TabsContent value="matrice">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="1" className="w-full">
                <TabsList className="grid w-full grid-cols-7">
                  {WEEKDAYS.map((w) => <TabsTrigger key={w.value} value={String(w.value)}>{w.label}</TabsTrigger>)}
                </TabsList>
                {WEEKDAYS.map((w) => {
                  const rows = (matrix || []).filter((m) => m.weekday === w.value);
                  return (
                    <TabsContent key={w.value} value={String(w.value)} className="space-y-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => addMatrixRow(w.value)}>
                          <Plus className="h-4 w-4 mr-1" /> Adaugă rând
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => copyWeekdayToAll(w.value)} disabled={rows.length === 0}>
                          Copiază pe toate zilele
                        </Button>
                        <Button variant="outline" size="sm" onClick={recalcFromHistory} disabled={recalc}>
                          {recalc ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                          Recalculează din istoric (pe grupe)
                        </Button>
                      </div>
                      {rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          Niciun rând pentru {w.label}. La generare se va folosi istoricul acestei zile a săptămânii.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produs</TableHead>
                              <TableHead className="w-28">Cantitate</TableHead>
                              <TableHead className="w-56">Linie</TableHead>
                              <TableHead className="w-16"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell>
                                  <AvansProductPicker
                                    value={r.produs_id}
                                    label={r.produs_nume}
                                    products={productList}
                                    groupOf={groupOf}
                                    onPick={(p) => pickMatrixProduct(r, p)}
                                  />
                                  {(() => {
                                    const g = groupOf(r.produs_id, r.produs_nume);
                                    return g && g !== (r.produs_nume || "").trim()
                                      ? <span className="text-xs text-muted-foreground">Grupa: {g}</span> : null;
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <Input type="number" defaultValue={r.cantitate}
                                    onBlur={(e) => {
                                      const v = Number(e.target.value);
                                      if (v > 0 && v !== Number(r.cantitate)) updateMatrixRow(r.id, { cantitate: v });
                                    }} />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={r.linie_id || "none"}
                                    onValueChange={(v) => {
                                      const l = (lines || []).find((x) => x.id === v);
                                      updateMatrixRow(r.id, { linie_id: v === "none" ? null : v, linie_nume: l?.nume ?? null });
                                    }}
                                  >
                                    <SelectTrigger><SelectValue placeholder={r.linie_nume || "Fără linie"} /></SelectTrigger>
                                    <SelectContent className="max-h-72 overflow-y-auto">
                                      <SelectItem value="none">Fără linie</SelectItem>
                                      {(lines || []).map((l) => <SelectItem key={l.id} value={l.id}>{l.nume}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" onClick={() => deleteMatrixRow(r.id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jurnal">
          <Card>
            <CardContent className="pt-6">
              {!logs?.length ? (
                <p className="text-sm text-muted-foreground">Nicio generare înregistrată încă.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Când</TableHead>
                      <TableHead>Ziua țintă</TableHead>
                      <TableHead>Sursă</TableHead>
                      <TableHead>Comenzi</TableHead>
                      <TableHead>Detalii</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{new Date(l.created_at).toLocaleString("ro-RO")}</TableCell>
                        <TableCell>{l.target_date}</TableCell>
                        <TableCell>
                          <Badge variant={l.source === "auto" ? "default" : "secondary"}>
                            {l.source === "auto" ? "Automat" : "Manual"}
                          </Badge>
                        </TableCell>
                        <TableCell>{l.orders_created}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                          {l.error ? <span className="text-red-600">{l.error}</span> : (l.details?.note || l.details?.sursa || "")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Grilă propusă pentru {targetDate}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Sursa propunerii: {gridSource}. Poți edita cantitățile și liniile înainte de confirmare.</p>
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produs</TableHead>
                  <TableHead className="w-28">Cantitate</TableHead>
                  <TableHead className="w-56">Linie</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grid.map((g, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <AvansProductPicker
                        value={g.produs_id}
                        label={g.produs_nume}
                        products={productList}
                        groupOf={groupOf}
                        onPick={(p) => updateGridRow(idx, { produs_id: p.id, produs_nume: p.nume })}
                      />
                      {g.produs_id && groupOf(g.produs_id, g.produs_nume) !== g.produs_nume.trim() && (
                        <span className="text-xs text-muted-foreground">Grupa: {groupOf(g.produs_id, g.produs_nume)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={g.cantitate}
                        onChange={(e) => updateGridRow(idx, { cantitate: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Select value={g.linie_id || "none"} onValueChange={(v) => {
                        const l = (lines || []).find((x) => x.id === v);
                        updateGridRow(idx, { linie_id: v === "none" ? null : v, linie_nume: l?.nume ?? null });
                      }}>
                        <SelectTrigger><SelectValue placeholder={g.linie_nume || "Fără linie"} /></SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                          <SelectItem value="none">Fără linie</SelectItem>
                          {(lines || []).map((l) => <SelectItem key={l.id} value={l.id}>{l.nume}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setGrid((x) => x.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setGrid((x) => [...x, { produs_id: null, produs_nume: "", cantitate: 100, linie_id: null, linie_nume: null }])}>
              <Plus className="h-4 w-4 mr-1" /> Adaugă rând
            </Button>
            <Button onClick={confirmGrid} disabled={createBulk.isPending} className="bg-green-600 hover:bg-green-700">
              {createBulk.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmă și creează {grid.filter((g) => g.produs_id && g.cantitate > 0).length} comenzi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdvanceAutomation;
