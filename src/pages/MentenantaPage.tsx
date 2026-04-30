import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { format, differenceInMinutes } from "date-fns";
import { ro } from "date-fns/locale";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
} from "lucide-react";

// ---------- Types ----------
interface Linie {
  id: string;
  nume: string;
  capacitate_ora?: number | null;
  status?: string | null;
}

interface Defectiune {
  id: string;
  linie_id: string;
  data_start: string;
  data_final: string | null;
  componenta: string;
  descriere: string | null;
  severitate: "minora" | "medie" | "critica";
  status: "deschisa" | "in_lucru" | "rezolvata";
  linia_a_functionat: boolean;
  ore_oprire_efectiva: number | null;
  raportat_de: string | null;
  reparat_de: string | null;
  ce_s_a_reparat: string | null;
  piese_folosite: string | null;
  created_at: string;
}

const SEV_LABEL: Record<string, string> = {
  minora: "Minoră",
  medie: "Medie",
  critica: "Critică",
};
const STATUS_LABEL: Record<string, string> = {
  deschisa: "Deschisă",
  in_lucru: "În lucru",
  rezolvata: "Rezolvată",
};

const sevColor = (s: string) =>
  s === "critica"
    ? "bg-red-500"
    : s === "medie"
    ? "bg-orange-500"
    : "bg-yellow-500";
const statusColor = (s: string) =>
  s === "rezolvata"
    ? "bg-green-500"
    : s === "in_lucru"
    ? "bg-blue-500"
    : "bg-gray-500";

const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string) => (s ? new Date(s).toISOString() : null);

const hoursBetween = (a: string, b?: string | null) => {
  if (!b) return 0;
  return Math.max(0, differenceInMinutes(new Date(b), new Date(a)) / 60);
};

