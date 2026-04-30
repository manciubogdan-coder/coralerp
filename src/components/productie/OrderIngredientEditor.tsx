
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ChefHat } from "lucide-react";
import { useIngredients } from "@/hooks/useIngredients";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OrderIngredientEditorProps {
  comandaId: string;
  produsNume: string;
  onClose: () => void;
}

interface IngredientComanda {
  id?: string;
  ingredient_id?: string;
  ingredient_custom_nume?: string;
  cantitate_necesara: number;
  unitate_masura: string;
  observatii?: string;
}

const OrderIngredientEditor = ({ comandaId, produsNume, onClose }: OrderIngredientEditorProps) => {
  const [ingredienteComanda, setIngredienteComanda] = useState<IngredientComanda[]>([]);
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [currentIngredient, setCurrentIngredient] = useState<IngredientComanda>({
    cantitate_necesara: 0,
    unitate_masura: "kg"
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ingredients } = useIngredients();

  // Încarcă ingredientele existente pentru comandă
  const { data: ingredienteExistente } = useQuery({
    queryKey: ['order-ingredients', comandaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_comenzi_ingrediente')
        .select(`
          *,
          productie_ingrediente(nume)
        `)
        .eq('comanda_id', comandaId);
      
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (ingredienteExistente) {
      setIngredienteComanda(ingredienteExistente.map(item => ({
        id: item.id,
        ingredient_id: item.ingredient_id,
        ingredient_custom_nume: item.ingredient_custom_nume,
        cantitate_necesara: item.cantitate_necesara,
        unitate_masura: item.unitate_masura,
        observatii: item.observatii
      })));
    }
  }, [ingredienteExistente]);

  // Salvează ingredientele
  const saveIngredientsMutation = useMutation({
    mutationFn: async (ingrediente: IngredientComanda[]) => {
      // Șterge ingredientele existente
      await supabase
        .from('productie_comenzi_ingrediente')
        .delete()
        .eq('comanda_id', comandaId);

      // Adaugă ingredientele noi
      if (ingrediente.length > 0) {
        const ingredienteData = ingrediente.map(ing => ({
          comanda_id: comandaId,
          ingredient_id: ing.ingredient_id || null,
          ingredient_custom_nume: ing.ingredient_custom_nume || null,
          cantitate_necesara: ing.cantitate_necesara,
          unitate_masura: ing.unitate_masura,
          observatii: ing.observatii
        }));

        const { error } = await supabase
          .from('productie_comenzi_ingrediente')
          .insert(ingredienteData);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-ingredients'] });
      toast({
        title: "Ingrediente salvate",
        description: "Ingredientele comenzii au fost actualizate cu succes"
      });
      onClose();
    }
  });

  const addIngredient = () => {
    if (!currentIngredient.ingredient_id && !currentIngredient.ingredient_custom_nume) {
      toast({
        title: "Eroare",
        description: "Selectați un ingredient sau introduceți un nume custom",
        variant: "destructive"
      });
      return;
    }

    if (currentIngredient.cantitate_necesara <= 0) {
      toast({
        title: "Eroare",
        description: "Introduceți o cantitate validă",
        variant: "destructive"
      });
      return;
    }

    setIngredienteComanda([...ingredienteComanda, { ...currentIngredient }]);
    setCurrentIngredient({
      cantitate_necesara: 0,
      unitate_masura: "kg"
    });
    setIsAddingIngredient(false);
  };

  const removeIngredient = (index: number) => {
    setIngredienteComanda(ingredienteComanda.filter((_, i) => i !== index));
  };

  const getIngredientName = (ingredient: IngredientComanda) => {
    if (ingredient.ingredient_custom_nume) {
      return ingredient.ingredient_custom_nume;
    }
    const foundIngredient = ingredients?.find(i => i.id === ingredient.ingredient_id);
    return foundIngredient?.nume || 'Necunoscut';
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="h-5 w-5" />
          Editare Ingrediente - {produsNume}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista ingrediente existente */}
        <div className="space-y-2">
          <Label className="text-lg font-medium">Ingrediente Comandă</Label>
          {ingredienteComanda.length === 0 ? (
            <p className="text-muted-foreground">Nu sunt ingrediente definite pentru această comandă</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Cantitate</TableHead>
                  <TableHead>Unitate</TableHead>
                  <TableHead>Observații</TableHead>
                  <TableHead className="w-16">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredienteComanda.map((ingredient, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {getIngredientName(ingredient)}
                      {ingredient.ingredient_custom_nume && (
                        <Badge variant="outline" className="ml-2">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell>{ingredient.cantitate_necesara}</TableCell>
                    <TableCell>{ingredient.unitate_masura}</TableCell>
                    <TableCell>{ingredient.observatii || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeIngredient(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Adăugare ingredient nou */}
        {!isAddingIngredient ? (
          <Button onClick={() => setIsAddingIngredient(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Adaugă Ingredient
          </Button>
        ) : (
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ingredient din listă</Label>
                <Select
                  value={currentIngredient.ingredient_id || ""}
                  onValueChange={(value) => setCurrentIngredient({ 
                    ...currentIngredient, 
                    ingredient_id: value || undefined,
                    ingredient_custom_nume: undefined 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectați ingredientul" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients?.map((ingredient) => (
                      <SelectItem key={ingredient.id} value={ingredient.id}>
                        {ingredient.nume} ({ingredient.unitate_masura})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>SAU Ingredient custom</Label>
                <Input
                  placeholder="Nume ingredient custom"
                  value={currentIngredient.ingredient_custom_nume || ""}
                  onChange={(e) => setCurrentIngredient({ 
                    ...currentIngredient, 
                    ingredient_custom_nume: e.target.value || undefined,
                    ingredient_id: undefined 
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Cantitate</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={currentIngredient.cantitate_necesara}
                  onChange={(e) => setCurrentIngredient({ 
                    ...currentIngredient, 
                    cantitate_necesara: parseFloat(e.target.value) || 0 
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Unitate</Label>
                <Select
                  value={currentIngredient.unitate_masura}
                  onValueChange={(value) => setCurrentIngredient({ ...currentIngredient, unitate_masura: value })}
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

              <div className="space-y-2 col-span-2">
                <Label>Observații</Label>
                <Input
                  placeholder="Observații..."
                  value={currentIngredient.observatii || ""}
                  onChange={(e) => setCurrentIngredient({ ...currentIngredient, observatii: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={addIngredient} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adaugă
              </Button>
              <Button onClick={() => setIsAddingIngredient(false)} variant="outline" size="sm">
                Anulează
              </Button>
            </div>
          </Card>
        )}

        {/* Butoane acțiuni */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button 
            onClick={() => saveIngredientsMutation.mutate(ingredienteComanda)}
            disabled={saveIngredientsMutation.isPending}
          >
            Salvează Ingrediente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderIngredientEditor;
