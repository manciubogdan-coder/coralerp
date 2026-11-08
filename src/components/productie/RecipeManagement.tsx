
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ChefHat, Search } from "lucide-react";
import { useRecipes, useDeleteRecipe } from "@/hooks/productie/useRecipes";
import RecipeEditDialog from "./RecipeEditDialog";

const RecipeManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const { toast } = useToast();
  const { data: recipes, isLoading } = useRecipes();
  const deleteRecipe = useDeleteRecipe();

  const filteredRecipes = useMemo(() => {
    const needle = searchTerm.trim().toLocaleLowerCase('ro-RO');
    if (!needle) return recipes || [];

    return (recipes || []).filter(recipe => {
      const ingredientNames = recipe.productie_retete_ingrediente
        ?.map(ingredient => ingredient.productie_ingrediente?.nume || '')
        .join(' ') || '';

      return [
        recipe.nume_reteta,
        recipe.productie_produse?.nume,
        recipe.descriere,
        ingredientNames,
      ].some(value => value?.toLocaleLowerCase('ro-RO').includes(needle));
    });
  }, [recipes, searchTerm]);

  const handleEdit = (recipe: any) => {
    setEditingRecipe(recipe);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Ești sigur că vrei să ștergi această rețetă?')) {
      try {
        await deleteRecipe.mutateAsync(id);
        toast({
          title: "Success",
          description: "Rețeta a fost ștearsă cu succes!"
        });
      } catch (error: any) {
        toast({
          title: "Eroare",
          description: error.message || 'A apărut o eroare',
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestionare Rețete</h2>
          <p className="text-muted-foreground">Creează și gestionează rețetele pentru produse</p>
        </div>
        
        <Button className="flex items-center gap-2" onClick={() => { setEditingRecipe(null); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          Adaugă Rețetă
        </Button>
        <RecipeEditDialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setEditingRecipe(null); }} recipe={editingRecipe} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Lista Rețete ({recipes?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Caută după rețetă, produs sau ingredient..."
              className="pl-9"
            />
          </div>
          {isLoading ? (
            <div className="text-center py-4">Se încarcă rețetele...</div>
          ) : !recipes || recipes.length === 0 ? (
            <div className="text-center py-8">
              <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nu există rețete în sistem.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Adaugă prima rețetă pentru a începe producția.
              </p>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nu am găsit nicio rețetă pentru „{searchTerm}”.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume Rețetă</TableHead>
                  <TableHead>Produs</TableHead>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Creării</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">{recipe.nume_reteta}</TableCell>
                    <TableCell>{recipe.productie_produse?.nume}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {recipe.productie_retete_ingrediente?.length || 0} ingrediente
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={recipe.activa ? "default" : "secondary"}>
                        {recipe.activa ? 'Activă' : 'Inactivă'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(recipe.created_at).toLocaleDateString('ro-RO')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(recipe)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(recipe.id)}
                          className="text-red-600 hover:text-red-700"
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

export default RecipeManagement;
