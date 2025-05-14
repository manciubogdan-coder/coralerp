
import React, { useState, useEffect } from "react";
import { toast } from "@/hooks/use-custom-toast";
import { Pencil, Trash, Plus, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CrateType {
  id: string;
  name: string;
  weight: number;
  description?: string;
}

const CrateTypesTable = () => {
  const [crateTypes, setCrateTypes] = useState<CrateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<Partial<CrateType>>({ name: "", weight: 0, description: "" });
  const [editItem, setEditItem] = useState<CrateType | null>(null);

  useEffect(() => {
    fetchCrateTypes();
  }, []);

  const fetchCrateTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("crate_types")
        .select("*")
        .order("name");

      if (error) {
        throw error;
      }

      setCrateTypes(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la încărcarea tipurilor de lădițe",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setNewItem({ name: "", weight: 0, description: "" });
  };

  const handleCancelAdd = () => {
    setIsAddingNew(false);
  };

  const handleEdit = (crateType: CrateType) => {
    setEditingId(crateType.id);
    setEditItem({ ...crateType });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditItem(null);
  };

  const handleSaveNew = async () => {
    try {
      if (!newItem.name) {
        toast({
          variant: "destructive",
          title: "Nume tip lădiță lipsă",
          description: "Vă rugăm să introduceți un nume pentru tipul de lădiță.",
        });
        return;
      }

      if (isNaN(Number(newItem.weight)) || Number(newItem.weight) < 0) {
        toast({
          variant: "destructive",
          title: "Greutate invalidă",
          description: "Vă rugăm să introduceți o greutate validă (număr pozitiv).",
        });
        return;
      }

      const { data, error } = await supabase
        .from("crate_types")
        .insert([
          {
            name: newItem.name,
            weight: Number(newItem.weight),
            description: newItem.description || null,
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Tip lădiță adăugat",
        description: `Tipul de lădiță ${newItem.name} a fost adăugat cu succes.`,
      });

      setIsAddingNew(false);
      setCrateTypes([...(data || []), ...crateTypes]);
      fetchCrateTypes(); // Refresh to get server-generated fields
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la adăugarea tipului de lădiță",
        description: error.message,
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    
    try {
      if (!editItem.name) {
        toast({
          variant: "destructive",
          title: "Nume tip lădiță lipsă",
          description: "Vă rugăm să introduceți un nume pentru tipul de lădiță.",
        });
        return;
      }

      if (isNaN(Number(editItem.weight)) || Number(editItem.weight) < 0) {
        toast({
          variant: "destructive",
          title: "Greutate invalidă",
          description: "Vă rugăm să introduceți o greutate validă (număr pozitiv).",
        });
        return;
      }

      const { error } = await supabase
        .from("crate_types")
        .update({
          name: editItem.name,
          weight: Number(editItem.weight),
          description: editItem.description || null,
        })
        .eq("id", editItem.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Tip lădiță actualizat",
        description: `Tipul de lădiță ${editItem.name} a fost actualizat cu succes.`,
      });

      setEditingId(null);
      fetchCrateTypes(); // Refresh data
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la actualizarea tipului de lădiță",
        description: error.message,
      });
    }
  };

  const handleDelete = async (crateTypeId: string, crateTypeName: string) => {
    if (window.confirm(`Sigur doriți să ștergeți tipul de lădiță "${crateTypeName}"?`)) {
      try {
        const { error } = await supabase
          .from("crate_types")
          .delete()
          .eq("id", crateTypeId);

        if (error) {
          throw error;
        }

        toast({
          title: "Tip lădiță șters",
          description: `Tipul de lădiță ${crateTypeName} a fost șters cu succes.`,
        });

        setCrateTypes(crateTypes.filter((c) => c.id !== crateTypeId));
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Eroare la ștergerea tipului de lădiță",
          description: error.message,
        });
      }
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Tipuri de lădițe</h2>
        <Button onClick={handleAddNew} disabled={isAddingNew}>
          <Plus className="h-4 w-4 mr-2" /> Adaugă tip lădiță
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nume</TableHead>
            <TableHead>Greutate (kg)</TableHead>
            <TableHead>Descriere</TableHead>
            <TableHead className="w-[150px]">Acțiuni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isAddingNew && (
            <TableRow>
              <TableCell>
                <Input
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Nume tip lădiță"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.weight?.toString() || ""}
                  onChange={(e) => setNewItem({ ...newItem, weight: parseFloat(e.target.value) || 0 })}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Greutate (kg)"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.description || ""}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Descriere"
                />
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button size="sm" onClick={handleSaveNew}>
                    <Save className="h-4 w-4 mr-1" /> Salvează
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelAdd}>
                    <X className="h-4 w-4 mr-1" /> Anulează
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {crateTypes.map((crateType) => (
            <TableRow key={crateType.id}>
              <TableCell>
                {editingId === crateType.id ? (
                  <Input
                    value={editItem?.name || ""}
                    onChange={(e) => setEditItem({ ...editItem!, name: e.target.value })}
                  />
                ) : (
                  crateType.name
                )}
              </TableCell>
              <TableCell>
                {editingId === crateType.id ? (
                  <Input
                    value={editItem?.weight?.toString() || ""}
                    onChange={(e) => setEditItem({ ...editItem!, weight: parseFloat(e.target.value) || 0 })}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                ) : (
                  crateType.weight
                )}
              </TableCell>
              <TableCell>
                {editingId === crateType.id ? (
                  <Input
                    value={editItem?.description || ""}
                    onChange={(e) => setEditItem({ ...editItem!, description: e.target.value })}
                  />
                ) : (
                  crateType.description || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === crateType.id ? (
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Save className="h-4 w-4 mr-1" /> Salvează
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-1" /> Anulează
                    </Button>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(crateType)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(crateType.id, crateType.name)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}

          {crateTypes.length === 0 && !isAddingNew && !loading && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Nu există tipuri de lădițe. Adăugați unul nou folosind butonul de mai sus.
              </TableCell>
            </TableRow>
          )}

          {loading && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Se încarcă tipurile de lădițe...
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default CrateTypesTable;
