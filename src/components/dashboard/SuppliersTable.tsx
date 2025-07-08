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
import { useInventoryType } from "@/App";

interface Supplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  supplier_code?: string;
}

const SuppliersTable = () => {
  const { inventoryType } = useInventoryType();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<Partial<Supplier>>({ name: "", contact: "", phone: "", email: "", supplier_code: "" });
  const [editItem, setEditItem] = useState<Supplier | null>(null);

  // Get the correct table name based on inventory type
  const getTableName = () => inventoryType === 'ambalaje' ? 'ambalaje_suppliers' : 'suppliers';

  useEffect(() => {
    fetchSuppliers();
  }, [inventoryType]); // Re-fetch when inventory type changes

  const fetchSuppliers = async () => {
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

      console.log(`Loading ${inventoryType} suppliers from table:`, tableName, data);
      setSuppliers(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: `Eroare la încărcarea furnizorilor ${inventoryType}`,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setNewItem({ name: "", contact: "", phone: "", email: "", supplier_code: "" });
  };

  const handleCancelAdd = () => {
    setIsAddingNew(false);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setEditItem({ ...supplier });
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
          title: "Nume furnizor lipsă",
          description: "Vă rugăm să introduceți un nume pentru furnizor.",
        });
        return;
      }

      const tableName = getTableName();
      const { data, error } = await supabase
        .from(tableName)
        .insert([
          {
            name: newItem.name,
            contact: newItem.contact || null,
            phone: newItem.phone || null,
            email: newItem.email || null,
            supplier_code: newItem.supplier_code || null,
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Furnizor adăugat",
        description: `Furnizorul ${newItem.name} a fost adăugat cu succes.`,
      });

      setIsAddingNew(false);
      setSuppliers([...(data || []), ...suppliers]);
      fetchSuppliers(); // Refresh to get server-generated fields
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la adăugarea furnizorului",
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
          title: "Nume furnizor lipsă",
          description: "Vă rugăm să introduceți un nume pentru furnizor.",
        });
        return;
      }

      const tableName = getTableName();
      const { error } = await supabase
        .from(tableName)
        .update({
          name: editItem.name,
          contact: editItem.contact || null,
          phone: editItem.phone || null,
          email: editItem.email || null,
          supplier_code: editItem.supplier_code || null,
        })
        .eq("id", editItem.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Furnizor actualizat",
        description: `Furnizorul ${editItem.name} a fost actualizat cu succes.`,
      });

      setEditingId(null);
      fetchSuppliers(); // Refresh data
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la actualizarea furnizorului",
        description: error.message,
      });
    }
  };

  const handleDelete = async (supplierId: string, supplierName: string) => {
    if (window.confirm(`Sigur doriți să ștergeți furnizorul "${supplierName}"?`)) {
      try {
        const tableName = getTableName();
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("id", supplierId);

        if (error) {
          throw error;
        }

        toast({
          title: "Furnizor șters",
          description: `Furnizorul ${supplierName} a fost șters cu succes.`,
        });

        setSuppliers(suppliers.filter((s) => s.id !== supplierId));
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Eroare la ștergerea furnizorului",
          description: error.message,
        });
      }
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Furnizori</h2>
        <Button onClick={handleAddNew} disabled={isAddingNew}>
          <Plus className="h-4 w-4 mr-2" /> Adaugă furnizor
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nume</TableHead>
            <TableHead>Cod Furnizor</TableHead>
            <TableHead>Persoana de contact</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>Email</TableHead>
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
                  placeholder="Nume furnizor"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.supplier_code || ""}
                  onChange={(e) => setNewItem({ ...newItem, supplier_code: e.target.value })}
                  placeholder="Cod furnizor"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.contact || ""}
                  onChange={(e) => setNewItem({ ...newItem, contact: e.target.value })}
                  placeholder="Persoana de contact"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.phone || ""}
                  onChange={(e) => setNewItem({ ...newItem, phone: e.target.value })}
                  placeholder="Număr de telefon"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.email || ""}
                  onChange={(e) => setNewItem({ ...newItem, email: e.target.value })}
                  placeholder="Adresă de email"
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

          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell>
                {editingId === supplier.id ? (
                  <Input
                    value={editItem?.name || ""}
                    onChange={(e) => setEditItem({ ...editItem!, name: e.target.value })}
                  />
                ) : (
                  supplier.name
                )}
              </TableCell>
              <TableCell>
                {editingId === supplier.id ? (
                  <Input
                    value={editItem?.supplier_code || ""}
                    onChange={(e) => setEditItem({ ...editItem!, supplier_code: e.target.value })}
                  />
                ) : (
                  supplier.supplier_code || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === supplier.id ? (
                  <Input
                    value={editItem?.contact || ""}
                    onChange={(e) => setEditItem({ ...editItem!, contact: e.target.value })}
                  />
                ) : (
                  supplier.contact || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === supplier.id ? (
                  <Input
                    value={editItem?.phone || ""}
                    onChange={(e) => setEditItem({ ...editItem!, phone: e.target.value })}
                  />
                ) : (
                  supplier.phone || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === supplier.id ? (
                  <Input
                    value={editItem?.email || ""}
                    onChange={(e) => setEditItem({ ...editItem!, email: e.target.value })}
                  />
                ) : (
                  supplier.email || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === supplier.id ? (
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
                    <Button size="sm" variant="outline" onClick={() => handleEdit(supplier)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(supplier.id, supplier.name)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}

          {suppliers.length === 0 && !isAddingNew && !loading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nu există furnizori. Adăugați unul nou folosind butonul de mai sus.
              </TableCell>
            </TableRow>
          )}

          {loading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Se încarcă furnizorii...
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default SuppliersTable;
