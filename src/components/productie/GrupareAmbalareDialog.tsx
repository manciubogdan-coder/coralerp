import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useProducts } from "@/hooks/productie/useProductionData";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Layers, Wand2, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type FilterMode = "all" | "grouped" | "ungrouped";

const GrupareAmbalareDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const { data: products, isLoading } = useProducts();
  const [map, setMap] = useState<Record<string, string>>({});
  const [initialMap, setInitialMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkGroupName, setBulkGroupName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setBulkGroupName("");
    (async () => {
      const { data, error } = await supabaseCloud
        .from("productie_grupare_ambalare")
        .select("produs_id, grup_nume");
      if (error) {
        toast({ variant: "destructive", title: "Eroare", description: error.message });
        return;
      }
      const m: Record<string, string> = {};
      (data || []).forEach((r: any) => { m[r.produs_id] = r.grup_nume; });
      setMap(m);
      setInitialMap(m);
    })();
  }, [open, toast]);

  const existingGroups = useMemo(() => {
    return Array.from(new Set(Object.values(map).map((v) => (v || "").trim()).filter(Boolean))).sort();
  }, [map]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const gf = groupFilter.trim().toLowerCase();
    let list = (products || []) as any[];
    if (s) list = list.filter((p) => p.nume.toLowerCase().includes(s));
    if (filterMode === "grouped") list = list.filter((p) => (map[p.id] || "").trim() !== "");
    if (filterMode === "ungrouped") list = list.filter((p) => (map[p.id] || "").trim() === "");
    if (gf) list = list.filter((p) => (map[p.id] || "").trim().toLowerCase().includes(gf));
    return list;
  }, [products, search, filterMode, groupFilter, map]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p: any) => selected.has(p.id));
  const toggleAllVisible = () => {
    const next = new Set(selected);
    if (allVisibleSelected) filtered.forEach((p: any) => next.delete(p.id));
    else filtered.forEach((p: any) => next.add(p.id));
    setSelected(next);
  };

  const applyBulk = () => {
    const name = bulkGroupName.trim();
    if (selected.size === 0) {
      toast({ variant: "destructive", title: "Selectează produse", description: "Bifează produsele pe care vrei să le grupezi." });
      return;
    }
    setMap((prev) => {
      const u = { ...prev };
      selected.forEach((id) => { u[id] = name; });
      return u;
    });
    toast({ title: name ? `Grup aplicat: ${name}` : "Grup eliminat", description: `${selected.size} produse actualizate (nesalvat).` });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toUpsert: { produs_id: string; grup_nume: string }[] = [];
      const toDelete: string[] = [];
      const allIds = new Set([...Object.keys(map), ...Object.keys(initialMap)]);
      allIds.forEach((id) => {
        const cur = (map[id] || "").trim();
        const prev = (initialMap[id] || "").trim();
        if (cur === prev) return;
        if (cur === "") toDelete.push(id);
        else toUpsert.push({ produs_id: id, grup_nume: cur });
      });

      if (toUpsert.length > 0) {
        const { error } = await supabaseCloud
          .from("productie_grupare_ambalare")
          .upsert(toUpsert, { onConflict: "produs_id" });
        if (error) throw error;
      }
      if (toDelete.length > 0) {
        const { error } = await supabaseCloud
          .from("productie_grupare_ambalare")
          .delete()
          .in("produs_id", toDelete);
        if (error) throw error;
      }

      toast({ title: "Salvat", description: `${toUpsert.length + toDelete.length} modificări.` });
      setInitialMap({ ...map });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Eroare", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const totalProducts = products?.length || 0;
  const groupedCount = Object.values(map).filter((v) => (v || "").trim() !== "").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-coral-primary" />
            Grupare ambalare pe produse
            <Badge variant="outline" className="ml-2">{groupedCount} / {totalProducts} grupate</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground">
          Bifează mai multe produse și scrie un nume de grup jos pentru a le grupa dintr-o singură mișcare. Lasă gol pentru a scoate din grup.
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Caută produs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <div className="flex rounded border overflow-hidden">
            {(["all", "ungrouped", "grouped"] as FilterMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setFilterMode(m); setGroupFilter(""); }}
                className={`px-3 py-1.5 text-xs ${filterMode === m ? "bg-coral-primary text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                {m === "all" ? "Toate" : m === "ungrouped" ? "Fără grup" : "Cu grup"}
              </button>
            ))}
          </div>
          <div className="relative min-w-48 flex-1 max-w-80">
            <Input
              placeholder="Caută sau selectează grup..."
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              list="grupare-existing"
              className="pr-8"
            />
            {groupFilter && (
              <button
                type="button"
                aria-label="Șterge filtrul de grup"
                onClick={() => setGroupFilter("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="ml-auto text-xs text-gray-500">{filtered.length} afișate · {selected.size} selectate</div>
        </div>

        {/* Bulk assign bar */}
        <div className="flex items-center gap-2 p-2 border rounded bg-amber-50">
          <Wand2 className="h-4 w-4 text-amber-700 shrink-0" />
          <Input
            placeholder="Nume grup pentru selecție (gol = elimină din grup)"
            value={bulkGroupName}
            onChange={(e) => setBulkGroupName(e.target.value)}
            list="grupare-existing"
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={applyBulk}
            disabled={selected.size === 0}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Aplică la {selected.size}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            Deselectează
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="p-2 w-10">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} />
                </th>
                <th className="text-left p-2 font-medium">Produs</th>
                <th className="text-left p-2 font-medium w-[40%]">Grup ambalare</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3} className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="p-4 text-center text-gray-500">Nu există produse</td></tr>
              ) : filtered.map((p: any) => {
                const isSel = selected.has(p.id);
                return (
                  <tr key={p.id} className={`border-t ${isSel ? "bg-amber-50/60" : ""}`}>
                    <td className="p-2">
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={(v) => {
                          const next = new Set(selected);
                          if (v) next.add(p.id); else next.delete(p.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="p-2">{p.nume}</td>
                    <td className="p-2">
                      <Input
                        value={map[p.id] || ""}
                        onChange={(e) => setMap((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="— fără grup —"
                        list="grupare-existing"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="grupare-existing">
            {existingGroups.map((g) => <option key={g} value={g} />)}
          </datalist>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Anulează</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-coral-primary hover:bg-coral-600 text-white">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GrupareAmbalareDialog;
