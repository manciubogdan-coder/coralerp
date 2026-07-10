import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ServerCrash,
  Clock,
} from "lucide-react";
import { useProducts } from "@/hooks/productie/useProductionData";

interface MappingRow {
  id: string;
  cod_extern: string;
  denumire_extern: string | null;
  produs_id: string;
}
interface LogRow {
  id: string;
  ran_at: string;
  avize_primite: number;
  comenzi_create: number;
  linii_create: number;
  skipped_duplicat: number;
  unmapped_produse: any;
  unmapped_magazine: any;
  erori: any;
  bridge_host: string | null;
}

const SeniorErpImport = () => {
  const { data: products = [] } = useProducts();
  const [mapping, setMapping] = useState<MappingRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCod, setNewCod] = useState("");
  const [newDen, setNewDen] = useState("");
  const [newProdusId, setNewProdusId] = useState("");

  const productMap = useMemo(() => {
    const m = new Map<string, any>();
    products.forEach((p: any) => m.set(p.id, p));
    return m;
  }, [products]);

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: l }] = await Promise.all([
      (supabase as any)
        .from("erp_mapping_produse")
        .select("*")
        .order("cod_extern"),
      (supabase as any)
        .from("erp_import_log")
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(50),
    ]);
    setMapping((m as any) || []);
    setLogs((l as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const lastLog = logs[0];
  const bridgeStatus = useMemo(() => {
    if (!lastLog) return { color: "gray", label: "Nu s-a rulat niciodată", detail: "" };
    const ranAt = new Date(lastLog.ran_at);
    const ago = Date.now() - ranAt.getTime();
    const minutes = Math.floor(ago / 60000);
    const seconds = Math.floor(ago / 1000);
    const when = ranAt.toLocaleString("ro-RO");
    const host = lastLog.bridge_host ? ` (${lastLog.bridge_host})` : "";
    const label =
      seconds < 60 ? `acum ${seconds}s` : `acum ${minutes} min`;
    if (minutes > 15)
      return { color: "red", label: `Bridge oprit? Ultima activitate ${label}`, detail: `${when}${host}` };
    if (minutes > 5)
      return { color: "amber", label: `Ultima activitate ${label}`, detail: `${when}${host}` };
    return { color: "green", label: `Activ • ${label}`, detail: `${when}${host}` };
  }, [lastLog]);

  const totalAzi = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return logs
      .filter((l) => l.ran_at.slice(0, 10) === today)
      .reduce(
        (acc, l) => ({
          avize: acc.avize + l.avize_primite,
          linii: acc.linii + l.linii_create,
          erori:
            acc.erori + (Array.isArray(l.erori) ? l.erori.length : 0),
        }),
        { avize: 0, linii: 0, erori: 0 }
      );
  }, [logs]);

  const addMapping = async () => {
    if (!newCod.trim() || !newProdusId) {
      toast.error("Cod ERP și produs intern sunt obligatorii");
      return;
    }
    const { error } = await (supabase as any)
      .from("erp_mapping_produse")
      .insert({
        cod_extern: newCod.trim(),
        denumire_extern: newDen.trim() || null,
        produs_id: newProdusId,
      });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mapping adăugat");
    setNewCod("");
    setNewDen("");
    setNewProdusId("");
    load();
  };

  const updateMapping = async (id: string, patch: Partial<MappingRow>) => {
    const { error } = await (supabase as any)
      .from("erp_mapping_produse")
      .update(patch)
      .eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const deleteMapping = async (id: string) => {
    if (!window.confirm("Ștergi maparea?")) return;
    const { error } = await (supabase as any)
      .from("erp_mapping_produse")
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Șters");
      load();
    }
  };

  const badgeColor: Record<string, string> = {
    green: "bg-green-100 text-green-700 border-green-300",
    amber: "bg-amber-100 text-amber-700 border-amber-300",
    red: "bg-red-100 text-red-700 border-red-300",
    gray: "bg-gray-100 text-gray-600 border-gray-300",
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ServerCrash className="h-5 w-5" /> Import Senior ERP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div
              className={`border rounded-lg p-3 ${badgeColor[bridgeStatus.color]}`}
            >
              <div className="text-xs uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3 w-3" /> Bridge
              </div>
              <div className="font-medium mt-1 text-sm">{bridgeStatus.label}</div>
            </div>
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="text-xs uppercase text-muted-foreground">
                Avize azi
              </div>
              <div className="text-2xl font-semibold">{totalAzi.avize}</div>
            </div>
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="text-xs uppercase text-muted-foreground">
                Linii create azi
              </div>
              <div className="text-2xl font-semibold">{totalAzi.linii}</div>
            </div>
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="text-xs uppercase text-muted-foreground">
                Erori azi
              </div>
              <div className="text-2xl font-semibold">{totalAzi.erori}</div>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reîncarcă
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mapping produse */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping produse ERP → produs intern</CardTitle>
          <p className="text-xs text-muted-foreground">
            Fiecare cod de produs din Senior ERP trebuie asociat unui produs
            intern pentru ca avizele să fie importate. Fără mapping, produsul e
            raportat ca „nemapat" și ignorat.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border rounded-lg p-3 bg-muted/20 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <div>
              <Label className="text-xs">Cod ERP *</Label>
              <Input
                value={newCod}
                onChange={(e) => setNewCod(e.target.value)}
                placeholder="Ex: 12345"
              />
            </div>
            <div>
              <Label className="text-xs">Denumire ERP</Label>
              <Input
                value={newDen}
                onChange={(e) => setNewDen(e.target.value)}
                placeholder="(opțional)"
              />
            </div>
            <div>
              <Label className="text-xs">Produs intern *</Label>
              <Select value={newProdusId} onValueChange={setNewProdusId}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nume} ({p.unitate_masura})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addMapping}>
              <Plus className="h-4 w-4 mr-1" /> Adaugă
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cod ERP</TableHead>
                  <TableHead>Denumire ERP</TableHead>
                  <TableHead>Produs intern</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapping.map((r) => {
                  const p = productMap.get(r.produs_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {r.cod_extern}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.denumire_extern || "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.produs_id}
                          onValueChange={(v) =>
                            updateMapping(r.id, { produs_id: v })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue>
                              {p ? `${p.nume} (${p.unitate_masura})` : "?"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((pp: any) => (
                              <SelectItem key={pp.id} value={pp.id}>
                                {pp.nume} ({pp.unitate_masura})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMapping(r.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {mapping.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-6"
                    >
                      Niciun mapping încă. Adaugă mai sus.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Istoric */}
      <Card>
        <CardHeader>
          <CardTitle>Istoric sincronizări (ultimele 50)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Avize</TableHead>
                <TableHead>Linii create</TableHead>
                <TableHead>Skipped</TableHead>
                <TableHead>Nemapate</TableHead>
                <TableHead>Erori</TableHead>
                <TableHead>Host</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.filter((l) => !(l.avize_primite === 0 && l.linii_create === 0 && l.skipped_duplicat === 0 && (!Array.isArray(l.erori) || l.erori.length === 0))).map((l) => {
                const nemapate =
                  (Array.isArray(l.unmapped_produse)
                    ? l.unmapped_produse.length
                    : 0) +
                  (Array.isArray(l.unmapped_magazine)
                    ? l.unmapped_magazine.length
                    : 0);
                const err = Array.isArray(l.erori) ? l.erori.length : 0;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(l.ran_at).toLocaleString("ro-RO")}
                    </TableCell>
                    <TableCell>{l.avize_primite}</TableCell>
                    <TableCell className="font-medium">
                      {l.linii_create > 0 && (
                        <CheckCircle2 className="h-3 w-3 text-green-600 inline mr-1" />
                      )}
                      {l.linii_create}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.skipped_duplicat}
                    </TableCell>
                    <TableCell>
                      {nemapate > 0 ? (
                        <span
                          title={JSON.stringify(
                            [
                              ...(l.unmapped_produse || []),
                              ...(l.unmapped_magazine || []),
                            ],
                            null,
                            2
                          )}
                          className="text-amber-600 flex items-center gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" /> {nemapate}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {err > 0 ? (
                        <span
                          className="text-red-600"
                          title={JSON.stringify(l.erori, null, 2)}
                        >
                          {err}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.bridge_host || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-6"
                  >
                    Nicio rulare încă.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SeniorErpImport;
