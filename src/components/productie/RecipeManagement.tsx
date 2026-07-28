
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ChefHat, Minus, Search } from "lucide-react";
import { useRecipes, useCreateRecipe, useUpdateRecipe, useDeleteRecipe } from "@/hooks/productie/useRecipes";
import { useProducts } from "@/hooks/productie/useProductionData";
import { useIngredients } from "@/hooks/productie/useIngredients";

interface IngredientFormData {
  ingredient_id: string;
  cantitate_necesara: number;
  unitate_masura: string;
  observatii: string;
}

const RecipeManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const [formData, setFormData] = useState({
    produs_id: '',
    nume_reteta: '',
    descriere: ''
  });
  const [ingredienteForms, setIngredienteForms] = useState<IngredientFormData[]>([
    { ingredient_id: '', cantitate_necesara: 0, unitate_masura: 'kg', observatii: '' }
  ]);

  const { toast } = useToast();
  const { data: recipes, isLoading } = useRecipes();
  const { data: products } = useProducts();
  const { data: ingredients } = useIngredients();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nume_reteta.trim() || !formData.produs_id) {
      toast({
        title: "Eroare",
        description: "Numele rețetei și produsul sunt obligatorii",
        variant: "destructive"
      });
      return;
    }

    const ingredienteValide = ingredienteForms.filter(ing => 
      ing.ingredient_id && ing.cantitate_necesara > 0
    );

    if (ingredienteValide.length === 0) {
      toast({
        title: "Eroare", 
        description: "Trebuie să adaugi cel puțin un ingredient",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingRecipe) {
        await updateRecipe.mutateAsync({
          id: editingRecipe.id,
          updates: formData,
          ingrediente: ingredienteValide
        });
        toast({
          title: "Success",
          description: "Rețeta a fost actualizată cu succes!"
        });
      } else {
        await createRecipe.mutateAsync({
          ...formData,
          ingrediente: ingredienteValide
        });
        toast({
          title: "Success", 
          description: "Rețeta a fost creată cu succes!"
        });
      }
      
      handleCloseDialog();
    } catch (error: any) {
      toast({
        title: "Eroare",
        description: error.message || 'A apărut o eroare',
        variant: "destructive"
      });
    }
  };

  const handleEdit = (recipe: any) => {
    setEditingRecipe(recipe);
    setFormData({
      produs_id: recipe.produs_id,
      nume_reteta: recipe.nume_reteta,
      descriere: recipe.descriere || ''
    });
    
    if (recipe.productie_retete_ingrediente && recipe.productie_retete_ingrediente.length > 0) {
      setIngredienteForms(recipe.productie_retete_ingrediente.map((ing: any) => ({
        ingredient_id: ing.ingredient_id,
        cantitate_necesara: ing.cantitate_necesara,
        unitate_masura: ing.unitate_masura,
        observatii: ing.observatii || ''
      })));
    } else {
      setIngredienteForms([
        { ingredient_id: '', cantitate_necesara: 0, unitate_masura: 'kg', observatii: '' }
      ]);
    }
    
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

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRecipe(null);
    setFormData({
      produs_id: '',
      nume_reteta: '',
      descriere: ''
    });
    setIngredienteForms([
      { ingredient_id: '', cantitate_necesara: 0, unitate_masura: 'kg', observatii: '' }
    ]);
  };

  const addIngredientForm = () => {
    setIngredienteForms([...ingredienteForms, 
      { ingredient_id: '', cantitate_necesara: 0, unitate_masura: 'kg', observatii: '' }
    ]);
  };

  const removeIngredientForm = (index: number) => {
    if (ingredienteForms.length > 1) {
      setIngredienteForms(ingredienteForms.filter((_, i) => i !== index));
    }
  };

  const updateIngredientForm = (index: number, field: keyof IngredientFormData, value: any) => {
    const newForms = [...ingredienteForms];
    newForms[index] = { ...newForms[index], [field]: value };
    setIngredienteForms(newForms);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestionare Rețete</h2>
          <p className="text-muted-foreground">Creează și gestionează rețetele pentru produse</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adaugă Rețetă
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRecipe ? 'Editează Rețeta' : 'Adaugă Rețetă Nouă'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="produs_id">Produs *</Label>
                  <select
                    id="produs_id"
                    value={formData.produs_id}
                    onChange={(e) => setFormData({...formData, produs_id: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">Selectează produsul</option>
                    {products?.map(product => (
                      <option key={product.id} value={product.id}>{product.nume}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nume_reteta">Nume Rețetă *</Label>
                  <Input
                    id="nume_reteta"
                    value={formData.nume_reteta}
                    onChange={(e) => setFormData({...formData, nume_reteta: e.target.value})}
                    placeholder="ex: Salată mixtă clasică"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descriere">Descriere</Label>
                <Input
                  id="descriere"
                  value={formData.descriere}
                  onChange={(e) => setFormData({...formData, descriere: e.target.value})}
                  placeholder="Descriere opțională"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-lg font-medium">Ingrediente</Label>
                  <Button type="button" onClick={addIngredientForm} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Adaugă Ingredient
                  </Button>
                </div>

                {ingredienteForms.map((ingredientForm, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Ingredient</Label>
                        <select
                          value={ingredientForm.ingredient_id}
                          onChange={(e) => updateIngredientForm(index, 'ingredient_id', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="">Selectează ingredientul</option>
                          {ingredients?.map(ingredient => (
                            <option key={ingredient.id} value={ingredient.id}>
                              {ingredient.nume} ({ingredient.unitate_masura})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Cantitate</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={ingredientForm.cantitate_necesara}
                          onChange={(e) => updateIngredientForm(index, 'cantitate_necesara', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Unitate</Label>
                        <select
                          value={ingredientForm.unitate_masura}
                          onChange={(e) => updateIngredientForm(index, 'unitate_masura', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="litri">litri</option>
                          <option value="ml">ml</option>
                          <option value="bucăți">bucăți</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Acțiuni</Label>
                        <div className="flex gap-2">
                          <Input
                            value={ingredientForm.observatii}
                            onChange={(e) => updateIngredientForm(index, 'observatii', e.target.value)}
                            placeholder="Observații"
                            className="flex-1"
                          />
                          {ingredienteForms.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeIngredientForm(index)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={createRecipe.isPending || updateRecipe.isPending}>
                  {editingRecipe ? 'Actualizează' : 'Creează'} Rețeta
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Anulează
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
