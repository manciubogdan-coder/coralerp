import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useProducts } from "@/hooks/productie/useProductionData";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Layers } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const GrupareAmbalareDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const { data: products, isLoading } = useProducts();
  const [map, setMap] = useState<Record<string, string>>({});
  const [initialMap, setInitialMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
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

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = products || [];
    if (!s) return list;
    return list.filter((p: any) => p.nume.toLowerCase().includes(s));
  }, [products, search]);

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

  // Sugestii = grupuri deja existente
  const existingGroups = useMemo(() => {
    return Array.from(new Set(Object.values(map).map((v) => (v || "").trim()).filter(Boolean))).sort();
  }, [map]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-coral-primary" />
            Grupare ambalare pe produse
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-2">
          Pentru fiecare produs setează un <strong>nume de grup ambalare</strong> identic dacă vrei să apară împreună în vizualizarea „Grupat pe produs" a operatorului
          (ex: <em>MENTA 30 GR</em> pentru toate SKU-urile de mentă 30gr). Lasă gol pentru produsele care nu se grupează.
        </div>
        <Input
          placeholder="Caută produs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        {existingGroups.length > 0 && (
          <div className="text-xs text-gray-500 mb-2">
            Grupuri existente: {existingGroups.map((g) => (
              <span key={g} className="inline-block bg-coral-50 text-coral-primary border border-coral-200 rounded px-1.5 py-0.5 mr-1">{g}</span>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium">Produs</th>
                <th className="text-left p-2 font-medium w-[45%]">Grup ambalare</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={2} className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={2} className="p-4 text-center text-gray-500">Nu există produse</td></tr>
              ) : filtered.map((p: any) => (
                <tr key={p.id} className="border-t">
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
              ))}
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
