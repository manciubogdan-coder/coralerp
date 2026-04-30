
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Package } from "lucide-react";
import { useIngredients, useCreateIngredient, useUpdateIngredient, useDeleteIngredient } from "@/hooks/productie/useIngredients";

const IngredientManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<any>(null);
  const [formData, setFormData] = useState({
    nume: "",
    descriere: "",
    unitate_masura: "kg"
  });
  
  const { toast } = useToast();
  const { data: ingredients, isLoading } = useIngredients();
  const createIngredientMutation = useCreateIngredient();
  const updateIngredientMutation = useUpdateIngredient();
  const deleteIngredientMutation = useDeleteIngredient();

  const resetForm = () => {
    setFormData({
      nume: "",
      descriere: "",
      unitate_masura: "kg"
    });
    setEditingIngredient(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (ingredient: any) => {
    setFormData({
      nume: ingredient.nume,
      descriere: ingredient.descriere || "",
      unitate_masura: ingredient.unitate_masura
    });
    setEditingIngredient(ingredient);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.nume.trim()) {
      toast({
        title: "Eroare",
        description: "Numele ingredientului este obligatoriu",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingIngredient) {
        await updateIngredientMutation.mutateAsync({
          id: editingIngredient.id,
          updates: formData
        });
        toast({
          title: "Ingredient actualizat",
          description: "Ingredientul a fost actualizat cu succes"
        });
      } else {
        await createIngredientMutation.mutateAsync(formData);
        toast({
          title: "Ingredient adăugat",
          description: "Ingredientul a fost adăugat cu succes"
        });
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut salva ingredientul",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string, nume: string) => {
    if (window.confirm(`Sigur doriți să ștergeți ingredientul "${nume}"?`)) {
      try {
        await deleteIngredientMutation.mutateAsync(id);
        toast({
          title: "Ingredient șters",
          description: "Ingredientul a fost șters cu succes"
        });
      } catch (error) {
        toast({
          title: "Eroare",
          description: "Nu s-a putut șterge ingredientul",
          variant: "destructive"
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Management Ingrediente</h2>
          <p className="text-muted-foreground">Gestionarea ingredientelor pentru rețete și producție</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Ingredient Nou
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingIngredient ? "Editare Ingredient" : "Adăugare Ingredient Nou"}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nume">Numele Ingredientului *</Label>
                  <Input
                    id="nume"
                    placeholder="ex: Salată verde"
                    value={formData.nume}
                    onChange={(e) => setFormData({ ...formData, nume: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="descriere">Descriere</Label>
                  <Textarea
                    id="descriere"
                    placeholder="Descrierea ingredientului..."
                    value={formData.descriere}
                    onChange={(e) => setFormData({ ...formData, descriere: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="unitate">Unitatea de Măsură</Label>
                  <Select
                    value={formData.unitate_masura}
                    onValueChange={(value) => setFormData({ ...formData, unitate_masura: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilograme</SelectItem>
                      <SelectItem value="g">Grame</SelectItem>
                      <SelectItem value="litri">Litri</SelectItem>
                      <SelectItem value="ml">Mililitri</SelectItem>
                      <SelectItem value="bucăți">Bucăți</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Anulează
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={createIngredientMutation.isPending || updateIngredientMutation.isPending}
                >
                  {(createIngredientMutation.isPending || updateIngredientMutation.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Se salvează...
                    </>
                  ) : (
                    editingIngredient ? 'Actualizează' : 'Adaugă Ingredient'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Lista Ingredientelor ({ingredients?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!ingredients || ingredients.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nu există ingrediente. Adăugați primul ingredient folosind butonul de mai sus.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>Descriere</TableHead>
                  <TableHead>Unitate Măsură</TableHead>
                  <TableHead>Data Creare</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ingredient) => (
                  <TableRow key={ingredient.id}>
                    <TableCell className="font-medium">{ingredient.nume}</TableCell>
                    <TableCell>{ingredient.descriere || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ingredient.unitate_masura}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(ingredient.created_at).toLocaleDateString('ro-RO')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(ingredient)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(ingredient.id, ingredient.nume)}
                          disabled={deleteIngredientMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IngredientManagement;