// ============================================================
// LINES MANAGEMENT
// ============================================================
const LinesTab: React.FC<{
  lines: Linie[];
  refresh: () => void;
}> = ({ lines, refresh }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Linie | null>(null);
  const [nume, setNume] = useState("");
  const [cap, setCap] = useState("");
  const [status, setStatus] = useState("activa");

  const reset = () => {
    setEditing(null);
    setNume("");
    setCap("");
    setStatus("activa");
  };

  const openNew = () => {
    reset();
    setOpen(true);
  };
  const openEdit = (l: Linie) => {
    setEditing(l);
    setNume(l.nume);
    setCap(String(l.capacitate_ora ?? ""));
    setStatus(l.status ?? "activa");
    setOpen(true);
  };

  const save = async () => {
    if (!nume.trim()) {
      toast({ title: "Numele liniei este obligatoriu", variant: "destructive" });
      return;
    }
    const payload: any = {
      nume: nume.trim(),
      capacitate_ora: cap ? Number(cap) : 0,
      status,
    };
    let res;
    if (editing) {
      res = await (supabase as any)
        .from("productie_linii")
        .update(payload)
        .eq("id", editing.id);
    } else {
      res = await (supabase as any).from("productie_linii").insert(payload);
    }
    if (res.error) {
      toast({ title: "Eroare", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Linie actualizată" : "Linie adăugată" });
    setOpen(false);
    reset();
    refresh();
  };

  const remove = async (l: Linie) => {
    if (!confirm(`Ștergi linia "${l.nume}"? Defecțiunile asociate vor bloca ștergerea.`))
      return;
    const { error } = await (supabase as any)
      .from("productie_linii")
      .delete()
      .eq("id", l.id);
    if (error) {
      toast({ title: "Nu se poate șterge", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Linie ștearsă" });
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Linii de producție</CardTitle>
        <Button size="sm" onClick={openNew}>
          <Plus size={16} className="mr-1" /> Linie nouă
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nume</TableHead>
              <TableHead>Capacitate/oră</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nicio linie definită.
                </TableCell>
              </TableRow>
            )}
            {lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.nume}</TableCell>
                <TableCell>{l.capacitate_ora ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{l.status ?? "-"}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(l)}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(l)}>
                    <Trash2 size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editare linie" : "Linie nouă"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nume *</Label>
              <Input value={nume} onChange={(e) => setNume(e.target.value)} />
            </div>
            <div>
              <Label>Capacitate/oră</Label>
              <Input
                type="number"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activa">Activă</SelectItem>
                  <SelectItem value="inactiva">Inactivă</SelectItem>
                  <SelectItem value="mentenanta">Mentenanță</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anulează
            </Button>
            <Button onClick={save}>Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ============================================================
// DEFECTIUNI FORM DIALOG
// ============================================================
const DefectiuneDialog: React.FC<{
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: Defectiune | null;
  lines: Linie[];
  defaultUser: string;
  onSaved: () => void;
}> = ({ open, onOpenChange, editing, lines, defaultUser, onSaved }) => {
  const { toast } = useToast();
  const [linieId, setLinieId] = useState("");
  const [dataStart, setDataStart] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [componenta, setComponenta] = useState("");
  const [descriere, setDescriere] = useState("");
  const [severitate, setSeveritate] = useState<"minora" | "medie" | "critica">("medie");
  const [status, setStatus] = useState<"deschisa" | "in_lucru" | "rezolvata">("deschisa");
  const [aFunctionat, setAFunctionat] = useState("nu");
  const [oreOprire, setOreOprire] = useState("");
  const [raportatDe, setRaportatDe] = useState("");
  const [reparatDe, setReparatDe] = useState("");
  const [ceReparat, setCeReparat] = useState("");
  const [piese, setPiese] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setLinieId(editing.linie_id);
      setDataStart(toLocalInput(editing.data_start));
      setDataFinal(toLocalInput(editing.data_final));
      setComponenta(editing.componenta);
      setDescriere(editing.descriere ?? "");
      setSeveritate(editing.severitate);
      setStatus(editing.status);
      setAFunctionat(editing.linia_a_functionat ? "da" : "nu");
      setOreOprire(String(editing.ore_oprire_efectiva ?? ""));
      setRaportatDe(editing.raportat_de ?? "");
      setReparatDe(editing.reparat_de ?? "");
      setCeReparat(editing.ce_s_a_reparat ?? "");
      setPiese(editing.piese_folosite ?? "");
    } else {
      setLinieId("");
      setDataStart(toLocalInput(new Date().toISOString()));
      setDataFinal("");
      setComponenta("");
      setDescriere("");
      setSeveritate("medie");
      setStatus("deschisa");
      setAFunctionat("nu");
      setOreOprire("");
      setRaportatDe(defaultUser);
      setReparatDe("");
      setCeReparat("");
      setPiese("");
    }
  }, [open, editing, defaultUser]);

  // Auto-calcul ore oprire = durata defecțiunii dacă linia NU a funcționat cu defecțiune.
  // Suprascrie mereu (inclusiv la editare) atâta timp cât avem start + final.
  useEffect(() => {
    if (aFunctionat === "nu" && dataStart && dataFinal) {
      const start = fromLocalInput(dataStart);
      const final = fromLocalInput(dataFinal);
      if (start && final) {
        const h = hoursBetween(start, final);
        setOreOprire(h.toFixed(2));
      }
    } else if (aFunctionat === "nu" && !dataFinal) {
      // Fără data final → 0 până la finalizare
      setOreOprire("0");
    }
  }, [aFunctionat, dataStart, dataFinal]);

  const save = async () => {
    if (!linieId || !dataStart || !componenta.trim()) {
      toast({
        title: "Câmpuri obligatorii",
        description: "Linie, data start și componentă defectă.",
        variant: "destructive",
      });
      return;
    }
    const payload: any = {
      linie_id: linieId,
      data_start: fromLocalInput(dataStart),
      data_final: fromLocalInput(dataFinal),
      componenta: componenta.trim(),
      descriere: descriere.trim() || null,
      severitate,
      status,
      linia_a_functionat: aFunctionat === "da",
      ore_oprire_efectiva: oreOprire ? Number(oreOprire) : 0,
      raportat_de: raportatDe.trim() || null,
      reparat_de: reparatDe.trim() || null,
      ce_s_a_reparat: ceReparat.trim() || null,
      piese_folosite: piese.trim() || null,
    };
    const res = editing
      ? await (supabase as any)
          .from("mentenanta_defectiuni")
          .update(payload)
          .eq("id", editing.id)
      : await (supabase as any).from("mentenanta_defectiuni").insert(payload);
    if (res.error) {
      toast({ title: "Eroare", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Defecțiune actualizată" : "Defecțiune înregistrată" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle>
            {editing ? "Editare defecțiune" : "Defecțiune nouă"}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Linie *</Label>
              <Select value={linieId} onValueChange={setLinieId}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege linia" />
                </SelectTrigger>
                <SelectContent className="max-h-72 overflow-y-auto">
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nume}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severitate</Label>
              <Select
                value={severitate}
                onValueChange={(v) => setSeveritate(v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minora">Minoră</SelectItem>
                  <SelectItem value="medie">Medie</SelectItem>
                  <SelectItem value="critica">Critică</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data/ora start *</Label>
              <Input
                type="datetime-local"
                value={dataStart}
                onChange={(e) => setDataStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Data/ora final</Label>
              <Input
                type="datetime-local"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label>Componentă defectă *</Label>
              <Input
                value={componenta}
                onChange={(e) => setComponenta(e.target.value)}
                placeholder="Ex: Motor banda transportoare"
              />
            </div>
            <div className="col-span-2">
              <Label>Descriere problemă</Label>
              <Textarea
                value={descriere}
                onChange={(e) => setDescriere(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Linia a funcționat cu defecțiune?</Label>
              <Select value={aFunctionat} onValueChange={setAFunctionat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="da">Da</SelectItem>
                  <SelectItem value="nu">Nu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                Ore oprire efectivă
                {aFunctionat === "nu" && (
                  <span className="ml-2 text-xs text-muted-foreground">(auto)</span>
                )}
              </Label>
              <Input
                type="number"
                step="0.25"
                value={oreOprire}
                onChange={(e) => setOreOprire(e.target.value)}
                readOnly={aFunctionat === "nu"}
                className={aFunctionat === "nu" ? "bg-muted cursor-not-allowed" : ""}
                title={
                  aFunctionat === "nu"
                    ? "Calculat automat din data start → data final (linia nu a funcționat)"
                    : ""
                }
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deschisa">Deschisă</SelectItem>
                  <SelectItem value="in_lucru">În lucru</SelectItem>
                  <SelectItem value="rezolvata">Rezolvată</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Raportat de</Label>
              <Input
                value={raportatDe}
                onChange={(e) => setRaportatDe(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label>Ce s-a reparat</Label>
              <Textarea
                value={ceReparat}
                onChange={(e) => setCeReparat(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Reparat de</Label>
              <Input
                value={reparatDe}
                onChange={(e) => setReparatDe(e.target.value)}
              />
            </div>
            <div>
              <Label>Piese folosite</Label>
              <Input
                value={piese}
                onChange={(e) => setPiese(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="p-6 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button onClick={save}>Salvează</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// DEFECTIUNI LIST TAB
// ============================================================
const DefectiuniTab: React.FC<{
  defects: Defectiune[];
  lines: Linie[];
  defaultUser: string;
  refresh: () => void;
}> = ({ defects, lines, defaultUser, refresh }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Defectiune | null>(null);
  const [filterLine, setFilterLine] = useState<string>("toate");
  const [filterStatus, setFilterStatus] = useState<string>("toate");
  const [filterSev, setFilterSev] = useState<string>("toate");
  const [filterReparator, setFilterReparator] = useState<string>("toate");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const lineMap = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.id, l.nume])),
    [lines]
  );

  // Lista distinctă de reparatori (din înregistrările existente)
  const reparatori = useMemo(() => {
    const set = new Set<string>();
    defects.forEach((d) => {
      const r = d.reparat_de?.trim();
      if (r) set.add(r);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ro"));
  }, [defects]);

  const filtered = defects.filter((d) => {
    if (filterLine !== "toate" && d.linie_id !== filterLine) return false;
    if (filterStatus !== "toate" && d.status !== filterStatus) return false;
    if (filterSev !== "toate" && d.severitate !== filterSev) return false;
    if (filterReparator !== "toate") {
      const r = (d.reparat_de ?? "").trim();
      if (filterReparator === "__none__") {
        if (r) return false;
      } else if (r !== filterReparator) {
        return false;
      }
    }
    if (dateFrom) {
      const fromD = new Date(`${dateFrom}T00:00:00`);
      if (new Date(d.data_start) < fromD) return false;
    }
    if (dateTo) {
      const toD = new Date(`${dateTo}T23:59:59`);
      if (new Date(d.data_start) > toD) return false;
    }
    return true;
  });

  const resetFilters = () => {
    setFilterLine("toate");
    setFilterStatus("toate");
    setFilterSev("toate");
    setFilterReparator("toate");
    setDateFrom("");
    setDateTo("");
  };

  const remove = async (d: Defectiune) => {
    if (!confirm("Ștergi această defecțiune?")) return;
    const { error } = await (supabase as any)
      .from("mentenanta_defectiuni")
      .delete()
      .eq("id", d.id);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Defecțiune ștearsă" });
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle>Registru defecțiuni</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={filterLine} onValueChange={setFilterLine}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72 overflow-y-auto">
              <SelectItem value="toate">Toate liniile</SelectItem>
              {lines.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nume}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate statusurile</SelectItem>
              <SelectItem value="deschisa">Deschisă</SelectItem>
              <SelectItem value="in_lucru">În lucru</SelectItem>
              <SelectItem value="rezolvata">Rezolvată</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={16} className="mr-1" /> Înregistrează
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Linie</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Final</TableHead>
                <TableHead>Componentă</TableHead>
                <TableHead>Severitate</TableHead>
                <TableHead>A funcționat</TableHead>
                <TableHead>Ore oprire</TableHead>
                <TableHead>Reparat de</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Nicio defecțiune înregistrată.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{lineMap[d.linie_id] ?? "?"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(d.data_start), "dd.MM.yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {d.data_final
                      ? format(new Date(d.data_final), "dd.MM.yyyy HH:mm")
                      : "-"}
                  </TableCell>
                  <TableCell>{d.componenta}</TableCell>
                  <TableCell>
                    <Badge className={`${sevColor(d.severitate)} text-white`}>
                      {SEV_LABEL[d.severitate]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {d.linia_a_functionat ? (
                      <Badge variant="outline" className="text-green-700 border-green-500">
                        Da
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-700 border-red-500">
                        Nu
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{Number(d.ore_oprire_efectiva ?? 0).toFixed(2)}</TableCell>
                  <TableCell>{d.reparat_de ?? "-"}</TableCell>
                  <TableCell>
                    <Badge className={`${statusColor(d.status)} text-white`}>
                      {STATUS_LABEL[d.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(d);
                        setOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(d)}>
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <DefectiuneDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        lines={lines}
        defaultUser={defaultUser}
        onSaved={refresh}
      />
    </Card>
  );
};

// ============================================================
// RAPORT TAB
// ============================================================
const RaportTab: React.FC<{
  defects: Defectiune[];
  lines: Linie[];
}> = ({ defects, lines }) => {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const [from, setFrom] = useState(format(weekAgo, "yyyy-MM-dd"));
  const [to, setTo] = useState(format(today, "yyyy-MM-dd"));

  const lineMap = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.id, l.nume])),
    [lines]
  );

  const inRange = useMemo(() => {
    const fromD = new Date(`${from}T00:00:00`);
    const toD = new Date(`${to}T23:59:59`);
    return defects.filter((d) => {
      const ds = new Date(d.data_start);
      return ds >= fromD && ds <= toD;
    });
  }, [defects, from, to]);

  const totals = useMemo(() => {
    const nr = inRange.length;
    let oreReparatie = 0;
    let oreStop = 0;
    inRange.forEach((d) => {
      oreReparatie += hoursBetween(d.data_start, d.data_final ?? new Date().toISOString());
      oreStop += Number(d.ore_oprire_efectiva ?? 0);
    });
    return { nr, oreReparatie, oreStop };
  }, [inRange]);

  // Date pe linie pentru grafic
  const perLine = useMemo(() => {
    const map: Record<string, { linie: string; oreReparatie: number; oreStop: number; nr: number }> = {};
    inRange.forEach((d) => {
      const k = lineMap[d.linie_id] ?? "?";
      if (!map[k]) map[k] = { linie: k, oreReparatie: 0, oreStop: 0, nr: 0 };
      map[k].oreReparatie += hoursBetween(d.data_start, d.data_final ?? new Date().toISOString());
      map[k].oreStop += Number(d.ore_oprire_efectiva ?? 0);
      map[k].nr += 1;
    });
    return Object.values(map).sort((a, b) => b.oreStop - a.oreStop);
  }, [inRange, lineMap]);

  const topComponente = useMemo(() => {
    const map: Record<string, number> = {};
    inRange.forEach((d) => {
      map[d.componenta] = (map[d.componenta] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [inRange]);

  const topReparatori = useMemo(() => {
    const map: Record<string, number> = {};
    inRange.forEach((d) => {
      const r = d.reparat_de?.trim();
      if (!r) return;
      map[r] = (map[r] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [inRange]);

  const exportExcel = () => {
    const rows = inRange.map((d) => ({
      Linie: lineMap[d.linie_id] ?? "?",
      "Data start": format(new Date(d.data_start), "dd.MM.yyyy HH:mm"),
      "Data final": d.data_final ? format(new Date(d.data_final), "dd.MM.yyyy HH:mm") : "",
      "Componentă defectă": d.componenta,
      Descriere: d.descriere ?? "",
      Severitate: SEV_LABEL[d.severitate],
      Status: STATUS_LABEL[d.status],
      "A funcționat": d.linia_a_functionat ? "Da" : "Nu",
      "Ore oprire efectivă": Number(d.ore_oprire_efectiva ?? 0),
      "Ore reparație (durată)": Number(
        hoursBetween(d.data_start, d.data_final ?? new Date().toISOString()).toFixed(2)
      ),
      "Raportat de": d.raportat_de ?? "",
      "Reparat de": d.reparat_de ?? "",
      "Ce s-a reparat": d.ce_s_a_reparat ?? "",
      "Piese folosite": d.piese_folosite ?? "",
    }));

    const summary = [
      { Indicator: "Perioadă", Valoare: `${from} → ${to}` },
      { Indicator: "Nr. defecțiuni", Valoare: totals.nr },
      { Indicator: "Ore reparație (total)", Valoare: Number(totals.oreReparatie.toFixed(2)) },
      { Indicator: "Ore oprire efectivă (total)", Valoare: Number(totals.oreStop.toFixed(2)) },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Sumar");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Defecțiuni");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(perLine.map((r) => ({
        Linie: r.linie,
        "Nr. defecțiuni": r.nr,
        "Ore reparație": Number(r.oreReparatie.toFixed(2)),
        "Ore oprire efectivă": Number(r.oreStop.toFixed(2)),
      }))),
      "Pe linie"
    );
    XLSX.writeFile(wb, `Mentenanta_${from}_${to}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <div>
              <Label>De la</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Până la</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={exportExcel}>
            <Download size={16} className="mr-1" /> Export Excel
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertTriangle size={16} /> Nr. defecțiuni
              </div>
              <div className="text-3xl font-bold mt-1">{totals.nr}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Wrench size={16} /> Ore reparație
              </div>
              <div className="text-3xl font-bold mt-1">{totals.oreReparatie.toFixed(1)}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock size={16} /> Ore oprire efectivă
              </div>
              <div className="text-3xl font-bold mt-1">{totals.oreStop.toFixed(1)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defecțiuni pe linie</CardTitle>
        </CardHeader>
        <CardContent>
          {perLine.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">Niciun rezultat în interval.</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perLine}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="linie" />
                  <YAxis />
                  <RTooltip />
                  <Legend />
                  <Bar dataKey="oreReparatie" name="Ore durată defecțiune" fill="hsl(var(--primary))" />
                  <Bar dataKey="oreStop" name="Ore oprire efectivă" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top componente defecte</CardTitle>
          </CardHeader>
          <CardContent>
            {topComponente.length === 0 ? (
              <div className="text-muted-foreground text-sm">Fără date.</div>
            ) : (
              <ul className="space-y-2">
                {topComponente.map(([name, n]) => (
                  <li key={name} className="flex justify-between border-b pb-1">
                    <span>{name}</span>
                    <Badge variant="secondary">{n}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top reparatori</CardTitle>
          </CardHeader>
          <CardContent>
            {topReparatori.length === 0 ? (
              <div className="text-muted-foreground text-sm">Fără date.</div>
            ) : (
              <ul className="space-y-2">
                {topReparatori.map(([name, n]) => (
                  <li key={name} className="flex justify-between border-b pb-1">
                    <span>{name}</span>
                    <Badge variant="secondary">{n}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ============================================================
// MAIN PAGE
// ============================================================
const MentenantaPage: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [lines, setLines] = useState<Linie[]>([]);
  const [defects, setDefects] = useState<Defectiune[]>([]);
  const [loading, setLoading] = useState(true);
  const defaultUser = profile?.name || profile?.email || "";

  const refresh = async () => {
    setLoading(true);
    const [{ data: lData, error: lErr }, { data: dData, error: dErr }] =
      await Promise.all([
        (supabase as any).from("productie_linii").select("*").order("nume"),
        (supabase as any)
          .from("mentenanta_defectiuni")
          .select("*")
          .order("data_start", { ascending: false }),
      ]);
    if (lErr) toast({ title: "Eroare linii", description: lErr.message, variant: "destructive" });
    if (dErr)
      toast({ title: "Eroare defecțiuni", description: dErr.message, variant: "destructive" });
    setLines((lData as Linie[]) ?? []);
    setDefects((dData as Defectiune[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCount = defects.filter((d) => d.status !== "rezolvata").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench /> Mentenanță
          </h1>
          <p className="text-sm text-muted-foreground">
            Defecțiuni, reparații și disponibilitate linii.
          </p>
        </div>
        <div className="flex gap-2">
          {openCount > 0 ? (
            <Badge className="bg-red-500 text-white">
              <AlertTriangle size={14} className="mr-1" /> {openCount} active
            </Badge>
          ) : (
            <Badge className="bg-green-500 text-white">
              <CheckCircle2 size={14} className="mr-1" /> Toate rezolvate
            </Badge>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Se încarcă...</div>
      ) : (
        <Tabs defaultValue="defectiuni">
          <TabsList>
            <TabsTrigger value="defectiuni">Defecțiuni</TabsTrigger>
            <TabsTrigger value="raport">Raport & Grafic</TabsTrigger>
            <TabsTrigger value="linii">Linii</TabsTrigger>
          </TabsList>
          <TabsContent value="defectiuni" className="mt-4">
            <DefectiuniTab
              defects={defects}
              lines={lines}
              defaultUser={defaultUser}
              refresh={refresh}
            />
          </TabsContent>
          <TabsContent value="raport" className="mt-4">
            <RaportTab defects={defects} lines={lines} />
          </TabsContent>
          <TabsContent value="linii" className="mt-4">
            <LinesTab lines={lines} refresh={refresh} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default MentenantaPage;
