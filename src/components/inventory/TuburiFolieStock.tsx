import React, { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-custom-toast";
import { Loader2, Trash2, Undo2, FileDown, X } from "lucide-react";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { addTubMiscare, fetchTubMiscari } from "@/lib/tuburi";
import * as XLSX from "xlsx";

interface Row {
  key: string;
  nume: string;
  rolePrimite: number;
  roleDate: number;
  tuburiGoale: number;
  tuburiReturnate: number;
}

const tipLabel: Record<string, string> = { receptie: "Recepție role", transfer: "Dat în producție", retur: "Retur tuburi" };

export const TuburiFolieStock: React.FC = () => {
  const [miscari, setMiscari] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [retur, setRetur] = useState<Row | null>(null);
  const [returQty, setReturQty] = useState(0);
  const [returDoc, setReturDoc] = useState("");
  const [returObs, setReturObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    setLoading(true);
    try { setMiscari(await fetchTubMiscari()); }
    catch (e: any) { toast({ variant: "destructive", title: "Eroare", description: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const m = new Map<string, Row>();
    for (const x of miscari) {
      const key = String(x.produs_nume).trim().toLowerCase();
      if (!m.has(key)) m.set(key, { key, nume: x.produs_nume, rolePrimite: 0, roleDate: 0, tuburiGoale: 0, tuburiReturnate: 0 });
      const r = m.get(key)!;
      if (x.tip === "receptie") r.rolePrimite += x.role || 0;
      if (x.tip === "transfer") { r.roleDate += x.role || 0; r.tuburiGoale += x.tuburi || 0; }
      if (x.tip === "retur") { r.tuburiGoale -= x.tuburi || 0; r.tuburiReturnate += x.tuburi || 0; }
    }
    const q = search.trim().toLowerCase();
    return [...m.values()].filter(r => !q || r.key.includes(q)).sort((a, b) => a.nume.localeCompare(b.nume));
  }, [miscari, search]);

  const inRange = (d: string) => {
    const t = new Date(d).getTime();
    if (dateFrom && t < new Date(dateFrom + "T00:00:00").getTime()) return false;
    if (dateTo && t > new Date(dateTo + "T23:59:59.999").getTime()) return false;
    return true;
  };

  const filteredMiscari = useMemo(
    () => miscari.filter((x) => inRange(x.created_at)),
    [miscari, dateFrom, dateTo]
  );

  const periodTotals = useMemo(() => {
    let rec = 0, date = 0, retur = 0;
    for (const x of filteredMiscari) {
      if (x.tip === "receptie") rec += x.role || 0;
      if (x.tip === "transfer") date += x.role || 0;
      if (x.tip === "retur") retur += x.tuburi || 0;
    }
    return { rec, date, retur };
  }, [filteredMiscari]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const stocData = rows.map((r) => ({
      "Folie": r.nume,
      "Role în depozit": r.rolePrimite - r.roleDate,
      "Tuburi goale (de returnat)": r.tuburiGoale,
      "Role recepționate": r.rolePrimite,
      "Role date în producție": r.roleDate,
      "Tuburi returnate": r.tuburiReturnate,
    }));
    const wsStoc = XLSX.utils.json_to_sheet(stocData);
    wsStoc["!cols"] = [{ wch: 40 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsStoc, "Stoc");

    const miscData = filteredMiscari.map((x) => ({
      "Data": new Date(x.created_at).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" }),
      "Tip": tipLabel[x.tip] || x.tip,
      "Folie": x.produs_nume,
      "Role": x.role ?? "",
      "Tuburi": x.tuburi ?? "",
      "Lot": x.lot || "",
      "Document": x.document || "",
      "Observații": x.observatii || "",
      "Utilizator": x.created_by_email || "",
    }));
    const wsMisc = XLSX.utils.json_to_sheet(miscData.length ? miscData : [{ "Data": "Nicio mișcare în perioada selectată" }]);
    wsMisc["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, wsMisc, "Mișcări");

    const suffix = dateFrom || dateTo ? `_${dateFrom || "start"}_${dateTo || "azi"}` : "";
    XLSX.writeFile(wb, `raport-role-tuburi-folie${suffix}.xlsx`);
  };

  const saveRetur = async () => {
    if (!retur || returQty <= 0) return;
    if (returQty > retur.tuburiGoale) {
      toast({ variant: "destructive", title: "Prea multe tuburi", description: `Ai doar ${retur.tuburiGoale} tuburi goale.` });
      return;
    }
    setSaving(true);
    try {
      await addTubMiscare({ produs_nume: retur.nume, tip: "retur", tuburi: returQty, document: returDoc || null, observatii: returObs || null });
      toast({ title: "Retur înregistrat", description: `${returQty} tuburi — ${retur.nume}` });
      setRetur(null);
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Eroare", description: e.message });
    } finally { setSaving(false); }
  };

  const deleteMiscare = async (id: string) => {
    if (!confirm("Ștergi această mișcare?")) return;
    const { error } = await supabaseCloud.from("ambalaje_tuburi_miscari").delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Eroare", description: error.message });
    else load();
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-medium mr-auto">Stoc role și tuburi folie</h3>
        <Input className="max-w-xs" placeholder="Caută folie..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folie</TableHead>
              <TableHead className="text-right">Role în depozit</TableHead>
              <TableHead className="text-right">Tuburi goale (de returnat)</TableHead>
              <TableHead className="text-right">Role recepționate</TableHead>
              <TableHead className="text-right">Role date în producție</TableHead>
              <TableHead className="text-right">Tuburi returnate</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nicio mișcare încă. Rolele apar la recepția unei folii.</TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.nume}</TableCell>
                <TableCell className="text-right font-bold">{r.rolePrimite - r.roleDate}</TableCell>
                <TableCell className="text-right font-bold">{r.tuburiGoale}</TableCell>
                <TableCell className="text-right">{r.rolePrimite}</TableCell>
                <TableCell className="text-right">{r.roleDate}</TableCell>
                <TableCell className="text-right">{r.tuburiReturnate}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" disabled={r.tuburiGoale <= 0}
                    onClick={() => { setRetur(r); setReturQty(r.tuburiGoale); setReturDoc(""); setReturObs(""); }}>
                    <Undo2 className="h-4 w-4 mr-1" /> Retur furnizor
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="font-medium mb-2">Istoric mișcări</h4>
        <div className="border rounded-md overflow-x-auto max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Folie</TableHead>
                <TableHead className="text-right">Role</TableHead>
                <TableHead className="text-right">Tuburi</TableHead>
                <TableHead>Lot / Document</TableHead>
                <TableHead>Utilizator</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {miscari.slice(0, 300).map(x => (
                <TableRow key={x.id}>
                  <TableCell className="whitespace-nowrap">{new Date(x.created_at).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}</TableCell>
                  <TableCell><Badge variant="outline">{tipLabel[x.tip] || x.tip}</Badge></TableCell>
                  <TableCell>{x.produs_nume}</TableCell>
                  <TableCell className="text-right">{x.role || "-"}</TableCell>
                  <TableCell className="text-right">{x.tuburi || "-"}</TableCell>
                  <TableCell>{[x.lot, x.document].filter(Boolean).join(" / ") || "-"}{x.observatii ? ` — ${x.observatii}` : ""}</TableCell>
                  <TableCell className="text-xs">{x.created_by_email || "-"}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => deleteMiscare(x.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!retur} onOpenChange={(o) => !o && setRetur(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Retur tuburi — {retur?.nume}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nr. tuburi (disponibile: {retur?.tuburiGoale})</label>
              <Input type="number" inputMode="numeric" min="1" value={returQty || ""} onChange={(e) => setReturQty(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-sm font-medium">Document (aviz)</label>
              <Input value={returDoc} onChange={(e) => setReturDoc(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Observații</label>
              <Input value={returObs} onChange={(e) => setReturObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetur(null)}>Anulează</Button>
            <Button onClick={saveRetur} disabled={saving || returQty <= 0}>{saving ? "Se salvează..." : "Salvează retur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TuburiFolieStock;
