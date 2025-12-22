
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
import { Product } from "@/types";
import { useInventoryType } from "@/context/inventory-type";

const ProductsTable = () => {
  const { inventoryType } = useInventoryType();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<Partial<Product>>({ name: "", default_unit: "kg", description: "", cod_produs: "", pt_percent: 0 });
  const [editItem, setEditItem] = useState<Product | null>(null);

  // Get the correct table name based on inventory type
  const getTableName = () => inventoryType === 'ambalaje' ? 'ambalaje_products' : 'products';

  useEffect(() => {
    fetchProducts();
  }, [inventoryType]); // Re-fetch when inventory type changes

  const fetchProducts = async () => {
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

      console.log(`Loading ${inventoryType} products from table:`, tableName, data);
      setProducts(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: `Eroare la încărcarea produselor ${inventoryType}`,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setNewItem({ name: "", default_unit: "kg", description: "", cod_produs: "", pt_percent: 0 });
  };

  const handleCancelAdd = () => {
    setIsAddingNew(false);
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditItem({ ...product });
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
          title: "Nume produs lipsă",
          description: "Vă rugăm să introduceți un nume pentru produs.",
        });
        return;
      }

      const tableName = getTableName();
      const { data, error } = await supabase
        .from(tableName)
        .insert([
          {
            name: newItem.name,
            default_unit: newItem.default_unit || "kg",
            description: newItem.description || null,
            cod_produs: newItem.cod_produs || null,
            pt_percent: newItem.pt_percent ?? 0,
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Produs adăugat",
        description: `Produsul ${newItem.name} a fost adăugat cu succes.`,
      });

      setIsAddingNew(false);
      setProducts([...(data || []), ...products]);
      fetchProducts(); // Refresh to get server-generated fields
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la adăugarea produsului",
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
          title: "Nume produs lipsă",
          description: "Vă rugăm să introduceți un nume pentru produs.",
        });
        return;
      }

      const tableName = getTableName();
      const { error } = await supabase
        .from(tableName)
        .update({
          name: editItem.name,
          default_unit: editItem.default_unit,
          description: editItem.description,
          cod_produs: editItem.cod_produs,
          pt_percent: editItem.pt_percent,
        })
        .eq("id", editItem.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Produs actualizat",
        description: `Produsul ${editItem.name} a fost actualizat cu succes.`,
      });

      setEditingId(null);
      fetchProducts(); // Refresh data
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Eroare la actualizarea produsului",
        description: error.message,
      });
    }
  };

  const handleDelete = async (productId: string, productName: string) => {
    if (window.confirm(`Sigur doriți să ștergeți produsul "${productName}"?`)) {
      try {
        const tableName = getTableName();
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("id", productId);

        if (error) {
          throw error;
        }

        toast({
          title: "Produs șters",
          description: `Produsul ${productName} a fost șters cu succes.`,
        });

        setProducts(products.filter((p) => p.id !== productId));
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Eroare la ștergerea produsului",
          description: error.message,
        });
      }
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Produse</h2>
        <Button onClick={handleAddNew} disabled={isAddingNew}>
          <Plus className="h-4 w-4 mr-2" /> Adaugă produs
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cod Produs</TableHead>
            <TableHead>Nume</TableHead>
            <TableHead>Unitate de măsură</TableHead>
            <TableHead>Descriere</TableHead>
            <TableHead>% PT</TableHead>
            <TableHead className="w-[150px]">Acțiuni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isAddingNew && (
            <TableRow>
              <TableCell>
                <Input
                  value={newItem.cod_produs || ""}
                  onChange={(e) => setNewItem({ ...newItem, cod_produs: e.target.value })}
                  placeholder="Cod produs"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Nume produs"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.default_unit}
                  onChange={(e) => setNewItem({ ...newItem, default_unit: e.target.value })}
                  placeholder="Unitate de măsură"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.description || ""}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Descriere (opțional)"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={newItem.pt_percent ?? 0}
                  onChange={(e) =>
                    setNewItem({ ...newItem, pt_percent: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="% PT"
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

          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                {editingId === product.id ? (
                  <Input
                    value={editItem?.cod_produs || ""}
                    onChange={(e) => setEditItem({ ...editItem!, cod_produs: e.target.value })}
                  />
                ) : (
                  product.cod_produs || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === product.id ? (
                  <Input
                    value={editItem?.name || ""}
                    onChange={(e) => setEditItem({ ...editItem!, name: e.target.value })}
                  />
                ) : (
                  product.name
                )}
              </TableCell>
              <TableCell>
                {editingId === product.id ? (
                  <Input
                    value={editItem?.default_unit || ""}
                    onChange={(e) => setEditItem({ ...editItem!, default_unit: e.target.value })}
                  />
                ) : (
                  product.default_unit
                )}
              </TableCell>
              <TableCell>
                {editingId === product.id ? (
                  <Input
                    value={editItem?.description || ""}
                    onChange={(e) => setEditItem({ ...editItem!, description: e.target.value || null })}
                  />
                ) : (
                  product.description || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === product.id ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editItem?.pt_percent ?? 0}
                    onChange={(e) => setEditItem({ ...editItem!, pt_percent: parseFloat(e.target.value) || 0 })}
                  />
                ) : (
                  (product.pt_percent ?? 0).toString()
                )}
              </TableCell>
              <TableCell>
                {editingId === product.id ? (
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
                    <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(product.id, product.name)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}

          {products.length === 0 && !isAddingNew && !loading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nu există produse. Adăugați unul nou folosind butonul de mai sus.
              </TableCell>
            </TableRow>
          )}

          {loading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Se încarcă produsele...
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ProductsTable;
