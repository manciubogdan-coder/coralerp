import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useInventoryType } from "@/context/inventory-type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-custom-toast";
import { ClipboardList, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { BreakdownEntry } from "@/lib/receptionBreakdown";
import {
  type Prereceptie,
  STATUS_LABEL,
  breakdownText,
  computeStatus,
  currentEmail,
  fetchPrereceptii,
} from "@/lib/prereceptie";

type Ref = { id: string; name: string; default_unit?: string | null };

const prefixFor = (t: string) => (t === "ambalaje" ? "ambalaje_" : t === "etichete" ? "etichete_" : "");

export function usePrereceptieRefs(inventoryType: string) {
  const [refs, setRefs] = useState<{ products: Ref[]; suppliers: Ref[]; manufacturers: Ref[]; crates: Ref[]; pallets: Ref[] }>({
    products: [], suppliers: [], manufacturers: [], crates: [], pallets: [],
  });
  useEffect(() => {
    const p = prefixFor(inventoryType);
    (async () => {
      const [pr, su, ma, cr, pa] = await Promise.all([
        (supabase as any).from(`${p}products`).select("id, name, default_unit").order("name"),
        (supabase as any).from(`${p}suppliers`).select("id, name").order("name"),
        (supabase as any).from(`${p}manufacturers`).select("id, name").order("name"),
        (supabase as any).from(`${p}crate_types`).select("id, name").order("name"),
        (supabase as any).from(`${p}pallet_types`).select("id, name").order("name"),
      ]);
      setRefs({
        products: pr.data || [], suppliers: su.data || [], manufacturers: ma.data || [],
        crates: cr.data || [], pallets: pa.data || [],
      });
    })();
  }, [inventoryType]);
  return refs;
}

interface DraftLine {
  id?: string;
  product_id: string | null;
  manufacturer_id: string | null;
  cantitate_document: number;
  pallets: BreakdownEntry[];
  crates: BreakdownEntry[];
  received?: boolean;
}

const emptyLine = (): DraftLine => ({
  product_id: null, manufacturer_id: null, cantitate_document: 0,
  pallets: [{ id: null, name: "", count: 0 }], crates: [{ id: null, name: "", count: 0 }],
});

const BreakdownEditor: React.FC<{
  label: string; rows: BreakdownEntry[]; options: Ref[]; onChange: (r: BreakdownEntry[]) => void; disabled?: boolean;
}> = ({ label, rows, options, onChange, disabled }) => (
  <div className="space-y-1">
    <div className="text-xs font-medium text-muted-foreground">{label}</div>
    {rows.map((r, i) => (
      <div key={i} className="flex gap-1">
        <Select
          value={r.id || ""}
          disabled={disabled}
          onValueChange={(v) => {
            const next = [...rows];
            next[i] = { ...r, id: v, name: options.find((o) => o.id === v)?.name || "" };
            onChange(next);
          }}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          type="number" className="h-8 w-20 text-xs" value={r.count || ""} disabled={disabled}
          onChange={(e) => { const next = [...rows]; next[i] = { ...r, count: parseInt(e.target.value) || 0 }; onChange(next); }}
          placeholder="Nr"
        />
        {rows.length > 1 && !disabled && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    ))}
    {!disabled && (
      <Button variant="link" size="sm" className="h-6 px-0 text-xs" onClick={() => onChange([...rows, { id: null, name: "", count: 0 }])}>
        + alt tip
      </Button>
    )}
  </div>
);

const PrereceptieView: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const refs = usePrereceptieRefs(inventoryType);
  const isMP = inventoryType === "materii-prime";
  const [list, setList] = useState<Prereceptie[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"deschise" | "toate" | "receptionata">("deschise");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [docNr, setDocNr] = useState("");
  const [date, setDate] = useState("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await fetchPrereceptii(inventoryType)); }
    catch (e: any) { toast({ variant: "destructive", title: "Eroare la încărcare", description: e.message }); }
    finally { setLoading(false); }
  }, [inventoryType]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return list.filter((p) => {
      if (filter === "deschise" && p.status === "receptionata") return false;
      if (filter === "receptionata" && p.status !== "receptionata") return false;
      if (!s) return true;
      return [p.document_number, p.supplier_name, ...p.linii.map((l) => l.product_name)]
        .some((x) => (x || "").toLowerCase().includes(s));
    });
  }, [list, filter, search]);

  const startNew = () => {
    setEditId(null); setDocNr(""); setDate(new Date().toISOString().slice(0, 10));
    setSupplierId(null); setNotes(""); setLines([emptyLine()]); setOpen(true);
  };

  const startEdit = (p: Prereceptie) => {
    setEditId(p.id); setDocNr(p.document_number); setDate(p.expected_date || "");
    setSupplierId(p.supplier_id); setNotes(p.notes || "");
    setLines(p.linii.map((l) => ({
      id: l.id, product_id: l.product_id, manufacturer_id: l.manufacturer_id,
      cantitate_document: Number(l.cantitate_document) || 0,
      pallets: l.pallets?.length ? l.pallets : [{ id: null, name: "", count: 0 }],
      crates: l.crates?.length ? l.crates : [{ id: null, name: "", count: 0 }],
      received: !!l.received_at,
    })));
    setOpen(true);
  };

  const updateLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = async () => {
    const valid = lines.filter((l) => l.product_id);
    if (!docNr.trim() || !supplierId || valid.length === 0) {
      toast({ variant: "destructive", title: "Date incomplete", description: "Completează nr. document, furnizorul și cel puțin un produs." });
      return;
    }
    setSaving(true);
    try {
      const supplier = refs.suppliers.find((s) => s.id === supplierId);
      const header = {
        inventory_type: inventoryType, document_number: docNr.trim(), expected_date: date || null,
        supplier_id: supplierId, supplier_name: supplier?.name || null, notes: notes.trim() || null,
      };
      let pid = editId;
      if (pid) {
        const { error } = await supabaseCloud.from("prereceptii").update(header).eq("id", pid);
        if (error) throw error;
      } else {
        const { data, error } = await supabaseCloud.from("prereceptii")
          .insert({ ...header, created_by_email: await currentEmail() }).select("id").single();
        if (error) throw error;
        pid = (data as any).id;
      }
      const existing = list.find((p) => p.id === pid)?.linii || [];
      const keepIds = new Set(valid.filter((l) => l.id).map((l) => l.id));
      const toDelete = existing.filter((l) => !keepIds.has(l.id) && !l.received_at).map((l) => l.id);
      if (toDelete.length) await supabaseCloud.from("prereceptie_linii").delete().in("id", toDelete);
      for (let i = 0; i < valid.length; i++) {
        const l = valid[i];
        const prod = refs.products.find((p) => p.id === l.product_id);
        const man = refs.manufacturers.find((m) => m.id === l.manufacturer_id);
        const row = {
          prereceptie_id: pid, position: i, product_id: l.product_id, product_name: prod?.name || "",
          manufacturer_id: l.manufacturer_id, manufacturer_name: man?.name || null,
          cantitate_document: l.cantitate_document || 0,
          unit: prod?.default_unit || (inventoryType === "etichete" ? "buc" : "kg"),
          pallets: l.pallets.filter((r) => r.id && r.count > 0),
          crates: l.crates.filter((r) => r.id && r.count > 0),
        };
        const { error } = l.id
          ? await supabaseCloud.from("prereceptie_linii").update(row).eq("id", l.id)
          : await supabaseCloud.from("prereceptie_linii").insert(row);
        if (error) throw error;
      }
      const { data: fresh } = await supabaseCloud.from("prereceptie_linii").select("*").eq("prereceptie_id", pid!);
      await supabaseCloud.from("prereceptii").update({ status: computeStatus((fresh as any[]) || []) }).eq("id", pid!);
      toast({ title: editId ? "Prerecepție actualizată" : "Prerecepție salvată", description: `Document ${docNr}` });
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Eroare la salvare", description: e.message });
    } finally { setSaving(false); }
  };

  const remove = async (p: Prereceptie) => {
    if (!window.confirm(`Ștergi prerecepția ${p.document_number}?`)) return;
    const { error } = await supabaseCloud.from("prereceptii").delete().eq("id", p.id);
    if (error) toast({ variant: "destructive", title: "Eroare", description: error.message });
    else load();
  };

  const fmt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("ro-RO", { maximumFractionDigits: 2 }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Prerecepție</h3>
          <p className="text-sm text-muted-foreground">Documentele care urmează să sosească. Recepționerul le preia din formularul de recepție.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" />Prerecepție nouă</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Caută document, furnizor, produs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="deschise">De recepționat</SelectItem>
            <SelectItem value="receptionata">Recepționate</SelectItem>
            <SelectItem value="toate">Toate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nicio prerecepție.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.supplier_name}</span>
                    <span className="text-sm text-muted-foreground">Doc. {p.document_number}</span>
                    {p.expected_date && <span className="text-sm text-muted-foreground">· sosire {new Date(p.expected_date).toLocaleDateString("ro-RO")}</span>}
                    <Badge variant={p.status === "receptionata" ? "default" : p.status === "partial" ? "secondary" : "outline"}>
                      {STATUS_LABEL[p.status] || p.status}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="text-left py-1 pr-2">Produs</th>
                        {isMP && <th className="text-left py-1 pr-2">Producător</th>}
                        <th className="text-left py-1 pr-2">Paleți / lăzi document</th>
                        <th className="text-right py-1 pr-2">Cant. document</th>
                        <th className="text-right py-1 pr-2">Cant. recepționată</th>
                        <th className="text-right py-1">Diferență</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.linii.map((l) => {
                        const diff = l.received_quantity != null ? Number(l.received_quantity) - Number(l.cantitate_document) : null;
                        return (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="py-1 pr-2 font-medium">{l.product_name}</td>
                            {isMP && <td className="py-1 pr-2">{l.manufacturer_name || "—"}</td>}
                            <td className="py-1 pr-2 text-xs">
                              {[breakdownText(l.pallets) && `${breakdownText(l.pallets)} paleți`, breakdownText(l.crates) && `${breakdownText(l.crates)} lăzi`].filter(Boolean).join(" / ") || "—"}
                            </td>
                            <td className="py-1 pr-2 text-right">{fmt(l.cantitate_document)} {l.unit}</td>
                            <td className="py-1 pr-2 text-right">{l.received_at ? `${fmt(l.received_quantity)} ${l.unit || ""}` : <span className="text-muted-foreground">în așteptare</span>}</td>
                            <td className={`py-1 text-right font-medium ${diff != null && diff < 0 ? "text-destructive" : ""}`}>
                              {diff == null ? "—" : `${diff > 0 ? "+" : ""}${fmt(diff)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle>{editId ? "Editează prerecepția" : "Prerecepție nouă"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nr. document</label>
                <Input value={docNr} onChange={(e) => setDocNr(e.target.value)} placeholder="ex. DDT-10759" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Data sosirii</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Furnizor</label>
                <Select value={supplierId || ""} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Alege furnizorul" /></SelectTrigger>
                  <SelectContent>{refs.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Observații</label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="space-y-3">
              <div className="font-semibold">Produse</div>
              {lines.map((l, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">#{i + 1}{l.received && <Badge className="ml-2">Recepționat</Badge>}</span>
                    {!l.received && lines.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                  <div className={`grid grid-cols-1 gap-2 ${isMP ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                    <Select value={l.product_id || ""} disabled={l.received} onValueChange={(v) => updateLine(i, { product_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Produs" /></SelectTrigger>
                      <SelectContent>{refs.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {isMP && (
                      <Select value={l.manufacturer_id || ""} disabled={l.received} onValueChange={(v) => updateLine(i, { manufacturer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Producător" /></SelectTrigger>
                        <SelectContent>{refs.manufacturers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    <Input type="number" step="0.01" disabled={l.received} placeholder="Cantitate document"
                      value={l.cantitate_document || ""} onChange={(e) => updateLine(i, { cantitate_document: parseFloat(e.target.value) || 0 })} />
                  </div>
                  {inventoryType !== "etichete" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <BreakdownEditor label="Paleți" rows={l.pallets} options={refs.pallets} disabled={l.received} onChange={(r) => updateLine(i, { pallets: r })} />
                      <BreakdownEditor label="Lăzi" rows={l.crates} options={refs.crates} disabled={l.received} onChange={(r) => updateLine(i, { crates: r })} />
                    </div>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLines([...lines, emptyLine()])}><Plus className="h-4 w-4 mr-1" />Adaugă produs</Button>
            </div>
          </div>
          <DialogFooter className="p-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrereceptieView;
