
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
import { useInventoryType } from "@/context/inventory-type";

interface Manufacturer {
  id: string;
  name: string;
  country?: string;
  description?: string;
}

const ManufacturersTable = () => {
  const { inventoryType } = useInventoryType();
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<Partial<Manufacturer>>({ name: "", country: "", description: "" });
  const [editItem, setEditItem] = useState<Manufacturer | null>(null);

  // Get the correct table name based on inventory type
  const getTableName = () => {
    if (inventoryType === 'ambalaje') return 'ambalaje_manufacturers';
    if (inventoryType === 'etichete') return 'etichete_manufacturers';
    return 'manufacturers';
  };

  useEffect(() => {
    fetchManufacturers();
  }, [inventoryType]); // Re-fetch when inventory type changes

  const fetchManufacturers = async () => {
    try {
      setLoading(true);
      const tableName = getTableName();
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .order("name");

      if (error) {
        throw error;
      }

      console.log(`Loading ${inventoryType} manufacturers from table:`, tableName, data);
      setManufacturers(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: `Eroare la încărcarea producătorilor ${inventoryType}`,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setNewItem({ name: "", country: "", description: "" });
  };

  const handleCancelAdd = () => {
    setIsAddingNew(false);
  };

  const handleEdit = (manufacturer: Manufacturer) => {
    setEditingId(manufacturer.id);
    setEditItem({ ...manufacturer });
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
          title: "Nume producător lipsă",
          description: "Vă rugăm să introduceți un nume pentru producător.",
        });
        return;
      }

      const tableName = getTableName();
      const { data, error } = await supabase
        .from(tableName)
        .insert([
          {
            name: newItem.name,
            country: newItem.country || null,
            description: newItem.description || null,
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Producător adăugat",
        description: `Producătorul ${newItem.name} a fost adăugat cu succes.`,
      });

      setIsAddingNew(false);
      setManufacturers([...(data || []), ...manufacturers]);
      fetchManufacturers(); // Refresh to get server-generated fields
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la adăugarea producătorului",
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
          title: "Nume producător lipsă",
          description: "Vă rugăm să introduceți un nume pentru producător.",
        });
        return;
      }

      const tableName = getTableName();
      const { error } = await supabase
        .from(tableName)
        .update({
          name: editItem.name,
          country: editItem.country || null,
          description: editItem.description || null,
        })
        .eq("id", editItem.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Producător actualizat",
        description: `Producătorul ${editItem.name} a fost actualizat cu succes.`,
      });

      setEditingId(null);
      fetchManufacturers(); // Refresh data
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la actualizarea producătorului",
        description: error.message,
      });
    }
  };

  const handleDelete = async (manufacturerId: string, manufacturerName: string) => {
    if (window.confirm(`Sigur doriți să ștergeți producătorul "${manufacturerName}"?`)) {
      try {
        const tableName = getTableName();
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("id", manufacturerId);

        if (error) {
          throw error;
        }

        toast({
          title: "Producător șters",
          description: `Producătorul ${manufacturerName} a fost șters cu succes.`,
        });

        setManufacturers(manufacturers.filter((m) => m.id !== manufacturerId));
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Eroare la ștergerea producătorului",
          description: error.message,
        });
      }
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Producători</h2>
        <Button onClick={handleAddNew} disabled={isAddingNew}>
          <Plus className="h-4 w-4 mr-2" /> Adaugă producător
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nume</TableHead>
            <TableHead>Țară</TableHead>
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
                  placeholder="Nume producător"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.country || ""}
                  onChange={(e) => setNewItem({ ...newItem, country: e.target.value })}
                  placeholder="Țară"
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

          {manufacturers.map((manufacturer) => (
            <TableRow key={manufacturer.id}>
              <TableCell>
                {editingId === manufacturer.id ? (
                  <Input
                    value={editItem?.name || ""}
                    onChange={(e) => setEditItem({ ...editItem!, name: e.target.value })}
                  />
                ) : (
                  manufacturer.name
                )}
              </TableCell>
              <TableCell>
                {editingId === manufacturer.id ? (
                  <Input
                    value={editItem?.country || ""}
                    onChange={(e) => setEditItem({ ...editItem!, country: e.target.value })}
                  />
                ) : (
                  manufacturer.country || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === manufacturer.id ? (
                  <Input
                    value={editItem?.description || ""}
                    onChange={(e) => setEditItem({ ...editItem!, description: e.target.value })}
                  />
                ) : (
                  manufacturer.description || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === manufacturer.id ? (
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
                    <Button size="sm" variant="outline" onClick={() => handleEdit(manufacturer)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(manufacturer.id, manufacturer.name)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}

          {manufacturers.length === 0 && !isAddingNew && !loading && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Nu există producători. Adăugați unul nou folosind butonul de mai sus.
              </TableCell>
            </TableRow>
          )}

          {loading && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Se încarcă producătorii...
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ManufacturersTable;
