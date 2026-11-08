import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus } from "lucide-react";
import { useCreateRecipe, useUpdateRecipe, type ProductieRetetaCompleta } from "@/hooks/productie/useRecipes";
import { useProducts } from "@/hooks/productie/useProductionData";
import { useIngredients } from "@/hooks/productie/useIngredients";

interface IngredientFormData {
  ingredient_id: string;
  cantitate_necesara: number;
  unitate_masura: string;
  observatii: string;
}

const emptyIngredient = (): IngredientFormData => ({ ingredient_id: '', cantitate_necesara: 0, unitate_masura: 'kg', observatii: '' });

/** The same recipe form as Configurări → Rețete; saves through the shared recipe hooks. */
export default function RecipeEditDialog({ open, onOpenChange, recipe, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: ProductieRetetaCompleta | null;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const { data: products } = useProducts();
  const { data: ingredients } = useIngredients();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const [formData, setFormData] = useState({ produs_id: '', nume_reteta: '', descriere: '' });
  const [ingredienteForms, setIngredienteForms] = useState<IngredientFormData[]>([emptyIngredient()]);

  // Hydrate once per opening so edits in progress are never overwritten by a refetch.
  useEffect(() => {
    if (!open) return;
    setFormData({ produs_id: recipe?.produs_id || '', nume_reteta: recipe?.nume_reteta || '', descriere: recipe?.descriere || '' });
    const ings = recipe?.productie_retete_ingrediente || [];
    setIngredienteForms(ings.length ? ings.map((ing: any) => ({
      ingredient_id: ing.ingredient_id, cantitate_necesara: ing.cantitate_necesara, unitate_masura: ing.unitate_masura, observatii: ing.observatii || '',
    })) : [emptyIngredient()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nume_reteta.trim() || !formData.produs_id) {
      toast({ title: "Eroare", description: "Numele rețetei și produsul sunt obligatorii", variant: "destructive" });
      return;
    }
    const ingredienteValide = ingredienteForms.filter(ing => ing.ingredient_id && ing.cantitate_necesara > 0);
    if (ingredienteValide.length === 0) {
      toast({ title: "Eroare", description: "Trebuie să adaugi cel puțin un ingredient", variant: "destructive" });
      return;
    }
    try {
      if (recipe) {
        await updateRecipe.mutateAsync({ id: recipe.id, updates: formData, ingrediente: ingredienteValide });
        toast({ title: "Success", description: "Rețeta a fost actualizată cu succes!" });
      } else {
        await createRecipe.mutateAsync({ ...formData, ingrediente: ingredienteValide });
        toast({ title: "Success", description: "Rețeta a fost creată cu succes!" });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message || 'A apărut o eroare', variant: "destructive" });
    }
  };

  const update = (index: number, field: keyof IngredientFormData, value: any) =>
    setIngredienteForms(forms => forms.map((f, i) => i === index ? { ...f, [field]: value } : f));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe ? 'Editează Rețeta' : 'Adaugă Rețetă Nouă'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="produs_id">Produs *</Label>
              <select id="produs_id" value={formData.produs_id} onChange={(e) => setFormData({ ...formData, produs_id: e.target.value })} className="w-full p-2 border rounded-md bg-background" required>
                <option value="">Selectează produsul</option>
                {products?.map(product => <option key={product.id} value={product.id}>{product.nume}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nume_reteta">Nume Rețetă *</Label>
              <Input id="nume_reteta" value={formData.nume_reteta} onChange={(e) => setFormData({ ...formData, nume_reteta: e.target.value })} placeholder="ex: Salată mixtă clasică" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="descriere">Descriere</Label>
            <Input id="descriere" value={formData.descriere} onChange={(e) => setFormData({ ...formData, descriere: e.target.value })} placeholder="Descriere opțională" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-medium">Ingrediente</Label>
              <Button type="button" onClick={() => setIngredienteForms(f => [...f, emptyIngredient()])} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />Adaugă Ingredient
              </Button>
            </div>
            {ingredienteForms.map((ingredientForm, index) => (
              <Card key={index} className="p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Ingredient</Label>
                    <select value={ingredientForm.ingredient_id} onChange={(e) => update(index, 'ingredient_id', e.target.value)} className="w-full p-2 border rounded-md bg-background">
                      <option value="">Selectează ingredientul</option>
                      {ingredients?.map(ingredient => <option key={ingredient.id} value={ingredient.id}>{ingredient.nume} ({ingredient.unitate_masura})</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cantitate</Label>
                    <Input type="number" step="0.01" value={ingredientForm.cantitate_necesara} onChange={(e) => update(index, 'cantitate_necesara', parseFloat(e.target.value) || 0)} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Unitate</Label>
                    <select value={ingredientForm.unitate_masura} onChange={(e) => update(index, 'unitate_masura', e.target.value)} className="w-full p-2 border rounded-md bg-background">
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
                      <Input value={ingredientForm.observatii} onChange={(e) => update(index, 'observatii', e.target.value)} placeholder="Observații" className="flex-1" />
                      {ingredienteForms.length > 1 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setIngredienteForms(f => f.filter((_, i) => i !== index))}>
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
            <Button type="submit" disabled={createRecipe.isPending || updateRecipe.isPending}>{recipe ? 'Actualizează' : 'Creează'} Rețeta</Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Anulează</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
