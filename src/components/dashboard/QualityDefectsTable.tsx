import React, { useEffect, useState } from "react";
import { toast } from "@/hooks/use-custom-toast";
import { Pencil, Trash, Plus, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useInventoryType } from "@/context/inventory-type";

interface QualityDefect {
  id: string;
  name: string;
  description?: string | null;
}

const getTableName = (inventoryType: string) => {
  if (inventoryType === "ambalaje") return "ambalaje_quality_defects";
  if (inventoryType === "etichete") return "etichete_quality_defects";
  return "quality_defects";
};

const QualityDefectsTable: React.FC = () => {
  const { inventoryType } = useInventoryType();
  const [items, setItems] = useState<QualityDefect[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<QualityDefect | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<Partial<QualityDefect>>({ name: "", description: "" });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from(getTableName(inventoryType))
        .select("*")
        .order("name");
      if (error) throw error;
      setItems((data as QualityDefect[]) || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Eroare la încărcare defecte", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [inventoryType]);

  const handleSaveNew = async () => {
    if (!newItem.name?.trim()) {
      toast({ variant: "destructive", title: "Nume lipsă" });
      return;
    }
    try {
      const { error } = await (supabase as any)
        .from(getTableName(inventoryType))
        .insert([{ name: newItem.name.trim(), description: newItem.description?.trim() || null }]);
      if (error) throw error;
      toast({ title: "Defect adăugat" });
      setIsAddingNew(false);
      setNewItem({ name: "", description: "" });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Eroare", description: error.message });
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    if (!editItem.name?.trim()) {
      toast({ variant: "destructive", title: "Nume lipsă" });
      return;
    }
    try {
      const { error } = await (supabase as any)
        .from(getTableName(inventoryType))
        .update({ name: editItem.name.trim(), description: editItem.description?.trim() || null })
        .eq("id", editItem.id);
      if (error) throw error;
      toast({ title: "Actualizat" });
      setEditingId(null);
      setEditItem(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Eroare", description: error.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Sigur ștergi defectul "${name}"?`)) return;
    try {
      const { error } = await (supabase as any)
        .from(getTableName(inventoryType))
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Șters" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Eroare", description: error.message });
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">Defecte calitate (imperfecțiuni)</h2>
          <p className="text-sm text-muted-foreground">
            Lista din care echipa de calitate poate bifa la recepție (ex: frunze galbene, putregai, marfă înghețată).
          </p>
        </div>
        <Button onClick={() => setIsAddingNew(true)} disabled={isAddingNew}>
          <Plus className="h-4 w-4 mr-2" /> Adaugă defect
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nume</TableHead>
            <TableHead>Descriere</TableHead>
            <TableHead className="w-[150px]">Acțiuni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isAddingNew && (
            <TableRow>
              <TableCell>
                <Input value={newItem.name || ""} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="ex: frunze galbene" />
              </TableCell>
              <TableCell>
                <Input value={newItem.description || ""} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Descriere opțională" />
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button size="sm" onClick={handleSaveNew}><Save className="h-4 w-4 mr-1" /> Salvează</Button>
                  <Button size="sm" variant="outline" onClick={() => { setIsAddingNew(false); setNewItem({ name: "", description: "" }); }}>
                    <X className="h-4 w-4 mr-1" /> Anulează
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {items.map((it) => (
            <TableRow key={it.id}>
              <TableCell>
                {editingId === it.id ? (
                  <Input value={editItem?.name || ""} onChange={(e) => setEditItem({ ...editItem!, name: e.target.value })} />
                ) : it.name}
              </TableCell>
              <TableCell>
                {editingId === it.id ? (
                  <Input value={editItem?.description || ""} onChange={(e) => setEditItem({ ...editItem!, description: e.target.value })} />
                ) : (it.description || "—")}
              </TableCell>
              <TableCell>
                {editingId === it.id ? (
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={handleSaveEdit}><Save className="h-4 w-4 mr-1" /> Salvează</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditItem(null); }}>
                      <X className="h-4 w-4 mr-1" /> Anulează
                    </Button>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(it.id); setEditItem({ ...it }); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleDelete(it.id, it.name)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}

          {items.length === 0 && !isAddingNew && !loading && (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                Nu există defecte definite. Adaugă unul nou.
              </TableCell>
            </TableRow>
          )}
          {loading && (
            <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Se încarcă...</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default QualityDefectsTable;
